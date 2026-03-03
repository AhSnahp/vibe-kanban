# Vibe Kanban Hybrid Fork — Build Plan

## Goal

A lean frontend (`packages/command-center`) that talks directly to the existing Rust/Axum backend. No ElectricSQL. No auth. No organizations. Single user, local machine. The Rust backend and all its crates stay untouched (Phase 1–2). Future phases may add lightweight backend extensions.

This is a personal tool for orchestrating AI coding agents with a brainstorm → plan → board → agents → code → merge loop, featuring the **Ralph Loop** — autonomous agent execution with optional human-in-the-loop review.

## Architecture

```
┌──────────────────────────────────────────┐
│  packages/command-center (Vite + React)  │
│  - TanStack Router (file-based routing)  │
│  - TanStack React Query (data fetching)  │
│  - Zustand (workspace runtime state)     │
│  - @hello-pangea/dnd (kanban drag-drop)  │
│  - WebSocket JSON Patch streaming        │
│  - Imports hooks/utils from @vibe/web-core│
│  - Tailwind CSS + Vibe design system     │
└──────────────┬───────────────────────────┘
               │ REST + WebSocket
               ▼
┌──────────────────────────────────────────┐
│  EXISTING: Rust/Axum Backend             │
│  /v1/fallback/*  - kanban reads (local)  │
│  /v1/*           - kanban mutations      │
│  /api/brainstorm - brainstorm sessions   │
│  /api/task-attempts - workspaces/agents  │
│  /api/sessions   - agent sessions        │
│  /api/execution-processes - agent runs   │
│  /api/repos      - git repo management   │
│  /api/config     - app configuration     │
└──────────────────────────────────────────┘
```

## Existing API Surface (Backend — No Modifications)

These routes already work in local mode. The frontend consumes them directly.

### Kanban Data (Local SQLite via /v1)

**Reads (GET):**
- `GET /v1/fallback/projects` → `{ projects: [...] }`
- `GET /v1/fallback/project_statuses?project_id=UUID` → `{ project_statuses: [...] }`
- `GET /v1/fallback/issues?project_id=UUID` → `{ issues: [...] }`
- `GET /v1/fallback/tags?project_id=UUID` → `{ tags: [...] }`
- `GET /v1/fallback/issue_tags?project_id=UUID` → `{ issue_tags: [...] }`

**Mutations (all return `{ txid: number }`):**
- `POST /v1/projects` — create project `{ name, color }`
- `PATCH /v1/projects/:id` — update project
- `DELETE /v1/projects/:id` — delete project
- `POST /v1/project_statuses` — create status column
- `PATCH /v1/project_statuses/:id` — update status
- `POST /v1/issues` — create issue
- `PATCH /v1/issues/:id` — update issue (drag-drop: `status_id` + `sort_order`)
- `DELETE /v1/issues/:id` — delete issue
- `POST /v1/issues/bulk` — bulk update `{ updates: [{ id, ...changes }] }`
- `POST /v1/tags` — create tag
- `POST /v1/issue_tags` — assign tag
- `DELETE /v1/issue_tags/:id` — remove tag

### Brainstorm (Anthropic API)

- `GET /api/brainstorm/status` — API key check
- `GET/POST /api/brainstorm/sessions` — list/create
- `GET/PUT/DELETE /api/brainstorm/sessions/:id` — CRUD
- `WS /api/brainstorm/sessions/:id/stream/ws` — streaming chat
- `POST /api/brainstorm/sessions/:id/context` — add context
- `POST /api/brainstorm/sessions/:id/extract-plan` — extract structured plan
- `POST /api/brainstorm/sessions/:id/push-plan` — push to kanban board

### Workspaces (Agent Orchestration)

- `POST /api/task-attempts/create-and-start` — create workspace + launch agent
- `GET /api/task-attempts/:id` — workspace details
- `POST /api/task-attempts/:id/stop` — stop execution
- `GET /api/task-attempts/:id/branch-status` — git branch status
- `WS /api/task-attempts/:id/diff/ws` — streaming diff data
- `POST /api/task-attempts/:id/merge` — merge changes `{ repo_id }`
- `POST /api/task-attempts/:id/push` — push branch
- `WS /api/task-attempts/stream/ws` — streaming workspace list (JSON Patch)

### Sessions & Execution

- `GET /api/sessions?workspace_id=UUID` — list sessions
- `POST /api/sessions/:id/follow-up` — send follow-up `{ prompt, executor_config, ... }`
- `WS /api/execution-processes/stream/session/ws?session_id=UUID` — process status stream
- `WS /api/execution-processes/:id/normalized-logs/ws` — agent conversation stream

### Repos & Config

- `GET /api/repos` — list registered repos
- `GET /api/config` — app config (executors, capabilities)

---

## Phase 1: Kanban + Brainstorm Shell ✅ COMPLETE

**Goal:** Projects, kanban board, drag-and-drop, brainstorm with Claude, push plans to board.

### What Was Built

**Package setup:** `packages/command-center` — Vite + React + TanStack Router (file-based) + TanStack React Query + Zustand + @hello-pangea/dnd. Shares `@vibe/ui` component library and `@vibe/web-core` hooks/utils. Path aliases: `@cc/*` → local, `@/*` → web-core, `shared/*` → types.

**Routes:**
| Route | Component | Status |
|-------|-----------|--------|
| `/` | Dashboard | ✅ Project list + create |
| `/projects/$projectId` | KanbanPage | ✅ Drag-drop kanban board |
| `/brainstorm` | BrainstormTerminal | ✅ Reuses web-core brainstorm feature |

**Data layer:**
- `src/lib/api.ts` — typed fetch wrappers for `/v1` endpoints (reads + mutations)
- `src/lib/query-keys.ts` — React Query key factory
- `src/hooks/use-projects.ts` — project list + create
- `src/hooks/use-issues.ts` — issue CRUD + bulk update (drag-drop)
- `src/hooks/use-statuses.ts` — status columns
- `src/hooks/use-tags.ts` — tags + issue-tag mappings

**Components:**
- `AppLayout.tsx` — sidebar + outlet shell
- `AppSidebar.tsx` — nav: Dashboard, Brainstorm, Workspaces
- `Dashboard.tsx` — project grid + create
- `KanbanPage.tsx` — kanban board with @hello-pangea/dnd, column headers, inline issue creation
- `IssueCard.tsx` — priority badge, title, description, launch button
- `IssueDetailPanel.tsx` — right panel: title, status, priority, description editing
- `ProjectCard.tsx` — project link card

**Auth bypass:** Bootstrap.tsx provides a dummy token provider (`'local-mode'`) + hardcoded user ID.

**Flow working:** Brainstorm → Extract Plan → Push to Board → Navigate to kanban → see cards → drag-drop.

---

## Phase 2: Ralph Loop Agent Orchestration ✅ COMPLETE

**Goal:** Launch AI agents from kanban cards, watch them work, and run them in autonomous loops with optional human review.

### Ralph Loop State Machine

```
IDLE → LAUNCHING → RUNNING → EVALUATING → FOLLOWING_UP → RUNNING (loop)
                                        → PAUSED (review mode)
                                        → DONE (DONE marker or max iterations)
                                        → FAILED (agent error/killed)
```

**Two modes (togglable mid-execution):**
- **Send-it mode:** On agent completion, auto-send follow-up prompt asking the agent to review its own work. Loop until agent responds "DONE" or max iterations reached.
- **Review mode:** On agent completion, pause. User sees diff + last message, then clicks Continue, Merge, or Stop.

**Follow-up prompt:** "Review all the changes you made. Check for bugs, missing edge cases, and code quality issues. If everything looks good, respond with just the word DONE on its own line. Otherwise, fix any issues you find."

### What Was Built

**Store:** `src/stores/workspace-store.ts` — Zustand with persist
- Global: `mode` (send-it/review), `maxIterations`, `defaultRepoId`, `defaultExecutor`
- Per-workspace: `runtimes` map → `{ loopState, iterations, sessionId, latestProcessId, lastAssistantMessage, error }`

**API layer:** `src/lib/workspace-api.ts` — re-exports from web-core (`attemptsApi`, `sessionsApi`, `repoApi`, `configApi`) + shared types

**Hooks (9 new):**
| Hook | Purpose |
|------|---------|
| `useRepos()` | List registered repos |
| `useAppInfo()` | Server config (available executors) |
| `useLaunchWorkspace()` | Mutation: create workspace + start agent |
| `useFollowUp()` | Mutation: send follow-up message |
| `useWorkspaceStream()` | WS JSON Patch stream of all workspaces |
| `useWorkspaceSessions(wsId)` | Sessions for a workspace |
| `useBranchStatus(wsId)` | Git branch status (polling) |
| `useExecutionMonitor({ sessionId, onCompleted, onFailed })` | Wraps `useExecutionProcesses`, detects status transitions |
| `useRalphLoop({ workspaceId, sessionId, enabled })` | **Core orchestrator** — evaluates completions, sends follow-ups, manages loop state |

**Ralph Loop internals (`use-ralph-loop.ts`):**
1. `useExecutionMonitor` fires `onCompleted` when agent process finishes
2. Opens one-shot WS to normalized-logs, walks entries backwards for last assistant message
3. Checks for `DONE` marker (regex `/^DONE$/m`) → transition to `done`
4. Checks max iterations → transition to `done`
5. Reads `mode` from store at evaluation time (not closure capture) → `paused` or auto follow-up
6. `processingRef` prevents double-evaluation across concurrent renders
7. 10s timeout on entry loading WS as safety valve

**Components (10 new):**
| Component | Purpose |
|-----------|---------|
| `ModeToggle` | Segmented control: Send It / Review |
| `LaunchWorkspaceDialog` | Modal: repo select, executor select, mode, max iterations, editable prompt |
| `AgentConversation` | Lean chat display streaming normalized logs (user/assistant messages + tool-use collapse) |
| `AgentFollowUpInput` | Text input for custom follow-up messages |
| `DiffSummary` | File change stats from diff WS stream |
| `WorkspaceActionBar` | Status indicator + Continue/Merge/Stop buttons based on loop state |
| `WorkspaceCard` | Workspace list card with status dot, name, branch, iteration count |
| `WorkspaceListPage` | Streaming workspace list page |
| `WorkspaceDetailPage` | Main view: header, Conversation/Diff tabs, follow-up input, action bar |

**Routes added:**
| Route | Component |
|-------|-----------|
| `/workspaces` | WorkspaceListPage |
| `/workspaces/$workspaceId` | WorkspaceDetailPage |

**Existing files updated:**
- `IssueCard.tsx` — added `onLaunch` prop with hover Rocket icon button
- `KanbanPage.tsx` — wired `LaunchWorkspaceDialog`, navigates to workspace on launch
- `AppSidebar.tsx` — added Workspaces nav item with Robot icon

---

## Phase 3: Parallel Agents + Terminal View

**Goal:** Run multiple agents in parallel for a project phase, watch them all, and get a combined review.

### Planned Features

1. **Terminal view** — xterm.js component connected to `WS /ws/terminal?workspace_id=ID`
   - Tab in WorkspaceDetailPage alongside Conversation and Diff
   - Raw PTY output for agents that support it

2. **Parallel launch from kanban** — select multiple issue cards, launch all as workspaces simultaneously
   - Bulk launch dialog: shared repo + executor config, per-issue prompts
   - Each gets its own workspace + isolated git worktree (handled by backend)

3. **Multi-agent dashboard** — split-pane view showing 2–4 active workspaces
   - Side-by-side AgentConversation panels
   - Shared action bar: "Stop All", "Continue All", "Merge All"
   - Per-workspace status dots

4. **Phase-aware kanban** — issue cards show workspace status
   - Color-coded dot: running (orange pulse), paused (blue), done (green), failed (red)
   - Iteration count badge
   - Quick-nav to workspace detail from card

### Implementation Notes

- Terminal component: install `xterm` + `xterm-addon-fit`, wrap in a React component with `useEffect` for lifecycle
- Parallel launch reuses `useLaunchWorkspace()` in a loop — each call creates an independent workspace
- Multi-agent view is a layout component wrapping multiple `WorkspaceDetailPage` instances with shared controls
- Phase-aware kanban requires linking workspace ID to issue (backend supports `linked_issue` in `create-and-start` and `attemptsApi.linkToIssue()`)

---

## Phase 4: Workflow Engine

**Goal:** Phased execution with brainstorm sanity checks between phases.

### Workflow Model

A **Workflow** is a phased plan where:
- Each **Phase** contains one or more **Tasks** (mapped to kanban issues)
- Tasks within a phase run in **parallel** via the Ralph Loop
- Between phases, the system pauses for a **sanity check** — Claude reviews all diffs, user decides go/no-go
- On approval, phase branches merge and next phase begins

### State Machine

```
PLANNING → PHASE_RUNNING → PHASE_SANITY_CHECK → PHASE_APPROVED → (next phase)
                                               → PHASE_ADJUST (re-launch specific agents)
                                               → ABORT
```

### Sanity Check Flow

1. All agents in a phase complete (via Ralph Loop → `done`)
2. System gathers diffs from all workspaces in the phase
3. Auto-opens a brainstorm session with prompt:
   "Here are the changes from Phase N: [diffs]. Does this align with the plan? Any concerns before we proceed to Phase N+1?"
4. User + Claude discuss in brainstorm chat
5. User clicks Approve / Adjust / Abort
6. Approve → merge all phase branches, start next phase
7. Adjust → user modifies tasks, re-launches specific agents
8. Abort → stop everything

### Data Model

Start as frontend-only Zustand state. Persist to backend later if the model stabilizes.

```typescript
interface Workflow {
  id: string;
  projectId: string;
  brainstormSessionId: string;
  name: string;
  status: 'planning' | 'running' | 'paused' | 'complete' | 'aborted';
  phases: WorkflowPhase[];
}

interface WorkflowPhase {
  id: string;
  phaseNumber: number;
  name: string;
  status: 'pending' | 'running' | 'sanity_check' | 'approved' | 'complete';
  tasks: WorkflowTask[];
  sanityCheckSessionId: string | null;
}

interface WorkflowTask {
  id: string;
  issueId: string;
  workspaceId: string | null; // set when launched
  status: 'pending' | 'running' | 'done' | 'failed';
}
```

### UI

- **Workflow Dashboard** (`/workflows/$workflowId`) — phase timeline, per-phase task cards with workspace status, sanity check panel with embedded brainstorm
- **Enhanced Plan Push** — brainstorm "Push to Board" gains a "Create Workflow" option that auto-structures phases from the extracted plan's dependency graph

---

## Phase 5: Polish

**Goal:** Refinements that make the tool feel solid.

- **Aggregate diff review** — combined diff view across all workspaces in a phase
- **Merge orchestration** — one-click merge in dependency order
- **Workflow templates** — save workflow patterns for reuse
- **Keyboard shortcuts** — quick-launch, workspace switching, mode toggle
- **Notifications** — desktop notifications when agents complete or need review
- **Persistent workspace state** — reconnect to running workspaces after page reload (store maps workspace → session, and the ralph loop re-attaches)

---

## Dev Workflow

```bash
# Terminal 1: Rust backend
cd /path/to/vibe-kanban
source .env && export ANTHROPIC_API_KEY
BACKEND_PORT=3003 VK_ALLOWED_ORIGINS="http://localhost:3002" cargo run --bin server

# Terminal 2: Command Center frontend
cd packages/command-center
BACKEND_PORT=3003 npx vite --port 3002
```

The Vite dev server proxies `/api/*` and `/v1/*` to the backend. Both the existing `local-web` (port 3001) and `command-center` (port 3002) can run simultaneously against the same backend.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript 5.9 |
| Build | Vite 7.3 |
| Routing | TanStack Router (file-based) |
| Data | TanStack React Query |
| State | Zustand (persisted settings + ephemeral runtime) |
| Drag-drop | @hello-pangea/dnd |
| UI | @vibe/ui (Radix + Tailwind) + Phosphor Icons |
| Shared | @vibe/web-core (hooks, API clients, WebSocket streaming) |
| Backend | Rust/Axum (existing, unmodified) |
| Database | SQLite (local kanban + agent orchestration) |

## Key Decisions

- **No ElectricSQL.** React Query + REST + refetch-after-mutate. Simple.
- **No auth.** Single user. Dummy token provider in bootstrap.
- **WebSocket for streaming only.** Workspace list, execution processes, normalized logs, diffs. Everything else is REST.
- **Reuse web-core heavily.** WebSocket JSON Patch hooks, API clients, execution process streaming — all imported, not reimplemented.
- **Ralph Loop over terminal.** The agent conversation stream (normalized logs) is more useful than raw terminal output for the autonomous loop pattern. Terminal view deferred to Phase 3.
- **Workflow state starts in frontend.** Don't add Rust backend tables until the workflow model stabilizes through use.
- **Mode toggle is read at evaluation time.** Switching from send-it to review mid-execution is safe — the next evaluation boundary respects the new mode.
