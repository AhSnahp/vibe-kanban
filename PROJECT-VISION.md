# Vibe Kanban: Vision vs. Reality

## What You Want

A local-first AI-powered kanban tool where you can:

1. **Brainstorm** with Claude — describe a project idea conversationally
2. **Extract a plan** — Claude structures the conversation into actionable tasks with priorities, descriptions, dependencies
3. **Push to a kanban board** — one click creates a project with status columns (Backlog/To Do/In Progress/Done) and populates it with issues
4. **Navigate to the board** — immediately see your project as a kanban with draggable cards
5. **Launch agent workspaces** — click an issue, spin up an isolated git worktree, and let Claude Code (or other agents) work on it autonomously
6. **Track progress** — watch agents work in real-time via terminal streams, see diffs, approve actions, merge when done

The whole loop: **idea → plan → board → agents → code → merge**.

## What Vibe Kanban Actually Is

Vibe Kanban was built as a **cloud-first SaaS product** with a local desktop mode bolted on. The architecture reflects this:

### The Cloud Architecture (what everything was designed for)
- **PostgreSQL** database for all kanban data (projects, issues, statuses, tags)
- **ElectricSQL** for real-time sync between browser tabs and server
- **JWT auth** via OAuth (GitHub/Google sign-in)
- **Organizations** as the top-level entity — multi-tenant, multi-user
- Frontend talks to the cloud via:
  - ElectricSQL shapes (real-time sync, primary path)
  - `/v1/fallback/*` REST endpoints (backup when Electric is down)
  - `/v1/*` mutation endpoints (creates, updates, deletes)
  - All authenticated with Bearer tokens

### The Local Desktop Mode (what you're using)
- **SQLite** database — has workspace/session/process tables for the agent orchestration side
- **No ElectricSQL** — shapes timeout after 3 seconds, then fall to REST fallback
- **No auth server** — `tokenManager.getToken()` tries to fetch `/api/auth/token` which doesn't exist
- **No remote client** — `deployment.remote_client()` returns `Err` because `VK_SHARED_API_BASE` isn't set

### The Gap

The agent orchestration side (workspaces, sessions, git worktrees, terminal streaming, executor management) works great locally — it was designed for local use. But the **kanban/project management side** was designed exclusively for the cloud path. When you try to use kanban features locally:

- ElectricSQL times out → falls back to `/v1/fallback/*` → **routes didn't exist** → 404/HTML
- Mutations call `/v1/projects` etc. → **routes didn't exist** → 404/HTML
- Auth token is null → `makeRequest()` throws "Not authenticated"
- Organizations endpoint has no fallback → can't resolve org → can't load projects

## What We've Been Doing (Adaptation Approach)

### Session 1: Foundation
- Bypassed auth gate (hardcoded `isSignedIn: true`)
- Skipped onboarding flow
- Added brainstorm system prompt for kanban-aware planning
- Added session auto-titling
- Built `push_plan_local()` — creates SQLite project + issues from brainstorm plan

### Session 2: Local Kanban Storage
- Created 6 SQLite tables mirroring the cloud schema (`local_projects`, `local_project_statuses`, `local_issues`, `local_issue_counters`, `local_issue_tags`, `local_issue_relationships`)
- Built full CRUD models in Rust
- Added fallback paths in `/api/remote/*` routes so they read from local SQLite when no remote client
- Added MCP tools so agents can read/update kanban state

### Session 3 (Current): Wiring Up the Frontend
- **Push navigation**: After pushing plan, navigate to `/projects/{id}` instead of just closing dialog
- **Auth bypass**: Dummy token provider in local mode so `makeRequest()` works
- **Vite proxy**: Forward `/v1/*` to backend (was going to Vite's SPA fallback)
- **Organizations fallback**: Return synthetic "Local" org
- **16 fallback GET routes**: `/v1/fallback/projects`, `/v1/fallback/issues`, etc.
- **15+ mutation routes**: `POST/PATCH/DELETE /v1/projects`, `/v1/issues`, etc.
- **Model additions**: Update/delete for projects, create/update for statuses, tag support

### Current Status
The brainstorm → extract plan → push flow creates the data in SQLite successfully. But the kanban board still doesn't render — there are likely more frontend integration issues in how the ElectricSQL collection layer initializes, subscribes to shapes, and handles the fallback-only mode.

## The Core Problem

Every kanban feature goes through **3 layers of cloud infrastructure abstraction**:

```
React Component
  → useShape() hook (ElectricSQL collection)
    → createShapeCollection()
      → tries Electric shape sync (3s timeout)
      → falls back to makeRequest("/v1/fallback/...")
        → needs auth token
        → needs correct response format
        → needs periodic polling (30s refresh)
      → mutations go through buildMutationHandlers()
        → makeRequest("/v1/projects", { method: "POST" })
        → expects { txid: number } response
        → triggers fallback cache invalidation
```

We're essentially **reimplementing an entire cloud backend** (ElectricSQL + Postgres) as local SQLite routes, while also fighting the frontend's assumptions about auth, organizations, and real-time sync.

## Decision Points

### Continue Adapting
**Pros:**
- Agent orchestration (workspaces, terminals, git worktrees, executor management) is mature and works well locally
- Brainstorm + plan extraction works
- Local SQLite storage is in place with full CRUD
- Most of the `/v1/*` route plumbing is done

**Cons:**
- Every new kanban feature will hit more cloud-only assumptions
- The ElectricSQL collection layer is complex — debugging fallback mode requires understanding the entire sync machinery
- Organization/user/workspace concepts don't map cleanly to local-only use
- You're maintaining a parallel "local version" of every cloud endpoint
- The frontend has hundreds of components that assume cloud data shapes, user auth, org membership

**Remaining unknowns:**
- Does the kanban board actually render once fallback data loads? (Could be more issues in component initialization)
- Do drag-and-drop mutations work through the fallback path?
- Does issue detail view work?
- How many more cloud-only assumptions lurk in the kanban components?

### Start Fresh
**Pros:**
- Design the data layer for local-first from day one
- No ElectricSQL abstraction layer to fight
- Simple React state + SQLite API calls
- Can reuse the Rust backend crates that work well (git, executors, services)
- Kanban UI can be much simpler — you don't need multi-user, orgs, real-time sync
- Can cherry-pick the agent orchestration pieces that work

**Cons:**
- Lose the existing UI components (kanban board, issue panel, drag-drop, filters — significant UI work)
- Lose the brainstorm terminal UI
- Need to rebuild workspace/session/terminal UIs (though these work fine and could be copied)
- Time investment to get back to current functionality

### Hybrid: Fork the Frontend
- Keep the Rust backend as-is (it works)
- Replace `packages/local-web` with a new frontend that talks directly to `/api/*` routes
- Skip ElectricSQL entirely — use React Query + REST
- Copy the workspace/terminal/chat components that work
- Build a simpler kanban board that reads from `/api/remote/projects`, `/api/remote/issues` (which already have local fallbacks)

## What a Minimal Local-First Version Needs

1. **Project list page** — show local projects, create new ones
2. **Kanban board** — columns from `project_statuses`, cards from `issues`, drag to reorder/change status
3. **Issue detail** — title, description, priority, status, linked workspace
4. **Brainstorm** — conversation with Claude, extract plan, push to board (this works)
5. **Workspace launch** — from an issue, create a worktree + agent session (the orchestration backend handles this)
6. **Terminal view** — watch the agent work (xterm.js, already works)
7. **Diff/merge** — review changes, merge to main (already works)

The agent orchestration side (items 5-7) is solid. The kanban side (items 1-4) is where all the friction is.
