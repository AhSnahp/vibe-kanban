# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build, Test, and Development Commands

```bash
pnpm i                          # Install all dependencies
pnpm run dev                    # Full dev: backend (cargo-watch) + frontend (Vite), auto-assigned ports
pnpm run backend:dev:watch      # Backend only with cargo-watch (auto-reloads on crate changes)
pnpm run local-web:dev          # Frontend only (Vite dev server)
pnpm run check                  # Type check: ESLint (web) + cargo check (Rust)
pnpm run lint                   # Lint: ESLint (web/ui) + cargo clippy --workspace -D warnings
pnpm run format                 # Format: cargo fmt + Prettier (web-core, local-web, remote-web)
cargo test --workspace          # Run all Rust tests
cargo test -p <crate> <test>    # Run a single Rust test in a specific crate
pnpm run generate-types         # Regenerate shared/types.ts from Rust types
pnpm run generate-types:check   # CI mode — exits non-zero if types are stale
pnpm run prepare-db             # Regenerate SQLx offline query data (.sqlx/)
pnpm run build:npx              # Full production build (web + Rust binaries + npx-cli packaging)
```

Additional dev tools: `cargo install cargo-watch sqlx-cli`

Always run `pnpm run format` before completing a task.

## Architecture Overview

Vibe Kanban orchestrates AI coding agents (Claude Code, Codex, Cursor, etc.) to work on tasks in isolated git worktrees. It's a full-stack app: Rust/Axum backend + React/TypeScript frontend + SQLite (local) or Postgres (cloud).

### Rust Backend (`crates/`)

The server binary (`crates/server/src/main.rs`) boots two concurrent Axum servers:
- **Main server** — API routes + WebSocket connections on `BACKEND_PORT`
- **Preview proxy** — separate port for workspace preview functionality

Routes are in `crates/server/src/routes/` with middleware layers for origin validation, relay signature verification, and CORS.

Key crates and their boundaries:
- **server** — Axum routes, binaries (main server, type generator), request/response types
- **db** — SQLx + SQLite models, migrations (`crates/db/migrations/`), offline query data
- **executors** — Agent abstraction layer. Each agent (Claude, Codex, Cursor, etc.) has its own subdirectory under `crates/executors/`. Handles process spawning, MCP config injection, model selection, and approval workflows
- **services** — Business logic: container management, filesystem, git, repo registration, PR monitoring, config persistence, OAuth, event broadcasting
- **git** — `git2` wrapper + CLI fallback for worktree creation/deletion, diffs, merge conflict detection, branch management
- **deployment** — Abstract trait with two implementations:
  - **local-deployment** — Desktop: SQLite DB, child processes via PTY, local filesystem
  - **remote** (excluded from main workspace) — Cloud: Postgres + ElectricSQL for real-time sync, JWT auth, Docker deployment
- **api-types** — Shared types between local and remote backends. New entities used by both must go here
- **mcp** — MCP server exposed to AI agents via stdio (`mcp_task_server` binary)
- **review** — PR review CLI tool (`vibe-kanban-review` binary)

### Frontend (`packages/`)

- **web-core** — Shared React library (components, hooks, utilities) used by both frontends. State: Zustand. Forms: TanStack React Form + Zod. Router: TanStack React Router. UI: Radix UI + Lucide icons. Editors: Lexical + CodeMirror
- **local-web** — Desktop frontend entrypoint (Vite + TanStack Router file-based routing)
- **remote-web** — Cloud frontend entrypoint (uses ElectricSQL shapes for real-time sync)
- **ui** — Reusable Shadcn-style component library

### Type Generation Pipeline

Rust is the single source of truth for types. Types annotated with `#[derive(TS)]` (via `ts-rs`) are exported to TypeScript:

- `pnpm run generate-types` → reads types from db models, api-types, route types, services → writes `shared/types.ts`
- `pnpm run remote:generate-types` → reads remote/cloud types → writes `shared/remote-types.ts`

**Never edit `shared/types.ts` or `shared/remote-types.ts` directly.** Edit the Rust source types, then regenerate. The local generator is at `crates/server/src/bin/generate_types.rs`, the remote generator at `crates/remote/src/bin/remote-generate-types.rs`.

### Git Worktree Isolation

Each workspace gets an isolated git worktree with its own branch. The `crates/git/` crate manages worktree lifecycle (create, delete, status, diff). The `crates/services/` layer provides a worktree manager that handles cleanup of orphaned and expired worktrees.

### Dev Script Flow (`pnpm run dev`)

`scripts/setup-dev-environment.js` allocates three free ports (frontend, backend, preview_proxy), seeds `dev_assets/` from `dev_assets_seed/`, and the dev command runs `cargo watch` + Vite concurrently via `concurrently`.

## Coding Conventions

**Rust**: Nightly toolchain pinned to `nightly-2025-12-04` (see `rust-toolchain.toml`). rustfmt edition 2024 with `group_imports = "StdExternalCrate"` and `imports_granularity = "Crate"`. snake_case modules, PascalCase types.

**TypeScript/React**: ESLint + Prettier (2 spaces, single quotes, 80 cols). PascalCase components, camelCase vars/functions, kebab-case filenames.

**Database**: SQLx compile-time query checking with offline mode. Run `pnpm run prepare-db` after changing queries. Local uses SQLite (`db.v2.sqlite` in asset dir), remote uses Postgres.

**QA mode**: Build with `--features qa-mode` to enable mock executor for testing without real agents.

## Crate-Specific Guides

- [`crates/remote/AGENTS.md`](crates/remote/AGENTS.md) — Remote server architecture, ElectricSQL integration, mutation patterns, txid handshake
- [`packages/local-web/AGENTS.md`](packages/local-web/AGENTS.md) — Design system: custom CSS variables, semantic color tokens (`text-high`, `bg-secondary`, etc.), container/view/UI component architecture, PascalCase filenames in `ui-new/`
- [`docs/AGENTS.md`](docs/AGENTS.md) — Mintlify documentation writing guidelines

## AI Memory

Architecture documentation lives in `ai/memory/`. These files are auto-loaded at session start by the ai-memory plugin. Update them when the architecture changes.

## Key Patterns

- **Error handling**: Custom error enums with `#[derive(Error, Debug)]`. Production errors go to Sentry. API responses wrapped in `ApiResponse<T>`
- **Async runtime**: Tokio with graceful shutdown via `CancellationToken` + signal handling
- **TLS**: rustls with AWS-LC-RS crypto provider (installed at startup before any TLS ops)
- **Config**: Environment variables with defaults + persistent config files in XDG asset directories. `scripts/setup-dev-environment.js` manages dev port allocation
- **Remote crate isolation**: `crates/remote/` and `crates/relay-tunnel/` are excluded from the main Cargo workspace. They have separate build/test commands
