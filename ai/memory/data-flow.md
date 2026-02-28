# Data Flow

## Database Schema

```mermaid
erDiagram
    PROJECT ||--o{ WORKSPACE : contains
    PROJECT ||--o{ TAG : has
    WORKSPACE ||--o{ SESSION : has
    WORKSPACE ||--o{ WORKSPACE_REPO : links
    WORKSPACE ||--o{ EXECUTION_PROCESS : runs
    WORKSPACE ||--o{ IMAGE : stores
    SESSION ||--o{ EXECUTION_PROCESS : spawns
    SESSION ||--o{ SCRATCH : drafts
    EXECUTION_PROCESS ||--o{ CODING_AGENT_TURN : records
    EXECUTION_PROCESS ||--o{ EXECUTION_PROCESS_REPO_STATE : snapshots
    EXECUTION_PROCESS ||--o{ MERGE : produces
    REPO ||--o{ WORKSPACE_REPO : referenced_by

    PROJECT {
        text id PK
        text name
        text remote_project_id
        text dev_script
        text parallel_setup_script
        text dev_script_working_dir
        text agent_working_dir
        text created_at
        text updated_at
    }

    WORKSPACE {
        text id PK
        text project_id FK
        text name
        text branch
        text base_branch
        text agent_working_dir
        integer archived
        integer pinned
        text pr_url
        integer pr_number
        text pr_status
        text remote_issue_id
        text created_at
        text updated_at
    }

    SESSION {
        text id PK
        text workspace_id FK
        text executor
        text created_at
    }

    EXECUTION_PROCESS {
        text id PK
        text workspace_id FK
        text session_id FK
        text status
        text run_reason
        text executor_action
        text before_head_commit
        integer masked_by_restore
        text started_at
        text ended_at
    }

    CODING_AGENT_TURN {
        text id PK
        text execution_process_id FK
        text agent_turn_id
        text agent_session_id
        text agent_message_id
        text role
        text content
        integer seen
        text created_at
    }

    REPO {
        text id PK
        text name
        text path
        text default_target_branch
        text setup_script
        text cleanup_script
        text archive_script
        text agent_working_dir
        text created_at
    }

    WORKSPACE_REPO {
        text id PK
        text workspace_id FK
        text repo_id FK
    }

    TAG {
        text id PK
        text project_id FK
        text name
        text description
        text color
        integer sort_order
    }

    SCRATCH {
        text id PK
        text session_id FK
        text scratch_type
        text data
        text created_at
        text updated_at
    }

    IMAGE {
        text id PK
        text workspace_id FK
        text filename
        text content_type
        integer size
        text created_at
    }

    MERGE {
        text id PK
        text execution_process_id FK
        text merge_type
        text merge_commit_sha
        text target_branch
        text created_at
    }

    EXECUTION_PROCESS_REPO_STATE {
        text id PK
        text execution_process_id FK
        text repo_id FK
        text head_commit
        text branch
    }

    MIGRATION_STATE {
        text id PK
        text status
        text error
        text created_at
        text updated_at
    }
```

## API Routes

### Core CRUD

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET/PUT | `/api/config` | App configuration |
| GET | `/api/config/info` | Server info |
| GET/POST | `/api/config/mcp-config` | MCP server config |
| GET/PUT | `/api/config/profiles` | Executor profiles |
| GET | `/api/config/agents/check-availability` | Agent installation status |
| GET | `/api/config/agents/preset-options` | Agent presets |

### Workspaces (Task Attempts)

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/task-attempts` | List/create workspaces |
| POST | `/api/task-attempts/create-and-start` | Create workspace + start agent |
| POST | `/api/task-attempts/from-pr` | Create from pull request |
| PATCH/DELETE | `/api/task-attempts/{id}` | Update/delete workspace |
| POST | `/api/task-attempts/{id}/run-agent-setup` | Run setup script |
| POST | `/api/task-attempts/{id}/start-dev-server` | Start dev server |

### Git Operations

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/task-attempts/{id}/branch-status` | Branch divergence info |
| POST | `/api/task-attempts/{id}/merge` | Merge to target branch |
| POST | `/api/task-attempts/{id}/push` | Push branch |
| POST | `/api/task-attempts/{id}/push/force` | Force push |
| POST | `/api/task-attempts/{id}/rebase` | Rebase onto target |
| POST | `/api/task-attempts/{id}/rebase/continue` | Continue rebase |
| POST | `/api/task-attempts/{id}/conflicts/abort` | Abort conflict resolution |
| POST | `/api/task-attempts/{id}/change-target-branch` | Change merge target |
| POST | `/api/task-attempts/{id}/rename-branch` | Rename workspace branch |

### Pull Requests

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/task-attempts/{id}/pr` | Create PR |
| POST | `/api/task-attempts/{id}/pr/attach` | Attach existing PR |
| GET | `/api/task-attempts/{id}/pr/comments` | PR comments |

### Sessions & Execution

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/sessions` | List/create agent sessions |
| GET | `/api/sessions/{id}` | Get session |
| POST | `/api/sessions/{id}/follow-up` | Send follow-up message to agent |
| POST | `/api/sessions/{id}/reset` | Reset to prior process state |
| POST | `/api/sessions/{id}/review` | Start code review |
| GET | `/api/execution-processes/{id}` | Get execution process |
| POST | `/api/execution-processes/{id}/stop` | Kill agent process |
| GET | `/api/execution-processes/{id}/repo-states` | Git state snapshots |

### Repos & Filesystem

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/repos` | List/register repos |
| POST | `/api/repos/init` | Create new repo (git init) |
| GET | `/api/repos/recent` | Recently used repos |
| GET | `/api/repos/{id}/branches` | List branches |
| GET | `/api/repos/{id}/prs` | List PRs |
| GET | `/api/repos/{id}/search` | File search |
| GET | `/api/filesystem/directory` | Browse directory |
| GET | `/api/filesystem/git-repos` | Discover git repos in path |

### Remote API (Cloud Sync)

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/remote/issues` | List/create issues |
| GET/PATCH/DELETE | `/api/remote/issues/{id}` | Issue CRUD |
| GET/POST | `/api/remote/issue-assignees` | Issue assignees |
| POST/DELETE | `/api/remote/issue-relationships` | Issue relationships |
| GET/POST | `/api/remote/issue-tags` | Issue tags |
| GET | `/api/remote/projects` | List projects |
| GET | `/api/remote/project-statuses` | Status columns |
| GET | `/api/remote/tags` | List tags |

### WebSocket Endpoints

| Path | Protocol | Description |
|------|----------|-------------|
| `/api/execution-processes/{id}/raw-logs/ws` | WS | Raw stdout/stderr stream |
| `/api/execution-processes/{id}/normalized-logs/ws` | WS | Parsed log entries stream |
| `/api/task-attempts/stream/ws` | WS | Workspace process list updates |
| `/api/task-attempts/{id}/diff/ws` | WS | Live git diff stream |
| `/api/approvals/stream/ws` | WS | Approval request stream |
| `/api/config/agents/discovered-options/ws` | WS | Agent discovery stream |
| `/api/scratch/{id}/stream/ws` | WS | Scratch data stream |
| `/ws/terminal` | WS | PTY terminal session |

### Other

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/events` | SSE event stream |
| GET | `/api/search` | Full-text file search |
| GET/POST | `/api/tags` | Tag CRUD |
| POST | `/api/approvals/{id}/respond` | Respond to approval |
| GET/POST/PUT/DELETE | `/api/scratch` | Scratch pad CRUD |
| GET/POST | `/api/organizations` | Organization management |
| POST | `/api/migration/start` | Start data migration |

## Request Lifecycle

```mermaid
sequenceDiagram
    participant FE as Frontend (React)
    participant MW as Middleware
    participant RT as Axum Route
    participant SVC as Service Layer
    participant EXEC as Executor
    participant DB as SQLite
    participant WS as WebSocket

    FE->>MW: HTTP/WS Request
    MW->>MW: Validate origin
    MW->>MW: Verify relay signature (if relay)
    MW->>RT: Authenticated request

    alt Create & Start Workspace
        RT->>SVC: ContainerService.start_execution()
        SVC->>DB: Create Workspace + Session + ExecutionProcess
        SVC->>SVC: WorktreeManager.create_worktree()
        SVC->>EXEC: CodingAgent.spawn(worktree, prompt, env)
        EXEC-->>SVC: SpawnedChild (async process)
        SVC-->>RT: ExecutionProcess record
        RT-->>FE: JSON response

        Note over FE,WS: Client opens WebSocket for logs
        FE->>WS: Connect to /normalized-logs/ws
        EXEC-->>WS: Stream log entries
        WS-->>FE: Real-time updates
    end

    alt Follow-up Message
        RT->>DB: Load Session + latest CodingAgentTurn
        RT->>SVC: ContainerService.start_execution()
        SVC->>EXEC: CodingAgent.spawn_follow_up(session_id)
        EXEC-->>WS: Stream response
    end

    alt Issue CRUD (via RemoteClient)
        RT->>SVC: RemoteClient.create_issue(request)
        SVC->>DB: Proxy to remote or local store
        SVC-->>RT: Issue record
        RT-->>FE: ApiResponse<Issue>
    end
```

## Execution Process State Machine

```mermaid
stateDiagram-v2
    [*] --> PENDING: start_execution()
    PENDING --> RUNNING: Agent process starts
    RUNNING --> SUCCESS: Agent exits cleanly
    RUNNING --> FAILURE: Agent crashes/errors
    RUNNING --> KILLED: User stops execution
    RUNNING --> RUNNING: Follow-up message
    SUCCESS --> RUNNING: New follow-up
    FAILURE --> RUNNING: Retry
    KILLED --> RUNNING: Retry
```

## MCP Tools (Exposed to Agents)

Agents connect to `mcp_task_server` via stdio and can:

| Tool | Description |
|------|-------------|
| `get_context` | Get current workspace/project/issue metadata |
| `list_workspaces` | List local workspaces (filter: archived, pinned, branch) |
| `update_workspace` | Update workspace state |
| `list_organizations` | List organizations |
| `list_projects` | List remote projects |
| `create_issue` | Create kanban issue |
| `list_issues` | Query issues (filter: status, priority, assignee, tag) |
| `get_issue` / `update_issue` / `delete_issue` | Issue CRUD |
| `list_issue_priorities` | Get priority enum values |
| `assign_user` / `remove_assignee` | Issue assignment |
| `create_tag` / `attach_tag` / `remove_tag` | Tag management |
| `create_relationship` / `delete_relationship` | Issue linking |
| `list_repositories` / `get_repository` | Repo info |
| `search_files` | File search within repo |
| `start_workspace_session` | Create and start a new workspace |
| `link_workspace` | Link workspace to issue |
