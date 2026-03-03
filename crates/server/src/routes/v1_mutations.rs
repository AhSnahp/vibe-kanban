use api_types::{
    CreateIssueRelationshipRequest, CreateIssueRequest, CreateIssueTagRequest,
    CreateProjectStatusRequest, CreateTagRequest, UpdateIssueRequest, UpdateProjectRequest,
    UpdateProjectStatusRequest,
};
use axum::{
    Router,
    extract::{Json, Path, State},
    response::Json as ResponseJson,
    routing::{delete, patch, post},
};
use db::models::local_issue::{
    LocalIssue, LocalIssueRelationship, LocalIssueTag, LocalProject, LocalProjectStatus, LocalTag,
};
use deployment::Deployment;
use serde::Deserialize;
use uuid::Uuid;

use crate::{DeploymentImpl, error::ApiError};

/// Static txid response — no ElectricSQL tracking in local mode.
fn txid_response() -> serde_json::Value {
    serde_json::json!({ "txid": 1 })
}

pub fn router() -> Router<DeploymentImpl> {
    Router::new()
        // Projects
        .route("/projects", post(create_project))
        .route("/projects/{id}", patch(update_project))
        .route("/projects/{id}", delete(delete_project))
        .route("/projects/bulk", post(bulk_update_projects))
        // Project statuses
        .route("/project_statuses", post(create_project_status))
        .route("/project_statuses/{id}", patch(update_project_status))
        .route("/project_statuses/bulk", post(bulk_update_project_statuses))
        // Issues
        .route("/issues", post(create_issue))
        .route("/issues/{id}", patch(update_issue))
        .route("/issues/{id}", delete(delete_issue))
        .route("/issues/bulk", post(bulk_update_issues))
        // Tags
        .route("/tags", post(create_tag))
        // Issue tags
        .route("/issue_tags", post(create_issue_tag))
        .route("/issue_tags/{id}", delete(delete_issue_tag))
        // Issue relationships
        .route("/issue_relationships", post(create_issue_relationship))
        .route(
            "/issue_relationships/{id}",
            delete(delete_issue_relationship),
        )
}

// ── Projects ────────────────────────────────────────────────────────

async fn create_project(
    State(deployment): State<DeploymentImpl>,
    Json(body): Json<CreateProjectBody>,
) -> Result<ResponseJson<serde_json::Value>, ApiError> {
    let pool = &deployment.db().pool;
    LocalProject::create_with_defaults(pool, &body.name, &body.color).await?;
    Ok(ResponseJson(txid_response()))
}

/// The frontend sends the full row for creates, which includes fields
/// not in `CreateProjectRequest`. We only need name and color.
#[derive(Debug, Deserialize)]
struct CreateProjectBody {
    name: String,
    #[serde(default = "default_color")]
    color: String,
}

fn default_color() -> String {
    "#3b82f6".to_string()
}

async fn update_project(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateProjectRequest>,
) -> Result<ResponseJson<serde_json::Value>, ApiError> {
    let pool = &deployment.db().pool;
    LocalProject::update(pool, id, &body).await?;
    Ok(ResponseJson(txid_response()))
}

async fn delete_project(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<Uuid>,
) -> Result<ResponseJson<serde_json::Value>, ApiError> {
    let pool = &deployment.db().pool;
    LocalProject::delete(pool, id).await?;
    Ok(ResponseJson(txid_response()))
}

#[derive(Debug, Deserialize)]
struct BulkUpdateItem<T> {
    id: Uuid,
    #[serde(flatten)]
    changes: T,
}

#[derive(Debug, Deserialize)]
struct BulkUpdateRequest<T> {
    updates: Vec<BulkUpdateItem<T>>,
}

async fn bulk_update_projects(
    State(deployment): State<DeploymentImpl>,
    Json(body): Json<BulkUpdateRequest<UpdateProjectRequest>>,
) -> Result<ResponseJson<serde_json::Value>, ApiError> {
    let pool = &deployment.db().pool;
    for item in &body.updates {
        LocalProject::update(pool, item.id, &item.changes).await?;
    }
    Ok(ResponseJson(txid_response()))
}

// ── Project Statuses ────────────────────────────────────────────────

async fn create_project_status(
    State(deployment): State<DeploymentImpl>,
    Json(body): Json<CreateProjectStatusRequest>,
) -> Result<ResponseJson<serde_json::Value>, ApiError> {
    let pool = &deployment.db().pool;
    LocalProjectStatus::create(pool, &body).await?;
    Ok(ResponseJson(txid_response()))
}

async fn update_project_status(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateProjectStatusRequest>,
) -> Result<ResponseJson<serde_json::Value>, ApiError> {
    let pool = &deployment.db().pool;
    LocalProjectStatus::update(pool, id, &body).await?;
    Ok(ResponseJson(txid_response()))
}

async fn bulk_update_project_statuses(
    State(deployment): State<DeploymentImpl>,
    Json(body): Json<BulkUpdateRequest<UpdateProjectStatusRequest>>,
) -> Result<ResponseJson<serde_json::Value>, ApiError> {
    let pool = &deployment.db().pool;
    for item in &body.updates {
        LocalProjectStatus::update(pool, item.id, &item.changes).await?;
    }
    Ok(ResponseJson(txid_response()))
}

// ── Issues ──────────────────────────────────────────────────────────

async fn create_issue(
    State(deployment): State<DeploymentImpl>,
    Json(body): Json<CreateIssueRequest>,
) -> Result<ResponseJson<serde_json::Value>, ApiError> {
    let pool = &deployment.db().pool;
    LocalIssue::create(pool, &body).await?;
    Ok(ResponseJson(txid_response()))
}

async fn update_issue(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateIssueRequest>,
) -> Result<ResponseJson<serde_json::Value>, ApiError> {
    let pool = &deployment.db().pool;
    LocalIssue::update(pool, id, &body).await?;
    Ok(ResponseJson(txid_response()))
}

async fn delete_issue(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<Uuid>,
) -> Result<ResponseJson<serde_json::Value>, ApiError> {
    let pool = &deployment.db().pool;
    LocalIssue::delete(pool, id).await?;
    Ok(ResponseJson(txid_response()))
}

async fn bulk_update_issues(
    State(deployment): State<DeploymentImpl>,
    Json(body): Json<BulkUpdateRequest<UpdateIssueRequest>>,
) -> Result<ResponseJson<serde_json::Value>, ApiError> {
    let pool = &deployment.db().pool;
    for item in &body.updates {
        LocalIssue::update(pool, item.id, &item.changes).await?;
    }
    Ok(ResponseJson(txid_response()))
}

// ── Tags ────────────────────────────────────────────────────────────

async fn create_tag(
    State(deployment): State<DeploymentImpl>,
    Json(body): Json<CreateTagRequest>,
) -> Result<ResponseJson<serde_json::Value>, ApiError> {
    let pool = &deployment.db().pool;
    LocalTag::create(pool, &body).await?;
    Ok(ResponseJson(txid_response()))
}

// ── Issue Tags ──────────────────────────────────────────────────────

async fn create_issue_tag(
    State(deployment): State<DeploymentImpl>,
    Json(body): Json<CreateIssueTagRequest>,
) -> Result<ResponseJson<serde_json::Value>, ApiError> {
    let pool = &deployment.db().pool;
    LocalIssueTag::create(pool, &body).await?;
    Ok(ResponseJson(txid_response()))
}

async fn delete_issue_tag(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<Uuid>,
) -> Result<ResponseJson<serde_json::Value>, ApiError> {
    let pool = &deployment.db().pool;
    LocalIssueTag::delete(pool, id).await?;
    Ok(ResponseJson(txid_response()))
}

// ── Issue Relationships ─────────────────────────────────────────────

async fn create_issue_relationship(
    State(deployment): State<DeploymentImpl>,
    Json(body): Json<CreateIssueRelationshipRequest>,
) -> Result<ResponseJson<serde_json::Value>, ApiError> {
    let pool = &deployment.db().pool;
    LocalIssueRelationship::create(pool, &body).await?;
    Ok(ResponseJson(txid_response()))
}

async fn delete_issue_relationship(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<Uuid>,
) -> Result<ResponseJson<serde_json::Value>, ApiError> {
    let pool = &deployment.db().pool;
    LocalIssueRelationship::delete(pool, id).await?;
    Ok(ResponseJson(txid_response()))
}
