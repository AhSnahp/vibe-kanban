CREATE TABLE brainstorm_sessions (
    id TEXT NOT NULL PRIMARY KEY,
    title TEXT,
    system_prompt TEXT,
    project_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'subsec')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'subsec'))
);

CREATE TABLE brainstorm_messages (
    id TEXT NOT NULL PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES brainstorm_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    thinking TEXT,
    model TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    thinking_tokens INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'subsec'))
);
CREATE INDEX idx_brainstorm_messages_session ON brainstorm_messages(session_id, created_at ASC);

CREATE TABLE brainstorm_context (
    id TEXT NOT NULL PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES brainstorm_sessions(id) ON DELETE CASCADE,
    context_type TEXT NOT NULL,
    reference_id TEXT,
    display_name TEXT NOT NULL,
    content_snapshot TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'subsec'))
);
CREATE INDEX idx_brainstorm_context_session ON brainstorm_context(session_id);
