-- Local kanban storage: projects, statuses, issues, tags, relationships
-- These tables enable the kanban board to work without a cloud backend.

CREATE TABLE IF NOT EXISTS local_projects (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#f97316',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'subsec')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'subsec'))
);

CREATE TABLE IF NOT EXISTS local_project_statuses (
    id TEXT NOT NULL PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES local_projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#888888',
    sort_order INTEGER NOT NULL DEFAULT 0,
    hidden INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'subsec'))
);

CREATE INDEX idx_local_project_statuses_project
    ON local_project_statuses(project_id, sort_order ASC);

CREATE TABLE IF NOT EXISTS local_issues (
    id TEXT NOT NULL PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES local_projects(id) ON DELETE CASCADE,
    status_id TEXT NOT NULL REFERENCES local_project_statuses(id),
    issue_number INTEGER NOT NULL,
    simple_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT,
    sort_order REAL NOT NULL DEFAULT 0,
    parent_issue_id TEXT REFERENCES local_issues(id),
    parent_issue_sort_order REAL,
    start_date TEXT,
    target_date TEXT,
    completed_at TEXT,
    extension_metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'subsec')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'subsec'))
);

CREATE INDEX idx_local_issues_project ON local_issues(project_id, sort_order ASC);
CREATE INDEX idx_local_issues_status ON local_issues(status_id);

CREATE TABLE IF NOT EXISTS local_issue_counters (
    project_id TEXT NOT NULL PRIMARY KEY REFERENCES local_projects(id) ON DELETE CASCADE,
    next_number INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS local_issue_tags (
    id TEXT NOT NULL PRIMARY KEY,
    issue_id TEXT NOT NULL REFERENCES local_issues(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'subsec'))
);

CREATE INDEX idx_local_issue_tags_issue ON local_issue_tags(issue_id);

CREATE TABLE IF NOT EXISTS local_issue_relationships (
    id TEXT NOT NULL PRIMARY KEY,
    issue_id TEXT NOT NULL REFERENCES local_issues(id) ON DELETE CASCADE,
    related_issue_id TEXT NOT NULL REFERENCES local_issues(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'subsec'))
);

CREATE INDEX idx_local_issue_relationships_issue ON local_issue_relationships(issue_id);
