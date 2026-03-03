use axum::{
    Router,
    extract::{Query, State},
    response::Json as ResponseJson,
    routing::get,
};
use db::models::local_issue::{
    LocalIssue, LocalIssueRelationship, LocalIssueTag, LocalProject, LocalProjectStatus, LocalTag,
};
use deployment::Deployment;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{DeploymentImpl, error::ApiError};

pub fn router() -> Router<DeploymentImpl> {
    Router::new()
        .route("/projects", get(fallback_projects))
        .route("/project_statuses", get(fallback_project_statuses))
        .route("/issues", get(fallback_issues))
        .route("/tags", get(fallback_tags))
        .route("/issue_assignees", get(fallback_issue_assignees))
        .route("/issue_followers", get(fallback_issue_followers))
        .route("/issue_tags", get(fallback_issue_tags))
        .route("/issue_relationships", get(fallback_issue_relationships))
        .route("/pull_requests", get(fallback_pull_requests))
        .route("/organization_members", get(fallback_organization_members))
        .route("/users", get(fallback_users))
        .route("/user_workspaces", get(fallback_user_workspaces))
        .route("/project_workspaces", get(fallback_project_workspaces))
        .route("/issue_comments", get(fallback_issue_comments))
        .route(
            "/issue_comment_reactions",
            get(fallback_issue_comment_reactions),
        )
        .route("/notifications", get(fallback_notifications))
}

// ── Query param types ───────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct OrgQuery {
    #[allow(dead_code)]
    organization_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
struct ProjectQuery {
    project_id: Option<Uuid>,
}

// ── Data handlers ───────────────────────────────────────────────────

async fn fallback_projects(
    State(deployment): State<DeploymentImpl>,
    Query(_query): Query<OrgQuery>,
) -> Result<ResponseJson<serde_json::Value>, ApiError> {
    let pool = &deployment.db().pool;
    let response = LocalProject::list(pool).await?;
    Ok(ResponseJson(
        serde_json::json!({ "projects": response.projects }),
    ))
}

async fn fallback_project_statuses(
    State(deployment): State<DeploymentImpl>,
    Query(query): Query<ProjectQuery>,
) -> Result<ResponseJson<serde_json::Value>, ApiError> {
    let pool = &deployment.db().pool;
    if let Some(project_id) = query.project_id {
        let response = LocalProjectStatus::list(pool, project_id).await?;
        Ok(ResponseJson(
            serde_json::json!({ "project_statuses": response.project_statuses }),
        ))
    } else {
        Ok(ResponseJson(serde_json::json!({ "project_statuses": [] })))
    }
}

async fn fallback_issues(
    State(deployment): State<DeploymentImpl>,
    Query(query): Query<ProjectQuery>,
) -> Result<ResponseJson<serde_json::Value>, ApiError> {
    let pool = &deployment.db().pool;
    if let Some(project_id) = query.project_id {
        let response = LocalIssue::list(pool, project_id).await?;
        Ok(ResponseJson(
            serde_json::json!({ "issues": response.issues }),
        ))
    } else {
        Ok(ResponseJson(serde_json::json!({ "issues": [] })))
    }
}

async fn fallback_issue_tags(
    State(deployment): State<DeploymentImpl>,
    Query(query): Query<ProjectQuery>,
) -> Result<ResponseJson<serde_json::Value>, ApiError> {
    let pool = &deployment.db().pool;
    if let Some(project_id) = query.project_id {
        let tags = LocalIssueTag::find_by_project(pool, project_id).await?;
        Ok(ResponseJson(serde_json::json!({ "issue_tags": tags })))
    } else {
        Ok(ResponseJson(serde_json::json!({ "issue_tags": [] })))
    }
}

async fn fallback_issue_relationships(
    State(deployment): State<DeploymentImpl>,
    Query(query): Query<ProjectQuery>,
) -> Result<ResponseJson<serde_json::Value>, ApiError> {
    let pool = &deployment.db().pool;
    if let Some(project_id) = query.project_id {
        let rels = LocalIssueRelationship::find_by_project(pool, project_id).await?;
        Ok(ResponseJson(
            serde_json::json!({ "issue_relationships": rels }),
        ))
    } else {
        Ok(ResponseJson(
            serde_json::json!({ "issue_relationships": [] }),
        ))
    }
}

// ── Empty-array stubs ───────────────────────────────────────────────

async fn fallback_tags(
    State(deployment): State<DeploymentImpl>,
    Query(query): Query<ProjectQuery>,
) -> Result<ResponseJson<serde_json::Value>, ApiError> {
    let pool = &deployment.db().pool;
    if let Some(project_id) = query.project_id {
        let tags = LocalTag::list(pool, project_id).await?;
        Ok(ResponseJson(serde_json::json!({ "tags": tags })))
    } else {
        Ok(ResponseJson(serde_json::json!({ "tags": [] })))
    }
}

async fn fallback_issue_assignees() -> ResponseJson<serde_json::Value> {
    ResponseJson(serde_json::json!({ "issue_assignees": [] }))
}

async fn fallback_issue_followers() -> ResponseJson<serde_json::Value> {
    ResponseJson(serde_json::json!({ "issue_followers": [] }))
}

async fn fallback_pull_requests() -> ResponseJson<serde_json::Value> {
    ResponseJson(serde_json::json!({ "pull_requests": [] }))
}

async fn fallback_organization_members() -> ResponseJson<serde_json::Value> {
    ResponseJson(serde_json::json!({ "organization_member_metadata": [] }))
}

async fn fallback_user_workspaces() -> ResponseJson<serde_json::Value> {
    ResponseJson(serde_json::json!({ "workspaces": [] }))
}

async fn fallback_project_workspaces() -> ResponseJson<serde_json::Value> {
    ResponseJson(serde_json::json!({ "workspaces": [] }))
}

async fn fallback_issue_comments() -> ResponseJson<serde_json::Value> {
    ResponseJson(serde_json::json!({ "issue_comments": [] }))
}

async fn fallback_issue_comment_reactions() -> ResponseJson<serde_json::Value> {
    ResponseJson(serde_json::json!({ "issue_comment_reactions": [] }))
}

async fn fallback_notifications() -> ResponseJson<serde_json::Value> {
    ResponseJson(serde_json::json!({ "notifications": [] }))
}

// ── Organizations ──────────────────────────────────────────────────

pub async fn fallback_organizations() -> ResponseJson<serde_json::Value> {
    let now = chrono::Utc::now().to_rfc3339();
    ResponseJson(serde_json::json!({
        "organizations": [{
            "id": "00000000-0000-0000-0000-000000000000",
            "name": "Local",
            "slug": "local",
            "is_personal": true,
            "issue_prefix": "LOCAL",
            "created_at": now,
            "updated_at": now,
            "user_role": "ADMIN"
        }]
    }))
}

// ── Users ───────────────────────────────────────────────────────────

#[derive(Serialize)]
struct LocalUser {
    id: Uuid,
    email: String,
    name: String,
}

async fn fallback_users() -> ResponseJson<serde_json::Value> {
    let user = LocalUser {
        id: Uuid::nil(),
        email: "local@localhost".to_string(),
        name: "Local User".to_string(),
    };
    ResponseJson(serde_json::json!({ "users": [user] }))
}
