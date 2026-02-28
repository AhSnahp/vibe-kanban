use axum::{
    Json, Router,
    extract::{Path, State, ws::Message},
    response::{IntoResponse, Json as ResponseJson},
    routing::{delete, get, post, put},
};
use db::models::brainstorm::{
    AddBrainstormContextRequest, BrainstormContext, BrainstormError, BrainstormMessage,
    BrainstormPlan, BrainstormSendRequest, BrainstormSession, BrainstormSessionDetail,
    BrainstormStatusResponse, BrainstormStreamEvent, CreateBrainstormSession, PushPlanRequest,
    PushPlanResponse, UpdateBrainstormSession,
};
use deployment::Deployment;
use futures_util::StreamExt;
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
    Path(session_id): Path<Uuid>,
    Json(payload): Json<PushPlanRequest>,
) -> Result<ResponseJson<ApiResponse<PushPlanResponse>>, ApiError> {
    // For now, return a placeholder - the actual implementation requires
    // RemoteClient and more complex orchestration that depends on user's
    // API key and project setup
    let _ = session_id;
    let _ = payload;
    Err(ApiError::BadRequest(
        "Push-to-kanban not yet implemented. Use the extracted plan to create issues manually."
            .to_string(),
    ))
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
