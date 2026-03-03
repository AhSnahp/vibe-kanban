import { test, expect } from "@playwright/test";

// ── Brainstorm Push Plan UI E2E Tests ─────────────────────────────
//
// Tests the brainstorm UI including session management and API integration.
// Requires backend to be running.
//
// Run: E2E_HAS_BACKEND=1 FRONTEND_PORT=3001 npx playwright test e2e/brainstorm-push.spec.ts

const HAS_BACKEND = !!process.env.E2E_HAS_BACKEND;

test.describe("Brainstorm Push Plan UI", () => {
  test.skip(!HAS_BACKEND, "Requires backend API");

  test.describe("Session creation via API + UI rendering", () => {
    test("should show message input for a session", async ({
      page,
      request,
    }) => {
      // Create session via API, then navigate to it
      const resp = await request.post("/api/brainstorm/sessions", {
        data: {},
      });
      const body = await resp.json();
      const sessionId = body.data.id;

      await page.goto("/brainstorm");
      await page.waitForLoadState("networkidle");

      // The session should load — look for the message input
      const textarea = page.getByPlaceholder(/Message/);
      await expect(textarea).toBeVisible({ timeout: 10_000 });
    });

    test("should show Extract Plan button", async ({ page, request }) => {
      await request.post("/api/brainstorm/sessions", { data: {} });
      await page.goto("/brainstorm");
      await page.waitForLoadState("networkidle");

      const extractButton = page.getByRole("button", {
        name: /Extract Plan/i,
      });
      await expect(extractButton).toBeVisible({ timeout: 10_000 });
    });

    test("should show thinking budget controls", async ({ page, request }) => {
      await request.post("/api/brainstorm/sessions", { data: {} });
      await page.goto("/brainstorm");
      await page.waitForLoadState("networkidle");

      // Look for thinking budget toggle labels
      const deepLabel = page.getByText("Deep", { exact: true });
      await expect(deepLabel).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe("Session sidebar", () => {
    test("should list sessions in sidebar", async ({ page, request }) => {
      // Create a session so sidebar has content
      await request.post("/api/brainstorm/sessions", { data: {} });

      await page.goto("/brainstorm");
      await page.waitForLoadState("networkidle");

      // Sessions header
      await expect(page.getByText("Sessions", { exact: true })).toBeVisible();

      // At least one session entry
      await expect(page.getByText("No sessions yet")).not.toBeVisible();
    });

    test("should create session via API and retrieve it", async ({
      page,
      request,
    }) => {
      // Create via API
      const createResp = await request.post("/api/brainstorm/sessions", {
        data: {},
      });
      expect(createResp.ok()).toBeTruthy();
      const session = (await createResp.json()).data;
      expect(session.id).toBeTruthy();

      // Verify it can be retrieved by ID
      const getResp = await request.get(
        `/api/brainstorm/sessions/${session.id}`,
      );
      expect(getResp.ok()).toBeTruthy();
      const detail = (await getResp.json()).data;
      expect(detail.session.id).toBe(session.id);

      // Verify sidebar shows sessions (not empty state)
      await page.goto("/brainstorm");
      await page.waitForLoadState("networkidle");
      await expect(page.getByText("No sessions yet")).not.toBeVisible({
        timeout: 5_000,
      });
    });

    test("should delete a session via API", async ({ request }) => {
      // Create then delete
      const createResp = await request.post("/api/brainstorm/sessions", {
        data: {},
      });
      const createBody = await createResp.json();
      const sessionId = createBody.data.id;

      const deleteResp = await request.delete(
        `/api/brainstorm/sessions/${sessionId}`,
      );
      expect(deleteResp.ok()).toBeTruthy();

      // Verify it's gone
      const getResp = await request.get(
        `/api/brainstorm/sessions/${sessionId}`,
      );
      expect(getResp.ok()).toBeFalsy();
    });
  });

  test.describe("Push Plan Dialog (requires plan)", () => {
    test("Push to Board button is NOT visible without a plan", async ({
      page,
      request,
    }) => {
      await request.post("/api/brainstorm/sessions", { data: {} });
      await page.goto("/brainstorm");
      await page.waitForLoadState("networkidle");

      const pushButton = page.getByRole("button", { name: /push.*board/i });
      await expect(pushButton).not.toBeVisible();
    });
  });

  // ── CRITICAL PATH: Push Plan → Project Kanban Board ──────────────
  //
  // This is the most important user-facing flow. It verifies that
  // pushing a brainstorm plan to the board creates a project and
  // that the kanban board page actually renders with issues.

  test.describe("Push Plan → Kanban Board (critical path)", () => {
    test("push-plan creates project and kanban board renders with issues", async ({
      page,
      request,
    }) => {
      const projectName = `Push Plan E2E ${Date.now()}`;
      const items = [
        {
          title: "Setup authentication",
          description: "Implement JWT auth flow",
          priority: "high",
          dependencies: [],
          tags: [],
        },
        {
          title: "Build user dashboard",
          description: "Create main dashboard UI",
          priority: "medium",
          dependencies: ["Setup authentication"],
          tags: [],
        },
        {
          title: "Write integration tests",
          description: "E2E test coverage for auth + dashboard",
          priority: "low",
          dependencies: [],
          tags: [],
        },
      ];

      // 1. Push plan via API to create project + issues
      const pushResp = await request.post(
        "/api/brainstorm/sessions/00000000-0000-0000-0000-000000000001/push-plan",
        {
          data: {
            new_project_name: projectName,
            create_repo: false,
            auto_create_workspaces: false,
            repo_ids: [],
            items,
          },
        },
      );
      expect(pushResp.ok()).toBeTruthy();
      const pushBody = await pushResp.json();
      const projectId = pushBody.data.project_id;
      expect(projectId).toBeTruthy();

      // 2. Navigate to the project kanban page
      await page.goto(`/projects/${projectId}`);

      // 3. Wait for kanban board to render (NOT "Loading..." or "No project found")
      //    The page needs ~3s for Electric fallback timeout, then loads from REST
      await expect(
        page.getByRole("heading", { name: projectName }),
      ).toBeVisible({ timeout: 15_000 });

      // 4. Verify "No project found" does NOT appear
      await expect(page.getByText("No project found")).not.toBeVisible();

      // 5. Verify kanban columns exist (default statuses: Backlog, To Do, In Progress, Done)
      await expect(page.getByText("Backlog")).toBeVisible();

      // 6. Verify at least one issue from the plan appears on the board
      //    Use .first() since the title text may also appear in dependency lists
      await expect(page.getByText("Setup authentication").first()).toBeVisible({
        timeout: 5_000,
      });
    });

    test("project page loads organization data from /v1/organizations", async ({
      request,
    }) => {
      // Verify the /v1/organizations endpoint returns valid data
      // (this was the root cause of "No project found")
      const resp = await request.get("/v1/organizations");
      expect(resp.ok()).toBeTruthy();
      const body = await resp.json();
      expect(body.organizations).toBeInstanceOf(Array);
      expect(body.organizations.length).toBeGreaterThanOrEqual(1);
      expect(body.organizations[0].id).toBeTruthy();
      expect(body.organizations[0].name).toBe("Local");
    });
  });

  test.describe("Brainstorm API", () => {
    test("should report availability status", async ({ request }) => {
      const response = await request.get("/api/brainstorm/status");
      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(typeof body.data.available).toBe("boolean");
    });

    test("should create and retrieve a session", async ({ request }) => {
      const createResp = await request.post("/api/brainstorm/sessions", {
        data: {},
      });
      expect(createResp.ok()).toBeTruthy();
      const session = (await createResp.json()).data;
      expect(session.id).toBeTruthy();

      const getResp = await request.get(
        `/api/brainstorm/sessions/${session.id}`,
      );
      expect(getResp.ok()).toBeTruthy();
      const detail = (await getResp.json()).data;
      expect(detail.session.id).toBe(session.id);
      expect(detail.messages).toBeInstanceOf(Array);
      expect(detail.context).toBeInstanceOf(Array);
    });

    test("should update a session title", async ({ request }) => {
      const createResp = await request.post("/api/brainstorm/sessions", {
        data: {},
      });
      const session = (await createResp.json()).data;

      const updateResp = await request.put(
        `/api/brainstorm/sessions/${session.id}`,
        {
          data: { title: "Custom Title" },
        },
      );
      expect(updateResp.ok()).toBeTruthy();
      const updated = (await updateResp.json()).data;
      expect(updated.title).toBe("Custom Title");
    });

    test("should list all sessions", async ({ request }) => {
      const response = await request.get("/api/brainstorm/sessions");
      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });
  });
});
