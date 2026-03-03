-- Local tags table for kanban tag management
CREATE TABLE IF NOT EXISTS local_tags (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL REFERENCES local_projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6b7280'
);

CREATE INDEX IF NOT EXISTS idx_local_tags_project_id ON local_tags(project_id);
