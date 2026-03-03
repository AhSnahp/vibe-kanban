import { test, expect } from "@playwright/test";

// ── App Navigation E2E Tests ──────────────────────────────────────
//
// Tests the app shell, navigation, and routing behavior.
//
// Run: E2E_HAS_BACKEND=1 FRONTEND_PORT=3001 npx playwright test e2e/app-navigation.spec.ts

const HAS_BACKEND = !!process.env.E2E_HAS_BACKEND;

test.describe("App Shell", () => {
  test.describe("Frontend-only (no backend needed)", () => {
    test("should redirect root to a valid app route", async ({ page }) => {
      await page.goto("/");
      await expect(page).toHaveURL(/\/(workspaces|brainstorm|onboarding)/);
    });
  });

  test.describe("With Backend", () => {
    test.skip(!HAS_BACKEND, "Requires backend API");

    test("should show AppBar with Workspaces icon", async ({ page }) => {
      await page.goto("/brainstorm");
      await page.waitForLoadState("networkidle");
      // The AppBar is visible as the left sidebar
      const appBar = page.locator('nav, [class*="border-r"]').first();
      await expect(appBar).toBeVisible();
    });

    test("should navigate to brainstorm page", async ({ page }) => {
      await page.goto("/brainstorm");
      await page.waitForLoadState("networkidle");
      // The brainstorm page shows "Sessions" in sidebar
      await expect(page.getByText("Sessions", { exact: true })).toBeVisible();
    });

    test("should navigate between brainstorm and workspaces", async ({
      page,
    }) => {
      await page.goto("/brainstorm");
      await page.waitForLoadState("networkidle");

      // Navigate to workspaces via AppBar (exact: true avoids "Workspaces Guide" match)
      const workspacesBtn = page.getByLabel("Workspaces", { exact: true });

      if (await workspacesBtn.isVisible()) {
        await workspacesBtn.click();
        await expect(page).toHaveURL(/\/workspaces/);
      }
    });

    test("should show Create Project button in AppBar", async ({ page }) => {
      await page.goto("/brainstorm");
      await page.waitForLoadState("networkidle");

      const createBtn = page.getByLabel("Create project");
      await expect(createBtn).toBeVisible();
    });

    test("should navigate to a project page and render kanban board", async ({
      page,
      request,
    }) => {
      const projectName = `NavTest ${Date.now()}`;
      // Create a project via API
      const pushResp = await request.post(
        "/api/brainstorm/sessions/00000000-0000-0000-0000-000000000001/push-plan",
        {
          data: {
            new_project_name: projectName,
            create_repo: false,
            auto_create_workspaces: false,
            repo_ids: [],
            items: [
              {
                title: "Nav test issue",
                description: "For navigation",
                dependencies: [],
                tags: [],
              },
            ],
          },
        },
      );
      const projectId = (await pushResp.json()).data.project_id;

      await page.goto(`/projects/${projectId}`);

      // Verify URL and that the kanban board actually renders (not "No project found")
      await expect(page).toHaveURL(new RegExp(`/projects/${projectId}`));
      await expect(
        page.getByRole("heading", { name: projectName }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("No project found")).not.toBeVisible();
      await expect(page.getByText("Backlog")).toBeVisible();
    });

    test("health check endpoint responds", async ({ request }) => {
      const response = await request.get("/api/health");
      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body.data).toBe("OK");
    });

    test("brainstorm status endpoint responds", async ({ request }) => {
      const response = await request.get("/api/brainstorm/status");
      expect(response.ok()).toBeTruthy();
    });
  });
});

test.describe("Responsive Layout", () => {
  test.skip(!HAS_BACKEND, "Requires backend API");

  test.describe("Mobile viewport", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("should render brainstorm on mobile", async ({ page }) => {
      await page.goto("/brainstorm");
      await page.waitForLoadState("networkidle");
      // On mobile, the sidebar may be hidden but sessions text should be accessible
      await expect(page.getByText("Sessions", { exact: true })).toBeVisible({
        timeout: 10_000,
      });
    });
  });

  test.describe("Tablet viewport", () => {
    test.use({ viewport: { width: 768, height: 1024 } });

    test("should render brainstorm on tablet", async ({ page }) => {
      await page.goto("/brainstorm");
      await page.waitForLoadState("networkidle");
      await expect(page.getByText("Sessions", { exact: true })).toBeVisible({
        timeout: 10_000,
      });
    });
  });
});
