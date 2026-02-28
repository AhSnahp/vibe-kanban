use std::env;

use db::models::brainstorm::{
    BrainstormContext, BrainstormError, BrainstormMessage, BrainstormRole, BrainstormSession,
    BrainstormStreamEvent,
};
use futures::stream::{self, BoxStream};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

#[derive(Clone)]
pub struct BrainstormService {
    api_key: Option<String>,
    http_client: Client,
}

// ── Anthropic API types ─────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: i64,
    messages: Vec<AnthropicMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<String>,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    thinking: Option<ThinkingConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<Vec<AnthropicTool>>,
}

#[derive(Debug, Serialize)]
struct ThinkingConfig {
    #[serde(rename = "type")]
    thinking_type: String,
    budget_tokens: i64,
}

#[derive(Debug, Serialize)]
struct AnthropicMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct AnthropicTool {
    name: String,
    description: String,
    input_schema: serde_json::Value,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct AnthropicStreamEvent {
    #[serde(rename = "type")]
    event_type: String,
    #[serde(default)]
    index: Option<i64>,
    #[serde(default)]
    delta: Option<AnthropicDelta>,
    #[serde(default)]
    content_block: Option<AnthropicContentBlock>,
    #[serde(default)]
    message: Option<AnthropicResponseMessage>,
    #[serde(default)]
    usage: Option<AnthropicUsage>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct AnthropicDelta {
    #[serde(rename = "type")]
    #[serde(default)]
    delta_type: Option<String>,
    #[serde(default)]
    text: Option<String>,
    #[serde(default)]
    thinking: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AnthropicContentBlock {
    #[serde(rename = "type")]
    block_type: String,
}

#[derive(Debug, Deserialize)]
struct AnthropicResponseMessage {
    #[serde(default)]
    model: Option<String>,
    #[serde(default)]
    usage: Option<AnthropicUsage>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct AnthropicUsage {
    #[serde(default)]
    input_tokens: Option<i64>,
    #[serde(default)]
    output_tokens: Option<i64>,
}

// ── Non-streaming response for plan extraction ──────────────────────

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct AnthropicNonStreamResponse {
    content: Vec<AnthropicNonStreamContent>,
    model: String,
    usage: AnthropicUsage,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct AnthropicNonStreamContent {
    #[serde(rename = "type")]
    content_type: String,
    #[serde(default)]
    text: Option<String>,
    #[serde(default)]
    input: Option<serde_json::Value>,
}

// ── Default system prompt ───────────────────────────────────────────

const DEFAULT_SYSTEM_PROMPT: &str = r#"You are a senior software architect and project planning specialist. Help the user brainstorm, design, and plan software projects through deep, challenging multi-round discussion.

Your approach:
- Challenge assumptions and explore alternatives
- Ask probing questions to refine requirements
- Consider technical trade-offs explicitly
- Build toward a concrete, actionable implementation plan
- When the plan is mature, structure it as discrete tasks with clear scope"#;

impl BrainstormService {
    pub fn new() -> Self {
        let api_key = env::var("ANTHROPIC_API_KEY").ok();
        Self {
            api_key,
            http_client: Client::new(),
        }
    }

    pub fn is_available(&self) -> bool {
        self.api_key.is_some()
    }

    fn api_key(&self) -> Result<&str, BrainstormError> {
        self.api_key
            .as_deref()
            .ok_or(BrainstormError::ApiKeyMissing)
    }

    fn build_system_prompt(
        session: &BrainstormSession,
        context_items: &[BrainstormContext],
    ) -> String {
        let base = session
            .system_prompt
            .as_deref()
            .unwrap_or(DEFAULT_SYSTEM_PROMPT);

        if context_items.is_empty() {
            return base.to_string();
        }

        let mut context_section = String::from("\n\n## Project Context\n");
        for ctx in context_items {
            context_section.push_str(&format!(
                "\n### {} ({})\n",
                ctx.display_name, ctx.context_type
            ));
            if let Some(snapshot) = &ctx.content_snapshot {
                context_section.push_str(snapshot);
                context_section.push('\n');
            }
        }

        format!("{}{}", base, context_section)
    }

    pub async fn send_message(
        &self,
        pool: &SqlitePool,
        session_id: Uuid,
        user_message: &str,
        budget_tokens: i64,
    ) -> Result<BoxStream<'static, BrainstormStreamEvent>, BrainstormError> {
        let api_key = self.api_key()?.to_string();

        // Load session
        let session = BrainstormSession::find_by_id(pool, session_id)
            .await?
            .ok_or(BrainstormError::SessionNotFound)?;

        // Load context
        let context_items = BrainstormContext::find_by_session_id(pool, session_id).await?;

        // Load conversation history
        let messages = BrainstormMessage::find_by_session_id(pool, session_id).await?;

        // Save user message to DB
        let user_msg_id = Uuid::new_v4();
        BrainstormMessage::create(
            pool,
            user_msg_id,
            session_id,
            &BrainstormRole::User,
            user_message,
            None,
            None,
            None,
            None,
            None,
        )
        .await?;

        // Build API messages
        let system_prompt = Self::build_system_prompt(&session, &context_items);
        let mut api_messages: Vec<AnthropicMessage> = messages
            .iter()
            .map(|m| AnthropicMessage {
                role: m.role.to_string(),
                content: m.content.clone(),
            })
            .collect();
        api_messages.push(AnthropicMessage {
            role: "user".to_string(),
            content: user_message.to_string(),
        });

        // Clamp budget_tokens to Anthropic's valid range (1024..max_tokens)
        let max_tokens: i64 = 16000;
        let budget_tokens = budget_tokens.clamp(1024, max_tokens - 1);

        let request_body = AnthropicRequest {
            model: "claude-opus-4-6".to_string(),
            max_tokens,
            messages: api_messages,
            system: Some(system_prompt),
            stream: true,
            thinking: Some(ThinkingConfig {
                thinking_type: "enabled".to_string(),
                budget_tokens,
            }),
            tools: None,
        };

        let response = self
            .http_client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&request_body)
            .send()
            .await
            .map_err(|e| BrainstormError::AnthropicApi(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status().as_u16();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            if status == 429 {
                return Err(BrainstormError::RateLimit);
            }
            return Err(BrainstormError::AnthropicApi(format!(
                "HTTP {}: {}",
                status, body
            )));
        }

        // Stream SSE events
        let pool = pool.clone();
        let bytes_stream = response.bytes_stream();

        let stream = {
            let text_acc = String::new();
            let thinking_acc = String::new();
            let model = String::new();
            let input_tokens: Option<i64> = None;
            let output_tokens: Option<i64> = None;
            let buffer = String::new();
            let current_block_type: Option<String> = None;

            stream::unfold(
                (
                    bytes_stream,
                    buffer,
                    text_acc,
                    thinking_acc,
                    model,
                    input_tokens,
                    output_tokens,
                    current_block_type,
                    false,
                    pool,
                    session_id,
                ),
                move |(
                    mut bytes_stream,
                    mut buffer,
                    mut text_acc,
                    mut thinking_acc,
                    mut model,
                    mut input_tokens,
                    mut output_tokens,
                    mut current_block_type,
                    done,
                    pool,
                    session_id,
                )| async move {
                    if done {
                        return None;
                    }

                    loop {
                        // Try to parse a complete SSE event from the buffer
                        if let Some(event) = extract_sse_event(&mut buffer) {
                            if let Some(parsed) = parse_sse_data(&event) {
                                match parsed.event_type.as_str() {
                                    "content_block_start" => {
                                        if let Some(block) = &parsed.content_block {
                                            current_block_type = Some(block.block_type.clone());
                                        }
                                    }
                                    "content_block_delta" => {
                                        if let Some(delta) = &parsed.delta {
                                            if let Some(text) = &delta.text {
                                                text_acc.push_str(text);
                                                let evt = BrainstormStreamEvent::TextDelta {
                                                    text: text.clone(),
                                                };
                                                return Some((
                                                    evt,
                                                    (
                                                        bytes_stream,
                                                        buffer,
                                                        text_acc,
                                                        thinking_acc,
                                                        model,
                                                        input_tokens,
                                                        output_tokens,
                                                        current_block_type,
                                                        false,
                                                        pool,
                                                        session_id,
                                                    ),
                                                ));
                                            }
                                            if let Some(thinking) = &delta.thinking {
                                                thinking_acc.push_str(thinking);
                                                let evt = BrainstormStreamEvent::ThinkingDelta {
                                                    thinking: thinking.clone(),
                                                };
                                                return Some((
                                                    evt,
                                                    (
                                                        bytes_stream,
                                                        buffer,
                                                        text_acc,
                                                        thinking_acc,
                                                        model,
                                                        input_tokens,
                                                        output_tokens,
                                                        current_block_type,
                                                        false,
                                                        pool,
                                                        session_id,
                                                    ),
                                                ));
                                            }
                                        }
                                    }
                                    "message_start" => {
                                        if let Some(msg) = &parsed.message {
                                            if let Some(m) = &msg.model {
                                                model = m.clone();
                                            }
                                            if let Some(usage) = &msg.usage {
                                                input_tokens = usage.input_tokens;
                                            }
                                        }
                                    }
                                    "message_delta" => {
                                        if let Some(usage) = &parsed.usage {
                                            if let Some(out) = usage.output_tokens {
                                                output_tokens = Some(out);
                                            }
                                        }
                                    }
                                    "message_stop" => {
                                        // Save the complete message to DB
                                        let thinking_opt = if thinking_acc.is_empty() {
                                            None
                                        } else {
                                            Some(thinking_acc.as_str())
                                        };
                                        let model_opt = if model.is_empty() {
                                            None
                                        } else {
                                            Some(model.as_str())
                                        };

                                        let msg_id = Uuid::new_v4();
                                        match BrainstormMessage::create(
                                            &pool,
                                            msg_id,
                                            session_id,
                                            &BrainstormRole::Assistant,
                                            &text_acc,
                                            thinking_opt,
                                            model_opt,
                                            input_tokens,
                                            output_tokens,
                                            None, // thinking tokens not easily extractable from stream
                                        )
                                        .await
                                        {
                                            Ok(saved_msg) => {
                                                let evt = BrainstormStreamEvent::MessageComplete {
                                                    message: saved_msg,
                                                };
                                                return Some((
                                                    evt,
                                                    (
                                                        bytes_stream,
                                                        buffer,
                                                        text_acc,
                                                        thinking_acc,
                                                        model,
                                                        input_tokens,
                                                        output_tokens,
                                                        current_block_type,
                                                        true,
                                                        pool,
                                                        session_id,
                                                    ),
                                                ));
                                            }
                                            Err(e) => {
                                                let evt = BrainstormStreamEvent::Error {
                                                    error: format!("Failed to save message: {}", e),
                                                };
                                                return Some((
                                                    evt,
                                                    (
                                                        bytes_stream,
                                                        buffer,
                                                        text_acc,
                                                        thinking_acc,
                                                        model,
                                                        input_tokens,
                                                        output_tokens,
                                                        current_block_type,
                                                        true,
                                                        pool,
                                                        session_id,
                                                    ),
                                                ));
                                            }
                                        }
                                    }
                                    "error" => {
                                        let evt = BrainstormStreamEvent::Error {
                                            error: format!("Anthropic API error: {:?}", parsed),
                                        };
                                        return Some((
                                            evt,
                                            (
                                                bytes_stream,
                                                buffer,
                                                text_acc,
                                                thinking_acc,
                                                model,
                                                input_tokens,
                                                output_tokens,
                                                current_block_type,
                                                true,
                                                pool,
                                                session_id,
                                            ),
                                        ));
                                    }
                                    _ => {
                                        // ping, content_block_stop, etc. - ignore
                                    }
                                }
                            }
                            continue;
                        }

                        // Need more data from the stream
                        use futures::TryStreamExt;
                        match bytes_stream.try_next().await {
                            Ok(Some(chunk)) => {
                                buffer.push_str(&String::from_utf8_lossy(&chunk));
                            }
                            Ok(None) => {
                                // Stream ended
                                return None;
                            }
                            Err(e) => {
                                let evt = BrainstormStreamEvent::Error {
                                    error: format!("Stream error: {}", e),
                                };
                                return Some((
                                    evt,
                                    (
                                        bytes_stream,
                                        buffer,
                                        text_acc,
                                        thinking_acc,
                                        model,
                                        input_tokens,
                                        output_tokens,
                                        current_block_type,
                                        true,
                                        pool,
                                        session_id,
                                    ),
                                ));
                            }
                        }
                    }
                },
            )
        };

        Ok(Box::pin(stream))
    }

    pub async fn extract_plan(
        &self,
        pool: &SqlitePool,
        session_id: Uuid,
    ) -> Result<db::models::brainstorm::BrainstormPlan, BrainstormError> {
        let api_key = self.api_key()?.to_string();

        let session = BrainstormSession::find_by_id(pool, session_id)
            .await?
            .ok_or(BrainstormError::SessionNotFound)?;

        let context_items = BrainstormContext::find_by_session_id(pool, session_id).await?;
        let messages = BrainstormMessage::find_by_session_id(pool, session_id).await?;

        let system_prompt = Self::build_system_prompt(&session, &context_items);
        let mut api_messages: Vec<AnthropicMessage> = messages
            .iter()
            .map(|m| AnthropicMessage {
                role: m.role.to_string(),
                content: m.content.clone(),
            })
            .collect();
        api_messages.push(AnthropicMessage {
            role: "user".to_string(),
            content: "Based on our discussion, please create a structured implementation plan by calling the create_implementation_plan tool. Extract all the concrete tasks we've discussed into discrete, actionable items.".to_string(),
        });

        let plan_tool = AnthropicTool {
            name: "create_implementation_plan".to_string(),
            description:
                "Create a structured implementation plan from the brainstorming discussion"
                    .to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "project_name": {
                        "type": "string",
                        "description": "Name of the project"
                    },
                    "project_description": {
                        "type": "string",
                        "description": "Brief description of the project"
                    },
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "title": { "type": "string" },
                                "description": { "type": "string" },
                                "priority": {
                                    "type": "string",
                                    "enum": ["urgent", "high", "medium", "low"]
                                },
                                "estimated_effort": { "type": "string" },
                                "dependencies": {
                                    "type": "array",
                                    "items": { "type": "string" }
                                },
                                "tags": {
                                    "type": "array",
                                    "items": { "type": "string" }
                                }
                            },
                            "required": ["title", "description"]
                        }
                    }
                },
                "required": ["project_name", "project_description", "items"]
            }),
        };

        let request_body = AnthropicRequest {
            model: "claude-opus-4-6".to_string(),
            max_tokens: 8000,
            messages: api_messages,
            system: Some(system_prompt),
            stream: false,
            thinking: None,
            tools: Some(vec![plan_tool]),
        };

        let response = self
            .http_client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&request_body)
            .send()
            .await
            .map_err(|e| BrainstormError::AnthropicApi(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status().as_u16();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            if status == 429 {
                return Err(BrainstormError::RateLimit);
            }
            return Err(BrainstormError::AnthropicApi(format!(
                "HTTP {}: {}",
                status, body
            )));
        }

        let api_response: AnthropicNonStreamResponse = response
            .json()
            .await
            .map_err(|e| BrainstormError::AnthropicApi(format!("Parse error: {}", e)))?;

        // Find tool_use content block
        for block in &api_response.content {
            if block.content_type == "tool_use" {
                if let Some(input) = &block.input {
                    let plan: db::models::brainstorm::BrainstormPlan =
                        serde_json::from_value(input.clone()).map_err(|e| {
                            BrainstormError::AnthropicApi(format!("Failed to parse plan: {}", e))
                        })?;
                    return Ok(plan);
                }
            }
        }

        Err(BrainstormError::AnthropicApi(
            "No plan tool_use found in response".to_string(),
        ))
    }
}

// ── SSE parsing helpers ─────────────────────────────────────────────

fn extract_sse_event(buffer: &mut String) -> Option<String> {
    // SSE events are separated by double newlines
    if let Some(pos) = buffer.find("\n\n") {
        let event = buffer[..pos].to_string();
        *buffer = buffer[pos + 2..].to_string();
        Some(event)
    } else {
        None
    }
}

fn parse_sse_data(event: &str) -> Option<AnthropicStreamEvent> {
    for line in event.lines() {
        if let Some(data) = line.strip_prefix("data: ") {
            return serde_json::from_str(data).ok();
        }
    }
    None
}
