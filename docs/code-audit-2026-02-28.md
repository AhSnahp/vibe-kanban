# Vibe Kanban Full Code Audit and End-to-End Review

Date: 2026-02-28
Auditor: Codex (automated + manual review)
Scope: `/home/carl/kanban/vibe-kanban` (Rust backend/services/db + web packages + e2e)

## Deployment Context

User clarification: this review target is a **local-only pre-run environment**.

## Context Reclassification (Local-Only)

- Findings **#1** (missing `Origin` allows request) and **#2** (preview proxy localhost forwarding) remain valid code-path observations, but are primarily exploitable when the app is reachable beyond loopback (public/private network exposure, reverse proxy, tunnel, or `HOST=0.0.0.0`).
- For strictly local-only usage on `127.0.0.1`, treat these two as **hardening items** rather than immediate high-priority defects.
- All other findings (lint/SQLx/dependency/test coverage) remain unchanged.

## Executive Summary

This review found **deployment-sensitive high-risk issues** in request-gating and preview proxy behavior, plus **multiple release-gate failures** in lint/SQLx checks, unresolved dependency vulnerabilities, and incomplete e2e execution coverage.

No fixes were applied per request.

## Method

- Ran project checks and tests:
  - `pnpm run check`
  - `pnpm run lint`
  - `cargo test --workspace`
  - `npx playwright test`
  - `pnpm run generate-types:check`
  - `pnpm run prepare-db:check`
  - `pnpm audit --prod`
- Manually reviewed security-critical backend and proxy code paths, then validated findings against concrete call-sites.

## Automated Validation Results

- `pnpm run check`: **PASS with warnings**
  - Rust warnings in `crates/server/src/routes/brainstorm.rs` (unused import/variable).
- `pnpm run lint`: **FAIL**
  - `crates/db/src/models/brainstorm.rs:120` (`clippy::redundant_closure`)
  - `crates/db/src/models/brainstorm.rs:467` (`clippy::too_many_arguments`)
- `cargo test --workspace`: **FAIL / incomplete signal**
  - Build/link process terminated by `SIGKILL` (resource pressure), including `server` and `services` test artifacts.
- `npx playwright test`: **PARTIAL PASS**
  - 7 passed, 9 skipped (backend-dependent tests gated by `E2E_HAS_BACKEND`).
- `pnpm run generate-types:check`: **PASS**
- `pnpm run prepare-db:check`: **FAIL**
  - `.sqlx` is missing one or more queries (stale SQLx offline metadata).
- `pnpm audit --prod`: **FAIL**
  - 15 total vulnerabilities detected in current lock resolution (`10 high`, `2 moderate`, `3 low`).

## Findings (Ordered by Severity)

### 1) High: Origin validation allows requests with no `Origin` header (deployment exposure risk)

**Evidence**
- `crates/server/src/middleware/origin.rs:47-49` returns `Ok(())` when `Origin` header is absent.
- `crates/server/src/routes/mod.rs:66-72` shows this middleware is the main API request validator.

**Why this matters**
- If the service is bound beyond loopback (`HOST=0.0.0.0`) or reachable through a reverse proxy, non-browser clients can call API routes without origin checks.
- This is not a browser-CSRF issue; it is direct API reachability when network-exposed.

**Impact**
- Unauthorized API access risk in self-host/remote exposure scenarios unless external auth/network controls are guaranteed.

### 2) High: Preview proxy can be used as localhost port-forward/SSRF when externally reachable

**Evidence**
- `crates/server/src/preview_proxy/mod.rs:317-320` derives target port from first host label.
- `crates/server/src/preview_proxy/mod.rs:324-333` accepts it and routes request.
- `crates/server/src/preview_proxy/mod.rs:393-400` forwards to `http://localhost:{target_port}/...`.

**Why this matters**
- A reachable preview proxy can be coerced to connect to arbitrary localhost ports on the host machine.
- This is especially dangerous in remote/self-host deployments where internal services may exist on localhost.

**Impact**
- Internal service probing/access from external callers (SSRF-like local pivot).

### 3) High: Dependency vulnerabilities (transitive/runtime toolchain)

**Evidence**
- `pnpm audit --prod` returned high-severity advisories, including:
  - `glob` command injection advisory (`GHSA-5j98-mcp5-4vw2`)
  - `preact` JSON VNode injection advisory (`GHSA-36hm-qxxp-pg3m`)
  - `devalue` DoS advisories (`GHSA-g2pg-6438-jwpf`, `GHSA-vw5p-8cq8-m7mv`)
  - multiple `minimatch` ReDoS advisories (`GHSA-3ppc-4f35-3m26`, `GHSA-7r86-cg39-jmmj`, `GHSA-23c5-xmqv-rm74`)

**Impact**
- Increased supply-chain and runtime risk depending on which dependency paths are exercised in deployed builds.

### 4) Medium: Brainstorm context deletion is not scoped to session ID

**Evidence**
- Route receives both IDs but ignores session in delete operation:
  - `crates/server/src/routes/brainstorm.rs:187-190`
- DB delete only filters by context ID:
  - `crates/db/src/models/brainstorm.rs:569-573`

**Why this matters**
- API path implies session-scoped deletion (`/brainstorm/sessions/{id}/context/{ctx_id}`), but handler permits deletion by `ctx_id` alone.

**Impact**
- Context records can be deleted across sessions if IDs are known, violating route-level data integrity expectations.

### 5) Medium: SQLx offline metadata is stale (release/CI gate broken)

**Evidence**
- `pnpm run prepare-db:check` failed with `.sqlx is missing one or more queries`.

**Impact**
- CI/release blockers and potential drift between query definitions and checked-in offline metadata.

### 6) Medium: Backend lint gate currently broken

**Evidence**
- `pnpm run lint` fails due Clippy `-D warnings` in:
  - `crates/db/src/models/brainstorm.rs:120`
  - `crates/db/src/models/brainstorm.rs:467`

**Impact**
- Merge/release friction; indicates quality gates do not currently pass on this snapshot.

### 7) Medium: Full Rust test suite could not complete due resource-kill failures

**Evidence**
- `cargo test --workspace` produced linker/rustc `SIGKILL` during test compilation.

**Impact**
- No clean workspace-level test signal; regression confidence is reduced.

### 8) Low: End-to-end suite coverage is partial in current configuration

**Evidence**
- `e2e/brainstorm.spec.ts:7` gates backend-required tests by `E2E_HAS_BACKEND`.
- Current run: 7 passed, 9 skipped.

**Impact**
- Critical backend-integrated user paths in brainstorm were not exercised in this run.

### 9) Low: TypeScript/ESLint parser support mismatch warning

**Evidence**
- Lint output warns `@typescript-eslint/typescript-estree` supports `<5.4` while environment is TypeScript `5.9.2`.

**Impact**
- Potential false positives/negatives in lint behavior and reduced tooling determinism.

## Open Questions / Assumptions

1. Is this backend intended to be reachable only on loopback (`127.0.0.1`) in all real deployments?
2. If remote/self-host is supported on public/private networks, what external authentication layer is mandatory in front of `/api` and preview proxy?
3. Is preview proxy intended to be developer-local only, or production-exposed in any supported topology?

These answers determine whether Findings #1 and #2 are accepted design tradeoffs or urgent security defects.

## Coverage Gaps

- Could not complete a clean `cargo test --workspace` pass due environment resource kills.
- Browser e2e backend-dependent scenarios were skipped without `E2E_HAS_BACKEND=1`.
- Rust dependency CVE audit (`cargo audit`) was not available because `cargo-audit` is not installed in this environment.

## Reproduction Command Log

- `pnpm run check`
- `pnpm run lint`
- `cargo test --workspace`
- `npx playwright test`
- `pnpm run generate-types:check`
- `pnpm run prepare-db:check`
- `pnpm audit --prod`
