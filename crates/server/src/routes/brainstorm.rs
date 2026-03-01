use api_types::{CreateIssueRequest, IssuePriority};
use axum::{
    Json, Router,
    extract::{Path, State, ws::Message},
    response::{IntoResponse, Json as ResponseJson},
    routing::{delete, get, post},
};
use db::models::brainstorm::{
    AddBrainstormContextRequest, BrainstormContext, BrainstormError, BrainstormMessage,
    BrainstormPlan, BrainstormPlanItem, BrainstormSendRequest, BrainstormSession,
    BrainstormSessionDetail, BrainstormStatusResponse, BrainstormStreamEvent,
    CreateBrainstormSession, PushPlanRequest, PushPlanResponse, UpdateBrainstormSession,
};
use deployment::Deployment;
use futures_util::StreamExt;
use serde_json;
use utils::response::ApiResponse;
use uuid::Uuid;

use crate::{
    DeploymentImpl,
    error::ApiError,
    routes::relay_ws::{SignedWebSocket, SignedWsUpgrade},
};

// ── Status ──────────────────────────────────────────────────────────

pub async fn brainstorm_status(
    State(deployment): State<DeploymentImpl>,
) -> ResponseJson<ApiResponse<BrainstormStatusResponse>> {
    let available = deployment.brainstorm().is_available();
    ResponseJson(ApiResponse::success(BrainstormStatusResponse { available }))
}

// ── Session CRUD ────────────────────────────────────────────────────

pub async fn list_sessions(
    State(deployment): State<DeploymentImpl>,
) -> Result<ResponseJson<ApiResponse<Vec<BrainstormSession>>>, ApiError> {
    let sessions = BrainstormSession::find_all(&deployment.db().pool).await?;
    Ok(ResponseJson(ApiResponse::success(sessions)))
}

pub async fn create_session(
    State(deployment): State<DeploymentImpl>,
    Json(payload): Json<CreateBrainstormSession>,
) -> Result<ResponseJson<ApiResponse<BrainstormSession>>, ApiError> {
    let id = Uuid::new_v4();
    let session = BrainstormSession::create(&deployment.db().pool, id, &payload).await?;
    Ok(ResponseJson(ApiResponse::success(session)))
}

pub async fn get_session(
    State(deployment): State<DeploymentImpl>,
    Path(session_id): Path<Uuid>,
) -> Result<ResponseJson<ApiResponse<BrainstormSessionDetail>>, ApiError> {
    let session = BrainstormSession::find_by_id(&deployment.db().pool, session_id)
        .await?
        .ok_or_else(|| ApiError::BadRequest("Brainstorm session not found".to_string()))?;
    let messages = BrainstormMessage::find_by_session_id(&deployment.db().pool, session_id).await?;
    let context = BrainstormContext::find_by_session_id(&deployment.db().pool, session_id).await?;

    Ok(ResponseJson(ApiResponse::success(
        BrainstormSessionDetail {
            session,
            messages,
            context,
        },
    )))
}

pub async fn update_session(
    State(deployment): State<DeploymentImpl>,
    Path(session_id): Path<Uuid>,
    Json(payload): Json<UpdateBrainstormSession>,
) -> Result<ResponseJson<ApiResponse<BrainstormSession>>, ApiError> {
    let session = BrainstormSession::update(&deployment.db().pool, session_id, &payload).await?;
    Ok(ResponseJson(ApiResponse::success(session)))
}

pub async fn delete_session(
    State(deployment): State<DeploymentImpl>,
    Path(session_id): Path<Uuid>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    let rows = BrainstormSession::delete(&deployment.db().pool, session_id).await?;
    if rows == 0 {
        return Err(ApiError::BadRequest(
            "Brainstorm session not found".to_string(),
        ));
    }
    Ok(ResponseJson(ApiResponse::success(())))
}

// ── WebSocket Streaming ─────────────────────────────────────────────

pub async fn stream_ws(
    ws: SignedWsUpgrade,
    State(deployment): State<DeploymentImpl>,
    Path(session_id): Path<Uuid>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| async move {
        if let Err(e) = handle_stream_ws(socket, deployment, session_id).await {
            tracing::warn!("brainstorm WS closed: {}", e);
        }
    })
}

async fn handle_stream_ws(
    mut socket: SignedWebSocket,
    deployment: DeploymentImpl,
    session_id: Uuid,
) -> anyhow::Result<()> {
    // Wait for the first message which contains the send request
    let request: BrainstormSendRequest = loop {
        match socket.recv().await {
            Ok(Some(Message::Text(text))) => {
                match serde_json::from_str::<BrainstormSendRequest>(&text) {
                    Ok(req) => break req,
                    Err(e) => {
                        let error_event = BrainstormStreamEvent::Error {
                            error: format!("Invalid request: {}", e),
                        };
                        let _ = socket
                            .send(Message::Text(serde_json::to_string(&error_event)?.into()))
                            .await;
                        return Ok(());
                    }
                }
            }
            Ok(Some(Message::Close(_))) | Ok(None) => return Ok(()),
            Ok(Some(_)) => continue,
            Err(_) => return Ok(()),
        }
    };

    // Start streaming from the Anthropic API
    let stream_result = deployment
        .brainstorm()
        .send_message(
            &deployment.db().pool,
            session_id,
            &request.message,
            request.budget_tokens,
        )
        .await;

    match stream_result {
        Ok(mut stream) => {
            while let Some(event) = stream.next().await {
                let json = serde_json::to_string(&event)?;
                if socket.send(Message::Text(json.into())).await.is_err() {
                    break;
                }
            }
        }
        Err(e) => {
            let error_event = BrainstormStreamEvent::Error {
                error: format!("{}", e),
            };
            let _ = socket
                .send(Message::Text(serde_json::to_string(&error_event)?.into()))
                .await;
        }
    }

    Ok(())
}

// ── Context ─────────────────────────────────────────────────────────

pub async fn add_context(
    State(deployment): State<DeploymentImpl>,
    Path(session_id): Path<Uuid>,
    Json(payload): Json<AddBrainstormContextRequest>,
) -> Result<ResponseJson<ApiResponse<BrainstormContext>>, ApiError> {
    // Verify session exists
    BrainstormSession::find_by_id(&deployment.db().pool, session_id)
        .await?
        .ok_or_else(|| ApiError::BadRequest("Brainstorm session not found".to_string()))?;

    let id = Uuid::new_v4();
    let context =
        BrainstormContext::create(&deployment.db().pool, id, session_id, &payload).await?;
    Ok(ResponseJson(ApiResponse::success(context)))
}

pub async fn remove_context(
    State(deployment): State<DeploymentImpl>,
    Path((_session_id, ctx_id)): Path<(Uuid, Uuid)>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    let rows = BrainstormContext::delete(&deployment.db().pool, ctx_id).await?;
    if rows == 0 {
        return Err(ApiError::BadRequest("Context not found".to_string()));
    }
    Ok(ResponseJson(ApiResponse::success(())))
}

// ── Plan Extraction ─────────────────────────────────────────────────

pub async fn extract_plan(
    State(deployment): State<DeploymentImpl>,
    Path(session_id): Path<Uuid>,
) -> Result<ResponseJson<ApiResponse<BrainstormPlan>>, ApiError> {
    let plan = deployment
        .brainstorm()
        .extract_plan(&deployment.db().pool, session_id)
        .await?;
    Ok(ResponseJson(ApiResponse::success(plan)))
}

// ── Push Plan to Kanban ─────────────────────────────────────────────

pub async fn push_plan(
    State(deployment): State<DeploymentImpl>,
    Path(_session_id): Path<Uuid>,
    Json(payload): Json<PushPlanRequest>,
) -> Result<ResponseJson<ApiResponse<PushPlanResponse>>, ApiError> {
    let client = deployment.remote_client()?;

    // Resolve project ID
    let project_id = match (payload.project_id, payload.new_project_name) {
        (Some(id), _) => Uuid::parse_str(&id)
            .map_err(|_| ApiError::BadRequest("Invalid project_id".to_string()))?,
        (None, Some(_name)) => {
            return Err(ApiError::BadRequest(
                "Creating new projects from brainstorm is not yet supported. Please select an existing project.".to_string(),
            ));
        }
        (None, None) => {
            return Err(ApiError::BadRequest(
                "Either project_id or new_project_name must be provided".to_string(),
            ));
        }
    };

    // Get the first status column (e.g. "To Do") for the target project
    let statuses = client.list_project_statuses(project_id).await?;
    let first_status = statuses
        .project_statuses
        .first()
        .ok_or_else(|| ApiError::BadRequest("Project has no status columns".to_string()))?;

    // Create an issue for each plan item
    let mut issue_ids = Vec::new();
    for (i, item) in payload.items.iter().enumerate() {
        let priority = parse_priority(item);
        let description = build_issue_description(item);

        let request = CreateIssueRequest {
            id: Some(Uuid::new_v4()),
            project_id,
            status_id: first_status.id,
            title: item.title.clone(),
            description: Some(description),
            priority,
            start_date: None,
            target_date: None,
            completed_at: None,
            sort_order: i as f64,
            parent_issue_id: None,
            parent_issue_sort_order: None,
            extension_metadata: serde_json::json!({}),
        };

        let response = client.create_issue(&request).await?;
        issue_ids.push(response.data.id.to_string());
    }

    Ok(ResponseJson(ApiResponse::success(PushPlanResponse {
        project_id: project_id.to_string(),
        issue_ids,
        workspace_ids: vec![],
        repo_id: None,
    })))
}

fn parse_priority(item: &BrainstormPlanItem) -> Option<IssuePriority> {
    item.priority
        .as_deref()
        .and_then(|p| match p.to_lowercase().as_str() {
            "urgent" => Some(IssuePriority::Urgent),
            "high" => Some(IssuePriority::High),
            "medium" => Some(IssuePriority::Medium),
            "low" => Some(IssuePriority::Low),
            _ => None,
        })
}

fn build_issue_description(item: &BrainstormPlanItem) -> String {
    let mut desc = item.description.clone();

    if let Some(effort) = &item.estimated_effort {
        desc.push_str(&format!("\n\n**Estimated effort:** {}", effort));
    }

    if !item.dependencies.is_empty() {
        desc.push_str("\n\n**Dependencies:**");
        for dep in &item.dependencies {
            desc.push_str(&format!("\n- {}", dep));
        }
    }

    if !item.tags.is_empty() {
        desc.push_str(&format!("\n\n**Tags:** {}", item.tags.join(", ")));
    }

    desc
}

// ── Error conversion ────────────────────────────────────────────────

impl From<BrainstormError> for ApiError {
    fn from(err: BrainstormError) -> Self {
        match err {
            BrainstormError::Database(e) => ApiError::Database(e),
            BrainstormError::SessionNotFound => {
                ApiError::BadRequest("Brainstorm session not found".to_string())
            }
            BrainstormError::ApiKeyMissing => ApiError::BadRequest(
                "Anthropic API key not configured. Set ANTHROPIC_API_KEY environment variable."
                    .to_string(),
            ),
            BrainstormError::AnthropicApi(msg) => {
                ApiError::BadRequest(format!("Anthropic API error: {}", msg))
            }
            BrainstormError::RateLimit => {
                ApiError::TooManyRequests("Anthropic API rate limited. Please wait.".to_string())
            }
        }
    }
}

// ── Router ──────────────────────────────────────────────────────────

pub fn router(_deployment: &DeploymentImpl) -> Router<DeploymentImpl> {
    Router::new()
        .route("/brainstorm/status", get(brainstorm_status))
        .route(
            "/brainstorm/sessions",
            get(list_sessions).post(create_session),
        )
        .route(
            "/brainstorm/sessions/{id}",
            get(get_session).put(update_session).delete(delete_session),
        )
        .route("/brainstorm/sessions/{id}/stream/ws", get(stream_ws))
        .route("/brainstorm/sessions/{id}/context", post(add_context))
        .route(
            "/brainstorm/sessions/{id}/context/{ctx_id}",
            delete(remove_context),
        )
        .route("/brainstorm/sessions/{id}/extract-plan", post(extract_plan))
        .route("/brainstorm/sessions/{id}/push-plan", post(push_plan))
}
