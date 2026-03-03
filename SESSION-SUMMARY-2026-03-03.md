# Session Summary — March 3, 2026

## What We Fixed

### Bug 1: Tags Can't Be Read Back (Backend)
- **Problem:** `GET /v1/fallback/tags` was a stub returning `{ "tags": [] }`. Tags created via POST were stored in SQLite but never queryable.
- **Fix:** Added `LocalTag::list(pool, project_id)` method in `crates/db/src/models/local_issue.rs` and updated `fallback_tags` in `crates/server/src/routes/v1_fallback.rs` to query the database instead of returning an empty array.
- **Files:** `crates/db/src/models/local_issue.rs`, `crates/server/src/routes/v1_fallback.rs`

### Bug 2: Workflow Task IDs Are Placeholders (Frontend)
- **Problem:** `CreateWorkflowDialog.tsx` used `issueId: 'placeholder-${idx}'` but `push_plan_local` returns real UUIDs in `result.issue_ids`. The workflow runner's `issueMap.get(task.issueId)` never matched, so tasks were silently skipped.
- **Fix:** Changed to `issueId: result.issue_ids[idx] ?? 'placeholder-${idx}'` so real UUIDs are used.
- **File:** `packages/command-center/src/components/CreateWorkflowDialog.tsx`

### Bug 3: Multi-Agent "Continue All" Is a No-Op (Frontend)
- **Problem:** `use-multi-agent.ts` `continueAll()` only updated Zustand state but never called the actual follow-up API. The Ralph Loop only fires on execution process completion callbacks, not on state changes.
- **Fix:** Exported `sendFollowUp` from `use-ralph-loop.ts` and rewrote `continueAll` in `use-multi-agent.ts` to call it for each paused workspace.
- **Files:** `packages/command-center/src/hooks/use-ralph-loop.ts`, `packages/command-center/src/hooks/use-multi-agent.ts`

### Bug 4: TypeScript Error — React.ReactNode Without Import (Frontend)
- **Problem:** `IssueDetailPanel.tsx` referenced `React.ReactNode` without importing `React` or `ReactNode`.
- **Fix:** Added `type ReactNode` to the import and changed the type annotation.
- **File:** `packages/command-center/src/components/IssueDetailPanel.tsx`

### Bug 5: Content-Type on GET Requests Breaks Everything (Critical — Found During Testing)
- **Problem:** `makeRequest()` in `web-core/src/shared/lib/api.ts` unconditionally set `Content-Type: application/json` on ALL requests, including GETs. This caused Axum's backend to wait for a JSON body that never arrived, resulting in ~14-second hangs followed by 500 Internal Server Error responses. This broke ALL data fetching — sessions disappeared, brainstorm wouldn't load, extract plan went nowhere.
- **Fix:** Only set `Content-Type` on non-GET/HEAD methods:
  ```typescript
  const method = (options.method ?? 'GET').toUpperCase();
  if (!headers.has('Content-Type') && method !== 'GET' && method !== 'HEAD') {
    headers.set('Content-Type', 'application/json');
  }
  ```
- **File:** `packages/web-core/src/shared/lib/api.ts`

## Verification

- `cargo check --workspace` — passes
- `pnpm run prepare-db` — SQLx offline data regenerated for new `LocalTag::list` query
- `pnpm run format` — clean
- All API endpoints verified working: sessions list, session detail, brainstorm status, tags, organizations
- Brainstorm sessions load in the UI with full conversation history
- Extract Plan button triggers correctly (Anthropic API returned 529 Overloaded during testing — transient, not a code bug)
- Kanban board loads with all 20 tasks from the brainstorm push

## Lessons Learned

- **Content-Type on GET requests** is silently destructive with Axum — the framework trusts the header and tries to parse a body that doesn't exist
- **React Query caches failures** — once a request 500s, the cached error persists even after the underlying issue is fixed. Hard refresh or cache invalidation is needed
- **Vite HMR doesn't always reload web-core changes** used by command-center — after editing shared lib files, clear `.vite` cache and restart with `--force`
- **VK_ALLOWED_ORIGINS** should include a range of ports (3001-3006) since Vite picks the next available port if the preferred one is occupied
- **Agent launch requires correct repo** — the "Launch agent" dialog defaults to the first registered repo. For new projects (like Subsurface Risk Aggregator), ensure the correct repo is selected before launching

## Current State

- Backend running on port 3003
- Frontend (command-center) running on port 3006
- Brainstorm session "Subsurface Risk Intelligence for Excavation Planning" has full conversation history
- Kanban board at `/projects/9b394887-bcd4-4e20-9f7f-021c7f6954df` has 20 tasks across Backlog/To Do/In Progress/Done columns
- One workspace was created (SUBS-1 "Project Scaffolding") but the agent execution failed — it was launched against the wrong repo (Family-planner instead of Risk map)
