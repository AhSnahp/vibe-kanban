use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use thiserror::Error;
use ts_rs::TS;
use uuid::Uuid;

// ── Errors ──────────────────────────────────────────────────────────

#[derive(Debug, Error)]
pub enum BrainstormError {
    #[error(transparent)]
    Database(#[from] sqlx::Error),
    #[error("Session not found")]
    SessionNotFound,
    #[error("API key not configured")]
    ApiKeyMissing,
    #[error("Anthropic API error: {0}")]
    AnthropicApi(String),
    #[error("Rate limited")]
    RateLimit,
}

// ── Enums ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum BrainstormStatus {
    Active,
    Archived,
    Converted,
}

impl std::fmt::Display for BrainstormStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Active => write!(f, "active"),
            Self::Archived => write!(f, "archived"),
            Self::Converted => write!(f, "converted"),
        }
    }
}

impl std::str::FromStr for BrainstormStatus {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "active" => Ok(Self::Active),
            "archived" => Ok(Self::Archived),
            "converted" => Ok(Self::Converted),
            _ => Err(format!("Unknown brainstorm status: {}", s)),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum BrainstormRole {
    User,
    Assistant,
}

impl std::fmt::Display for BrainstormRole {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::User => write!(f, "user"),
            Self::Assistant => write!(f, "assistant"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum BrainstormContextType {
    Repo,
    File,
    Project,
}

impl std::fmt::Display for BrainstormContextType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Repo => write!(f, "repo"),
            Self::File => write!(f, "file"),
            Self::Project => write!(f, "project"),
        }
    }
}

// ── DB Models ───────────────────────────────────────────────────────

#[derive(Debug, Clone, FromRow)]
struct BrainstormSessionRow {
    pub id: Uuid,
    pub title: Option<String>,
    pub system_prompt: Option<String>,
    pub project_id: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct BrainstormSession {
    pub id: Uuid,
    pub title: Option<String>,
    pub system_prompt: Option<String>,
    pub project_id: Option<String>,
    pub status: BrainstormStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl TryFrom<BrainstormSessionRow> for BrainstormSession {
    type Error = BrainstormError;
    fn try_from(row: BrainstormSessionRow) -> Result<Self, Self::Error> {
        let status = row
            .status
            .parse::<BrainstormStatus>()
            .map_err(|e| BrainstormError::AnthropicApi(e))?;
        Ok(Self {
            id: row.id,
            title: row.title,
            system_prompt: row.system_prompt,
            project_id: row.project_id,
            status,
            created_at: row.created_at,
            updated_at: row.updated_at,
        })
    }
}

#[derive(Debug, Clone, FromRow)]
struct BrainstormMessageRow {
    pub id: Uuid,
    pub session_id: Uuid,
    pub role: String,
    pub content: String,
    pub thinking: Option<String>,
    pub model: Option<String>,
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub thinking_tokens: Option<i64>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct BrainstormMessage {
    pub id: Uuid,
    pub session_id: Uuid,
    pub role: BrainstormRole,
    pub content: String,
    pub thinking: Option<String>,
    pub model: Option<String>,
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub thinking_tokens: Option<i64>,
    pub created_at: DateTime<Utc>,
}

impl TryFrom<BrainstormMessageRow> for BrainstormMessage {
    type Error = BrainstormError;
    fn try_from(row: BrainstormMessageRow) -> Result<Self, Self::Error> {
        let role = match row.role.as_str() {
            "user" => BrainstormRole::User,
            "assistant" => BrainstormRole::Assistant,
            other => {
                return Err(BrainstormError::AnthropicApi(format!(
                    "Unknown role: {}",
                    other
                )));
            }
        };
        Ok(Self {
            id: row.id,
            session_id: row.session_id,
            role,
            content: row.content,
            thinking: row.thinking,
            model: row.model,
            input_tokens: row.input_tokens,
            output_tokens: row.output_tokens,
            thinking_tokens: row.thinking_tokens,
            created_at: row.created_at,
        })
    }
}

#[derive(Debug, Clone, FromRow)]
struct BrainstormContextRow {
    pub id: Uuid,
    pub session_id: Uuid,
    pub context_type: String,
    pub reference_id: Option<String>,
    pub display_name: String,
    pub content_snapshot: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct BrainstormContext {
    pub id: Uuid,
    pub session_id: Uuid,
    pub context_type: BrainstormContextType,
    pub reference_id: Option<String>,
    pub display_name: String,
    pub content_snapshot: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl TryFrom<BrainstormContextRow> for BrainstormContext {
    type Error = BrainstormError;
    fn try_from(row: BrainstormContextRow) -> Result<Self, Self::Error> {
        let context_type = match row.context_type.as_str() {
            "repo" => BrainstormContextType::Repo,
            "file" => BrainstormContextType::File,
            "project" => BrainstormContextType::Project,
            other => {
                return Err(BrainstormError::AnthropicApi(format!(
                    "Unknown context type: {}",
                    other
                )));
            }
        };
        Ok(Self {
            id: row.id,
            session_id: row.session_id,
            context_type,
            reference_id: row.reference_id,
            display_name: row.display_name,
            content_snapshot: row.content_snapshot,
            created_at: row.created_at,
        })
    }
}

// ── Request/Response Types ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct CreateBrainstormSession {
    pub title: Option<String>,
    pub system_prompt: Option<String>,
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct UpdateBrainstormSession {
    pub title: Option<String>,
    pub status: Option<BrainstormStatus>,
    pub system_prompt: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct BrainstormSessionDetail {
    pub session: BrainstormSession,
    pub messages: Vec<BrainstormMessage>,
    pub context: Vec<BrainstormContext>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct BrainstormSendRequest {
    pub message: String,
    #[serde(default = "default_budget_tokens")]
    pub budget_tokens: i64,
}

fn default_budget_tokens() -> i64 {
    10000
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct AddBrainstormContextRequest {
    pub context_type: BrainstormContextType,
    pub reference_id: Option<String>,
    pub display_name: String,
    pub content_snapshot: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct BrainstormPlanItem {
    pub title: String,
    pub description: String,
    pub priority: Option<String>,
    pub estimated_effort: Option<String>,
    pub dependencies: Vec<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct BrainstormPlan {
    pub project_name: String,
    pub project_description: String,
    pub items: Vec<BrainstormPlanItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct PushPlanRequest {
    pub project_id: Option<String>,
    pub new_project_name: Option<String>,
    pub create_repo: bool,
    pub repo_path: Option<String>,
    pub items: Vec<BrainstormPlanItem>,
    pub auto_create_workspaces: bool,
    pub repo_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct PushPlanResponse {
    pub project_id: String,
    pub issue_ids: Vec<String>,
    pub workspace_ids: Vec<String>,
    pub repo_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(tag = "type", content = "data")]
pub enum BrainstormStreamEvent {
    TextDelta { text: String },
    ThinkingDelta { thinking: String },
    MessageComplete { message: BrainstormMessage },
    Error { error: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct BrainstormStatusResponse {
    pub available: bool,
}

// ── CRUD Methods ────────────────────────────────────────────────────

impl BrainstormSession {
    pub async fn find_all(pool: &SqlitePool) -> Result<Vec<Self>, BrainstormError> {
        let rows = sqlx::query_as!(
            BrainstormSessionRow,
            r#"SELECT id AS "id!: Uuid",
                      title,
                      system_prompt,
                      project_id,
                      status,
                      created_at AS "created_at!: DateTime<Utc>",
                      updated_at AS "updated_at!: DateTime<Utc>"
               FROM brainstorm_sessions
               ORDER BY updated_at DESC"#
        )
        .fetch_all(pool)
        .await?;

        rows.into_iter().map(|r| r.try_into()).collect()
    }

    pub async fn find_by_id(pool: &SqlitePool, id: Uuid) -> Result<Option<Self>, BrainstormError> {
        let row = sqlx::query_as!(
            BrainstormSessionRow,
            r#"SELECT id AS "id!: Uuid",
                      title,
                      system_prompt,
                      project_id,
                      status,
                      created_at AS "created_at!: DateTime<Utc>",
                      updated_at AS "updated_at!: DateTime<Utc>"
               FROM brainstorm_sessions
               WHERE id = $1"#,
            id
        )
        .fetch_optional(pool)
        .await?;

        row.map(|r| r.try_into()).transpose()
    }

    pub async fn create(
        pool: &SqlitePool,
        id: Uuid,
        data: &CreateBrainstormSession,
    ) -> Result<Self, BrainstormError> {
        let row = sqlx::query_as!(
            BrainstormSessionRow,
            r#"INSERT INTO brainstorm_sessions (id, title, system_prompt, project_id)
               VALUES ($1, $2, $3, $4)
               RETURNING id AS "id!: Uuid",
                         title,
                         system_prompt,
                         project_id,
                         status,
                         created_at AS "created_at!: DateTime<Utc>",
                         updated_at AS "updated_at!: DateTime<Utc>""#,
            id,
            data.title,
            data.system_prompt,
            data.project_id
        )
        .fetch_one(pool)
        .await?;

        row.try_into()
    }

    pub async fn update(
        pool: &SqlitePool,
        id: Uuid,
        data: &UpdateBrainstormSession,
    ) -> Result<Self, BrainstormError> {
        let status_str = data.status.as_ref().map(|s| s.to_string());
        let row = sqlx::query_as!(
            BrainstormSessionRow,
            r#"UPDATE brainstorm_sessions
               SET title = COALESCE($2, title),
                   status = COALESCE($3, status),
                   system_prompt = COALESCE($4, system_prompt),
                   updated_at = datetime('now', 'subsec')
               WHERE id = $1
               RETURNING id AS "id!: Uuid",
                         title,
                         system_prompt,
                         project_id,
                         status,
                         created_at AS "created_at!: DateTime<Utc>",
                         updated_at AS "updated_at!: DateTime<Utc>""#,
            id,
            data.title,
            status_str,
            data.system_prompt
        )
        .fetch_optional(pool)
        .await?
        .ok_or(BrainstormError::SessionNotFound)?;

        row.try_into()
    }

    pub async fn delete(pool: &SqlitePool, id: Uuid) -> Result<u64, sqlx::Error> {
        let result = sqlx::query!("DELETE FROM brainstorm_sessions WHERE id = $1", id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected())
    }
}

impl BrainstormMessage {
    pub async fn find_by_session_id(
        pool: &SqlitePool,
        session_id: Uuid,
    ) -> Result<Vec<Self>, BrainstormError> {
        let rows = sqlx::query_as!(
            BrainstormMessageRow,
            r#"SELECT id AS "id!: Uuid",
                      session_id AS "session_id!: Uuid",
                      role,
                      content,
                      thinking,
                      model,
                      input_tokens,
                      output_tokens,
                      thinking_tokens,
                      created_at AS "created_at!: DateTime<Utc>"
               FROM brainstorm_messages
               WHERE session_id = $1
               ORDER BY created_at ASC"#,
            session_id
        )
        .fetch_all(pool)
        .await?;

        rows.into_iter().map(|r| r.try_into()).collect()
    }

    pub async fn create(
        pool: &SqlitePool,
        id: Uuid,
        session_id: Uuid,
        role: &BrainstormRole,
        content: &str,
        thinking: Option<&str>,
        model: Option<&str>,
        input_tokens: Option<i64>,
        output_tokens: Option<i64>,
        thinking_tokens: Option<i64>,
    ) -> Result<Self, BrainstormError> {
        let role_str = role.to_string();
        let row = sqlx::query_as!(
            BrainstormMessageRow,
            r#"INSERT INTO brainstorm_messages
               (id, session_id, role, content, thinking, model, input_tokens, output_tokens, thinking_tokens)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               RETURNING id AS "id!: Uuid",
                         session_id AS "session_id!: Uuid",
                         role,
                         content,
                         thinking,
                         model,
                         input_tokens,
                         output_tokens,
                         thinking_tokens,
                         created_at AS "created_at!: DateTime<Utc>""#,
            id,
            session_id,
            role_str,
            content,
            thinking,
            model,
            input_tokens,
            output_tokens,
            thinking_tokens
        )
        .fetch_one(pool)
        .await?;

        row.try_into()
    }
}

impl BrainstormContext {
    pub async fn find_by_session_id(
        pool: &SqlitePool,
        session_id: Uuid,
    ) -> Result<Vec<Self>, BrainstormError> {
        let rows = sqlx::query_as!(
            BrainstormContextRow,
            r#"SELECT id AS "id!: Uuid",
                      session_id AS "session_id!: Uuid",
                      context_type,
                      reference_id,
                      display_name,
                      content_snapshot,
                      created_at AS "created_at!: DateTime<Utc>"
               FROM brainstorm_context
               WHERE session_id = $1
               ORDER BY created_at ASC"#,
            session_id
        )
        .fetch_all(pool)
        .await?;

        rows.into_iter().map(|r| r.try_into()).collect()
    }

    pub async fn create(
        pool: &SqlitePool,
        id: Uuid,
        session_id: Uuid,
        data: &AddBrainstormContextRequest,
    ) -> Result<Self, BrainstormError> {
        let context_type_str = data.context_type.to_string();
        let row = sqlx::query_as!(
            BrainstormContextRow,
            r#"INSERT INTO brainstorm_context
               (id, session_id, context_type, reference_id, display_name, content_snapshot)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING id AS "id!: Uuid",
                         session_id AS "session_id!: Uuid",
                         context_type,
                         reference_id,
                         display_name,
                         content_snapshot,
                         created_at AS "created_at!: DateTime<Utc>""#,
            id,
            session_id,
            context_type_str,
            data.reference_id,
            data.display_name,
            data.content_snapshot
        )
        .fetch_one(pool)
        .await?;

        row.try_into()
    }

    pub async fn delete(pool: &SqlitePool, id: Uuid) -> Result<u64, sqlx::Error> {
        let result = sqlx::query!("DELETE FROM brainstorm_context WHERE id = $1", id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected())
    }
}
