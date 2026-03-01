use api_types::{
    CreateIssueRequest, Issue, ListIssuesResponse, MutationResponse, UpdateIssueRequest,
};
use axum::{
    Router,
    extract::{Json, Path, Query, State},
    response::Json as ResponseJson,
    routing::get,
};
use db::models::local_issue::LocalIssue;
use deployment::Deployment;
use serde::Deserialize;
use utils::response::ApiResponse;
use uuid::Uuid;

use crate::{DeploymentImpl, error::ApiError};

#[derive(Debug, Deserialize)]
pub struct ListIssuesQuery {
    pub project_id: Uuid,
}

pub fn router() -> Router<DeploymentImpl> {
    Router::new()
        .route("/issues", get(list_issues).post(create_issue))
        .route(
            "/issues/{issue_id}",
            get(get_issue).patch(update_issue).delete(delete_issue),
        )
}

async fn list_issues(
    State(deployment): State<DeploymentImpl>,
    Query(query): Query<ListIssuesQuery>,
) -> Result<ResponseJson<ApiResponse<ListIssuesResponse>>, ApiError> {
    match deployment.remote_client() {
        Ok(client) => {
            let response = client.list_issues(query.project_id).await?;
            Ok(ResponseJson(ApiResponse::success(response)))
        }
        Err(_) => {
            let response = LocalIssue::list(&deployment.db().pool, query.project_id).await?;
            Ok(ResponseJson(ApiResponse::success(response)))
        }
    }
}

async fn get_issue(
    State(deployment): State<DeploymentImpl>,
    Path(issue_id): Path<Uuid>,
) -> Result<ResponseJson<ApiResponse<Issue>>, ApiError> {
    match deployment.remote_client() {
        Ok(client) => {
            let response = client.get_issue(issue_id).await?;
            Ok(ResponseJson(ApiResponse::success(response)))
        }
        Err(_) => {
            let issue = LocalIssue::get(&deployment.db().pool, issue_id).await?;
            Ok(ResponseJson(ApiResponse::success(issue)))
        }
    }
}

async fn create_issue(
    State(deployment): State<DeploymentImpl>,
    Json(request): Json<CreateIssueRequest>,
) -> Result<ResponseJson<ApiResponse<MutationResponse<Issue>>>, ApiError> {
    match deployment.remote_client() {
        Ok(client) => {
            let response = client.create_issue(&request).await?;
            Ok(ResponseJson(ApiResponse::success(response)))
        }
        Err(_) => {
            let response = LocalIssue::create(&deployment.db().pool, &request).await?;
            Ok(ResponseJson(ApiResponse::success(response)))
        }
    }
}

async fn update_issue(
    State(deployment): State<DeploymentImpl>,
    Path(issue_id): Path<Uuid>,
    Json(request): Json<UpdateIssueRequest>,
) -> Result<ResponseJson<ApiResponse<MutationResponse<Issue>>>, ApiError> {
    match deployment.remote_client() {
        Ok(client) => {
            let response = client.update_issue(issue_id, &request).await?;
            Ok(ResponseJson(ApiResponse::success(response)))
        }
        Err(_) => {
            let response = LocalIssue::update(&deployment.db().pool, issue_id, &request).await?;
            Ok(ResponseJson(ApiResponse::success(response)))
        }
    }
}

async fn delete_issue(
    State(deployment): State<DeploymentImpl>,
    Path(issue_id): Path<Uuid>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    match deployment.remote_client() {
        Ok(client) => {
            client.delete_issue(issue_id).await?;
            Ok(ResponseJson(ApiResponse::success(())))
        }
        Err(_) => {
            LocalIssue::delete(&deployment.db().pool, issue_id).await?;
            Ok(ResponseJson(ApiResponse::success(())))
        }
    }
}
