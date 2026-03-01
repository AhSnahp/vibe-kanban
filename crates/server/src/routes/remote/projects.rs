use api_types::{ListProjectsResponse, Project};
use axum::{
    Router,
    extract::{Path, Query, State},
    response::Json as ResponseJson,
    routing::get,
};
use db::models::local_issue::LocalProject;
use deployment::Deployment;
use serde::Deserialize;
use utils::response::ApiResponse;
use uuid::Uuid;

use crate::{DeploymentImpl, error::ApiError};

#[derive(Debug, Deserialize)]
pub struct ListRemoteProjectsQuery {
    pub organization_id: Uuid,
}

pub fn router() -> Router<DeploymentImpl> {
    Router::new()
        .route("/projects", get(list_remote_projects))
        .route("/projects/{project_id}", get(get_remote_project))
}

async fn list_remote_projects(
    State(deployment): State<DeploymentImpl>,
    Query(query): Query<ListRemoteProjectsQuery>,
) -> Result<ResponseJson<ApiResponse<ListProjectsResponse>>, ApiError> {
    match deployment.remote_client() {
        Ok(client) => {
            let response = client.list_remote_projects(query.organization_id).await?;
            Ok(ResponseJson(ApiResponse::success(response)))
        }
        Err(_) => {
            let response = LocalProject::list(&deployment.db().pool).await?;
            Ok(ResponseJson(ApiResponse::success(response)))
        }
    }
}

async fn get_remote_project(
    State(deployment): State<DeploymentImpl>,
    Path(project_id): Path<Uuid>,
) -> Result<ResponseJson<ApiResponse<Project>>, ApiError> {
    match deployment.remote_client() {
        Ok(client) => {
            let project = client.get_remote_project(project_id).await?;
            Ok(ResponseJson(ApiResponse::success(project)))
        }
        Err(_) => {
            let project = LocalProject::get(&deployment.db().pool, project_id).await?;
            Ok(ResponseJson(ApiResponse::success(project)))
        }
    }
}
