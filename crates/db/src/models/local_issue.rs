use api_types::{
    CreateIssueRelationshipRequest, CreateIssueRequest, CreateIssueTagRequest, Issue,
    IssuePriority, IssueRelationship, IssueRelationshipType, IssueTag,
    ListIssueRelationshipsResponse, ListIssueTagsResponse, ListIssuesResponse,
    ListProjectStatusesResponse, ListProjectsResponse, MutationResponse, Project, ProjectStatus,
    UpdateIssueRequest,
};
use chrono::{DateTime, Utc};
use serde_json::Value;
use sqlx::{FromRow, SqlitePool};
use thiserror::Error;
use uuid::Uuid;

// ── Errors ──────────────────────────────────────────────────────────

#[derive(Debug, Error)]
pub enum LocalKanbanError {
    #[error(transparent)]
    Database(#[from] sqlx::Error),
    #[error("Project not found")]
    ProjectNotFound,
    #[error("Issue not found")]
    IssueNotFound,
    #[error("Status not found")]
    StatusNotFound,
}

// ── Internal row types ──────────────────────────────────────────────

#[derive(Debug, Clone, FromRow)]
struct LocalProjectRow {
    pub id: Uuid,
    pub name: String,
    pub color: String,
    pub sort_order: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl LocalProjectRow {
    fn into_api_project(self) -> Project {
        Project {
            id: self.id,
            organization_id: Uuid::nil(),
            name: self.name,
            color: self.color,
            sort_order: self.sort_order,
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
    }
}

#[derive(Debug, Clone, FromRow)]
struct LocalProjectStatusRow {
    pub id: Uuid,
    pub project_id: Uuid,
    pub name: String,
    pub color: String,
    pub sort_order: i32,
    pub hidden: bool,
    pub created_at: DateTime<Utc>,
}

impl LocalProjectStatusRow {
    fn into_api_status(self) -> ProjectStatus {
        ProjectStatus {
            id: self.id,
            project_id: self.project_id,
            name: self.name,
            color: self.color,
            sort_order: self.sort_order,
            hidden: self.hidden,
            created_at: self.created_at,
        }
    }
}

#[derive(Debug, Clone, FromRow)]
struct LocalIssueRow {
    pub id: Uuid,
    pub project_id: Uuid,
    pub status_id: Uuid,
    pub issue_number: i32,
    pub simple_id: String,
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub sort_order: f64,
    pub parent_issue_id: Option<Uuid>,
    pub parent_issue_sort_order: Option<f64>,
    pub start_date: Option<DateTime<Utc>>,
    pub target_date: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub extension_metadata: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl LocalIssueRow {
    fn into_api_issue(self) -> Issue {
        let priority = self.priority.as_deref().and_then(|p| match p {
            "urgent" => Some(IssuePriority::Urgent),
            "high" => Some(IssuePriority::High),
            "medium" => Some(IssuePriority::Medium),
            "low" => Some(IssuePriority::Low),
            _ => None,
        });
        let extension_metadata: Value = serde_json::from_str(&self.extension_metadata)
            .unwrap_or(Value::Object(Default::default()));
        Issue {
            id: self.id,
            project_id: self.project_id,
            issue_number: self.issue_number,
            simple_id: self.simple_id,
            status_id: self.status_id,
            title: self.title,
            description: self.description,
            priority,
            start_date: self.start_date,
            target_date: self.target_date,
            completed_at: self.completed_at,
            sort_order: self.sort_order,
            parent_issue_id: self.parent_issue_id,
            parent_issue_sort_order: self.parent_issue_sort_order,
            extension_metadata,
            creator_user_id: None,
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
    }
}

#[derive(Debug, Clone, FromRow)]
struct LocalIssueTagRow {
    pub id: Uuid,
    pub issue_id: Uuid,
    pub tag_id: Uuid,
}

impl LocalIssueTagRow {
    fn into_api_tag(self) -> IssueTag {
        IssueTag {
            id: self.id,
            issue_id: self.issue_id,
            tag_id: self.tag_id,
        }
    }
}

#[derive(Debug, Clone, FromRow)]
struct LocalIssueRelationshipRow {
    pub id: Uuid,
    pub issue_id: Uuid,
    pub related_issue_id: Uuid,
    pub relationship_type: String,
    pub created_at: DateTime<Utc>,
}

impl LocalIssueRelationshipRow {
    fn into_api_relationship(self) -> Option<IssueRelationship> {
        let relationship_type = match self.relationship_type.as_str() {
            "blocking" => IssueRelationshipType::Blocking,
            "related" => IssueRelationshipType::Related,
            "has_duplicate" => IssueRelationshipType::HasDuplicate,
            _ => return None,
        };
        Some(IssueRelationship {
            id: self.id,
            issue_id: self.issue_id,
            related_issue_id: self.related_issue_id,
            relationship_type,
            created_at: self.created_at,
        })
    }
}

// ── Project CRUD ────────────────────────────────────────────────────

pub struct LocalProject;

/// Default status columns seeded when a new local project is created.
const DEFAULT_STATUSES: &[(&str, &str, i32)] = &[
    ("Backlog", "#6b7280", 0),
    ("To Do", "#3b82f6", 1),
    ("In Progress", "#f59e0b", 2),
    ("Done", "#22c55e", 3),
];

impl LocalProject {
    pub async fn list(pool: &SqlitePool) -> Result<ListProjectsResponse, LocalKanbanError> {
        let rows = sqlx::query_as!(
            LocalProjectRow,
            r#"SELECT id AS "id!: Uuid",
                      name, color,
                      sort_order AS "sort_order!: i32",
                      created_at AS "created_at!: DateTime<Utc>",
                      updated_at AS "updated_at!: DateTime<Utc>"
               FROM local_projects ORDER BY sort_order ASC, created_at ASC"#
        )
        .fetch_all(pool)
        .await?;

        Ok(ListProjectsResponse {
            projects: rows.into_iter().map(|r| r.into_api_project()).collect(),
        })
    }

    pub async fn get(pool: &SqlitePool, id: Uuid) -> Result<Project, LocalKanbanError> {
        let row = sqlx::query_as!(
            LocalProjectRow,
            r#"SELECT id AS "id!: Uuid",
                      name, color,
                      sort_order AS "sort_order!: i32",
                      created_at AS "created_at!: DateTime<Utc>",
                      updated_at AS "updated_at!: DateTime<Utc>"
               FROM local_projects WHERE id = $1"#,
            id
        )
        .fetch_optional(pool)
        .await?
        .ok_or(LocalKanbanError::ProjectNotFound)?;

        Ok(row.into_api_project())
    }

    /// Creates a new local project and seeds default status columns.
    pub async fn create_with_defaults(
        pool: &SqlitePool,
        name: &str,
        color: &str,
    ) -> Result<(Project, Vec<ProjectStatus>), LocalKanbanError> {
        let project_id = Uuid::new_v4();

        sqlx::query!(
            r#"INSERT INTO local_projects (id, name, color) VALUES ($1, $2, $3)"#,
            project_id,
            name,
            color
        )
        .execute(pool)
        .await?;

        // Seed the issue counter
        sqlx::query!(
            r#"INSERT INTO local_issue_counters (project_id, next_number) VALUES ($1, 1)"#,
            project_id
        )
        .execute(pool)
        .await?;

        // Create default status columns
        let mut statuses = Vec::new();
        for (status_name, status_color, sort_order) in DEFAULT_STATUSES {
            let status_id = Uuid::new_v4();
            sqlx::query!(
                r#"INSERT INTO local_project_statuses (id, project_id, name, color, sort_order)
                   VALUES ($1, $2, $3, $4, $5)"#,
                status_id,
                project_id,
                status_name,
                status_color,
                sort_order,
            )
            .execute(pool)
            .await?;

            statuses.push(ProjectStatus {
                id: status_id,
                project_id,
                name: status_name.to_string(),
                color: status_color.to_string(),
                sort_order: *sort_order,
                hidden: false,
                created_at: Utc::now(),
            });
        }

        let project = Self::get(pool, project_id).await?;
        Ok((project, statuses))
    }
}

// ── Project Status CRUD ─────────────────────────────────────────────

pub struct LocalProjectStatus;

impl LocalProjectStatus {
    pub async fn list(
        pool: &SqlitePool,
        project_id: Uuid,
    ) -> Result<ListProjectStatusesResponse, LocalKanbanError> {
        let rows = sqlx::query_as!(
            LocalProjectStatusRow,
            r#"SELECT id AS "id!: Uuid",
                      project_id AS "project_id!: Uuid",
                      name, color,
                      sort_order AS "sort_order!: i32",
                      hidden AS "hidden!: bool",
                      created_at AS "created_at!: DateTime<Utc>"
               FROM local_project_statuses
               WHERE project_id = $1
               ORDER BY sort_order ASC"#,
            project_id
        )
        .fetch_all(pool)
        .await?;

        Ok(ListProjectStatusesResponse {
            project_statuses: rows.into_iter().map(|r| r.into_api_status()).collect(),
        })
    }
}

// ── Issue CRUD ──────────────────────────────────────────────────────

pub struct LocalIssue;

impl LocalIssue {
    pub async fn list(
        pool: &SqlitePool,
        project_id: Uuid,
    ) -> Result<ListIssuesResponse, LocalKanbanError> {
        let rows = sqlx::query_as!(
            LocalIssueRow,
            r#"SELECT id AS "id!: Uuid",
                      project_id AS "project_id!: Uuid",
                      status_id AS "status_id!: Uuid",
                      issue_number AS "issue_number!: i32",
                      simple_id,
                      title,
                      description,
                      priority,
                      sort_order AS "sort_order!: f64",
                      parent_issue_id AS "parent_issue_id: Uuid",
                      parent_issue_sort_order AS "parent_issue_sort_order: f64",
                      start_date AS "start_date: DateTime<Utc>",
                      target_date AS "target_date: DateTime<Utc>",
                      completed_at AS "completed_at: DateTime<Utc>",
                      extension_metadata,
                      created_at AS "created_at!: DateTime<Utc>",
                      updated_at AS "updated_at!: DateTime<Utc>"
               FROM local_issues
               WHERE project_id = $1
               ORDER BY sort_order ASC"#,
            project_id
        )
        .fetch_all(pool)
        .await?;

        Ok(ListIssuesResponse {
            issues: rows.into_iter().map(|r| r.into_api_issue()).collect(),
        })
    }

    pub async fn get(pool: &SqlitePool, id: Uuid) -> Result<Issue, LocalKanbanError> {
        let row = sqlx::query_as!(
            LocalIssueRow,
            r#"SELECT id AS "id!: Uuid",
                      project_id AS "project_id!: Uuid",
                      status_id AS "status_id!: Uuid",
                      issue_number AS "issue_number!: i32",
                      simple_id,
                      title,
                      description,
                      priority,
                      sort_order AS "sort_order!: f64",
                      parent_issue_id AS "parent_issue_id: Uuid",
                      parent_issue_sort_order AS "parent_issue_sort_order: f64",
                      start_date AS "start_date: DateTime<Utc>",
                      target_date AS "target_date: DateTime<Utc>",
                      completed_at AS "completed_at: DateTime<Utc>",
                      extension_metadata,
                      created_at AS "created_at!: DateTime<Utc>",
                      updated_at AS "updated_at!: DateTime<Utc>"
               FROM local_issues WHERE id = $1"#,
            id
        )
        .fetch_optional(pool)
        .await?
        .ok_or(LocalKanbanError::IssueNotFound)?;

        Ok(row.into_api_issue())
    }

    pub async fn create(
        pool: &SqlitePool,
        request: &CreateIssueRequest,
    ) -> Result<MutationResponse<Issue>, LocalKanbanError> {
        let id = request.id.unwrap_or_else(Uuid::new_v4);

        // Atomically fetch-and-increment the issue counter
        let counter = sqlx::query_scalar!(
            r#"UPDATE local_issue_counters
               SET next_number = next_number + 1
               WHERE project_id = $1
               RETURNING next_number - 1 AS "num!: i32""#,
            request.project_id
        )
        .fetch_one(pool)
        .await?;

        // Build simple_id like "PROJ-1" using project name prefix
        let project_name = sqlx::query_scalar!(
            r#"SELECT name FROM local_projects WHERE id = $1"#,
            request.project_id
        )
        .fetch_optional(pool)
        .await?
        .unwrap_or_else(|| "PROJ".to_string());

        let prefix: String = project_name
            .chars()
            .filter(|c| c.is_alphanumeric())
            .take(4)
            .collect::<String>()
            .to_uppercase();
        let prefix = if prefix.is_empty() {
            "PROJ".to_string()
        } else {
            prefix
        };
        let simple_id = format!("{}-{}", prefix, counter);

        let priority_str = request.priority.map(|p| match p {
            IssuePriority::Urgent => "urgent",
            IssuePriority::High => "high",
            IssuePriority::Medium => "medium",
            IssuePriority::Low => "low",
        });

        let ext_meta = serde_json::to_string(&request.extension_metadata).unwrap_or_default();
        let start_date_str = request.start_date.map(|d| d.to_rfc3339());
        let target_date_str = request.target_date.map(|d| d.to_rfc3339());
        let completed_at_str = request.completed_at.map(|d| d.to_rfc3339());

        sqlx::query!(
            r#"INSERT INTO local_issues
               (id, project_id, status_id, issue_number, simple_id, title, description,
                priority, sort_order, parent_issue_id, parent_issue_sort_order,
                start_date, target_date, completed_at, extension_metadata)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)"#,
            id,
            request.project_id,
            request.status_id,
            counter,
            simple_id,
            request.title,
            request.description,
            priority_str,
            request.sort_order,
            request.parent_issue_id,
            request.parent_issue_sort_order,
            start_date_str,
            target_date_str,
            completed_at_str,
            ext_meta,
        )
        .execute(pool)
        .await?;

        let issue = Self::get(pool, id).await?;
        Ok(MutationResponse {
            data: issue,
            txid: 0,
        })
    }

    pub async fn update(
        pool: &SqlitePool,
        id: Uuid,
        request: &UpdateIssueRequest,
    ) -> Result<MutationResponse<Issue>, LocalKanbanError> {
        let existing = Self::get(pool, id).await?;

        fn priority_to_str(p: IssuePriority) -> String {
            match p {
                IssuePriority::Urgent => "urgent".to_string(),
                IssuePriority::High => "high".to_string(),
                IssuePriority::Medium => "medium".to_string(),
                IssuePriority::Low => "low".to_string(),
            }
        }

        fn date_to_str(d: DateTime<Utc>) -> String {
            d.to_rfc3339()
        }

        let status_id = request.status_id.unwrap_or(existing.status_id);
        let title = request.title.clone().unwrap_or(existing.title);
        let description: Option<String> = match &request.description {
            Some(d) => d.clone(),
            None => existing.description,
        };
        let priority_str: Option<String> = match request.priority {
            Some(p) => p.map(priority_to_str),
            None => existing.priority.map(priority_to_str),
        };
        let sort_order = request.sort_order.unwrap_or(existing.sort_order);
        let parent_issue_id: Option<Uuid> = match request.parent_issue_id {
            Some(p) => p,
            None => existing.parent_issue_id,
        };
        let parent_issue_sort_order: Option<f64> = match request.parent_issue_sort_order {
            Some(p) => p,
            None => existing.parent_issue_sort_order,
        };
        let start_date_str: Option<String> = match request.start_date {
            Some(d) => d.map(date_to_str),
            None => existing.start_date.map(date_to_str),
        };
        let target_date_str: Option<String> = match request.target_date {
            Some(d) => d.map(date_to_str),
            None => existing.target_date.map(date_to_str),
        };
        let completed_at_str: Option<String> = match request.completed_at {
            Some(d) => d.map(date_to_str),
            None => existing.completed_at.map(date_to_str),
        };
        let ext_meta = match &request.extension_metadata {
            Some(m) => serde_json::to_string(m).unwrap_or_default(),
            None => serde_json::to_string(&existing.extension_metadata).unwrap_or_default(),
        };

        sqlx::query!(
            r#"UPDATE local_issues SET
               status_id = $2, title = $3, description = $4, priority = $5,
               sort_order = $6, parent_issue_id = $7, parent_issue_sort_order = $8,
               start_date = $9, target_date = $10, completed_at = $11,
               extension_metadata = $12,
               updated_at = datetime('now', 'subsec')
               WHERE id = $1"#,
            id,
            status_id,
            title,
            description,
            priority_str,
            sort_order,
            parent_issue_id,
            parent_issue_sort_order,
            start_date_str,
            target_date_str,
            completed_at_str,
            ext_meta,
        )
        .execute(pool)
        .await?;

        let issue = Self::get(pool, id).await?;
        Ok(MutationResponse {
            data: issue,
            txid: 0,
        })
    }

    pub async fn delete(pool: &SqlitePool, id: Uuid) -> Result<(), LocalKanbanError> {
        let result = sqlx::query!("DELETE FROM local_issues WHERE id = $1", id)
            .execute(pool)
            .await?;
        if result.rows_affected() == 0 {
            return Err(LocalKanbanError::IssueNotFound);
        }
        Ok(())
    }
}

// ── Issue Tag CRUD ──────────────────────────────────────────────────

pub struct LocalIssueTag;

impl LocalIssueTag {
    pub async fn list(
        pool: &SqlitePool,
        issue_id: Uuid,
    ) -> Result<ListIssueTagsResponse, LocalKanbanError> {
        let rows = sqlx::query_as!(
            LocalIssueTagRow,
            r#"SELECT id AS "id!: Uuid",
                      issue_id AS "issue_id!: Uuid",
                      tag_id AS "tag_id!: Uuid"
               FROM local_issue_tags WHERE issue_id = $1"#,
            issue_id
        )
        .fetch_all(pool)
        .await?;

        Ok(ListIssueTagsResponse {
            issue_tags: rows.into_iter().map(|r| r.into_api_tag()).collect(),
        })
    }

    pub async fn get(pool: &SqlitePool, id: Uuid) -> Result<IssueTag, LocalKanbanError> {
        let row = sqlx::query_as!(
            LocalIssueTagRow,
            r#"SELECT id AS "id!: Uuid",
                      issue_id AS "issue_id!: Uuid",
                      tag_id AS "tag_id!: Uuid"
               FROM local_issue_tags WHERE id = $1"#,
            id
        )
        .fetch_optional(pool)
        .await?
        .ok_or(LocalKanbanError::IssueNotFound)?;

        Ok(row.into_api_tag())
    }

    pub async fn create(
        pool: &SqlitePool,
        request: &CreateIssueTagRequest,
    ) -> Result<MutationResponse<IssueTag>, LocalKanbanError> {
        let id = request.id.unwrap_or_else(Uuid::new_v4);
        sqlx::query!(
            r#"INSERT INTO local_issue_tags (id, issue_id, tag_id) VALUES ($1, $2, $3)"#,
            id,
            request.issue_id,
            request.tag_id
        )
        .execute(pool)
        .await?;

        let tag = Self::get(pool, id).await?;
        Ok(MutationResponse { data: tag, txid: 0 })
    }

    pub async fn delete(pool: &SqlitePool, id: Uuid) -> Result<(), LocalKanbanError> {
        sqlx::query!("DELETE FROM local_issue_tags WHERE id = $1", id)
            .execute(pool)
            .await?;
        Ok(())
    }
}

// ── Issue Relationship CRUD ─────────────────────────────────────────

pub struct LocalIssueRelationship;

impl LocalIssueRelationship {
    pub async fn list(
        pool: &SqlitePool,
        issue_id: Uuid,
    ) -> Result<ListIssueRelationshipsResponse, LocalKanbanError> {
        let rows = sqlx::query_as!(
            LocalIssueRelationshipRow,
            r#"SELECT id AS "id!: Uuid",
                      issue_id AS "issue_id!: Uuid",
                      related_issue_id AS "related_issue_id!: Uuid",
                      relationship_type,
                      created_at AS "created_at!: DateTime<Utc>"
               FROM local_issue_relationships WHERE issue_id = $1"#,
            issue_id
        )
        .fetch_all(pool)
        .await?;

        Ok(ListIssueRelationshipsResponse {
            issue_relationships: rows
                .into_iter()
                .filter_map(|r| r.into_api_relationship())
                .collect(),
        })
    }

    pub async fn create(
        pool: &SqlitePool,
        request: &CreateIssueRelationshipRequest,
    ) -> Result<MutationResponse<IssueRelationship>, LocalKanbanError> {
        let id = request.id.unwrap_or_else(Uuid::new_v4);
        let rel_type = match request.relationship_type {
            IssueRelationshipType::Blocking => "blocking",
            IssueRelationshipType::Related => "related",
            IssueRelationshipType::HasDuplicate => "has_duplicate",
        };

        sqlx::query!(
            r#"INSERT INTO local_issue_relationships (id, issue_id, related_issue_id, relationship_type)
               VALUES ($1, $2, $3, $4)"#,
            id,
            request.issue_id,
            request.related_issue_id,
            rel_type
        )
        .execute(pool)
        .await?;

        // Re-fetch
        let row = sqlx::query_as!(
            LocalIssueRelationshipRow,
            r#"SELECT id AS "id!: Uuid",
                      issue_id AS "issue_id!: Uuid",
                      related_issue_id AS "related_issue_id!: Uuid",
                      relationship_type,
                      created_at AS "created_at!: DateTime<Utc>"
               FROM local_issue_relationships WHERE id = $1"#,
            id
        )
        .fetch_one(pool)
        .await?;

        let relationship = row
            .into_api_relationship()
            .ok_or(LocalKanbanError::IssueNotFound)?;
        Ok(MutationResponse {
            data: relationship,
            txid: 0,
        })
    }

    pub async fn delete(pool: &SqlitePool, id: Uuid) -> Result<(), LocalKanbanError> {
        sqlx::query!("DELETE FROM local_issue_relationships WHERE id = $1", id)
            .execute(pool)
            .await?;
        Ok(())
    }
}
