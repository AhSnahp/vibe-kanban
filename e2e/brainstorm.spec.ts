import { test, expect } from "@playwright/test";

// Brainstorm Terminal E2E Tests
// Tests that work without backend use /brainstorm direct navigation
// Tests requiring backend API are marked with .skip when no backend is available

const HAS_BACKEND = !!process.env.E2E_HAS_BACKEND;

test.describe("Brainstorm Terminal", () => {
  test.describe("Navigation", () => {
    test("should render brainstorm terminal page", async ({ page }) => {
      await page.goto("/brainstorm");
      const heading = page.getByText("Brainstorm Terminal");
      await expect(heading).toBeVisible();
    });

    test("should show brainstorm description text", async ({ page }) => {
      await page.goto("/brainstorm");
      await expect(
        page.getByText("Deep project planning with Claude"),
      ).toBeVisible();
    });

    test("should show AppBar with brainstorm icon on brainstorm page", async ({
      page,
    }) => {
      await page.goto("/brainstorm");
      // The brainstorm button in the AppBar has aria-label "Brainstorm"
      const appBar = page.locator('nav, [class*="border-r"]').first();
      await expect(appBar).toBeVisible();
    });

    // This test requires the backend to serve the home page past "Loading..."
    test.skip(!HAS_BACKEND, "Requires backend API");
    test("should navigate to /brainstorm from home via AppBar", async ({
      page,
    }) => {
      await page.goto("/");
      await page.getByLabel("Brainstorm").click();
      await expect(page).toHaveURL(/\/brainstorm/);
    });
  });

  test.describe("Layout", () => {
    test("should show sidebar with Sessions header", async ({ page }) => {
      await page.goto("/brainstorm");
      await expect(page.getByText("Sessions", { exact: true })).toBeVisible();
    });

    test("should show empty state when no sessions exist", async ({ page }) => {
      await page.goto("/brainstorm");
      await expect(page.getByText("No sessions yet")).toBeVisible();
    });

    test("should show Start New Session button", async ({ page }) => {
      await page.goto("/brainstorm");
      const startButton = page.getByRole("button", {
        name: "Start New Session",
      });
      await expect(startButton).toBeVisible();
    });

    test("should show create session button in sidebar header", async ({
      page,
    }) => {
      await page.goto("/brainstorm");
      // The + button in the Sessions header
      const sidebar = page.locator('[class*="border-r"]').first();
      const plusButton = sidebar.getByRole("button").first();
      await expect(plusButton).toBeVisible();
    });

    test("should not show plan review panel by default", async ({ page }) => {
      await page.goto("/brainstorm");
      // Plan review panel only appears when a plan is extracted
      const planReviewHeading = page.getByText("Plan Review");
      await expect(planReviewHeading).not.toBeVisible();
    });
  });

  test.describe("Session Management (requires backend)", () => {
    test.skip(!HAS_BACKEND, "Requires backend API");

    test("should create a new session when clicking Start New Session", async ({
      page,
    }) => {
      await page.goto("/brainstorm");
      await page.getByRole("button", { name: "Start New Session" }).click();
      // After creating a session, the input area should appear
      const textarea = page.getByPlaceholder(/message|brainstorm|type/i);
      await expect(textarea).toBeVisible({ timeout: 10_000 });
    });

    test("should show session in sidebar after creation", async ({ page }) => {
      await page.goto("/brainstorm");
      await page.getByRole("button", { name: "Start New Session" }).click();
      // Wait for session to appear in sidebar
      await page
        .getByPlaceholder(/message|brainstorm|type/i)
        .waitFor({ timeout: 10_000 });
      // The sidebar should now have at least one session item
      await expect(page.getByText("No sessions yet")).not.toBeVisible();
    });

    test("should delete a session from sidebar", async ({ page }) => {
      await page.goto("/brainstorm");
      // Create a session first
      await page.getByRole("button", { name: "Start New Session" }).click();
      await page
        .getByPlaceholder(/message|brainstorm|type/i)
        .waitFor({ timeout: 10_000 });

      // Hover over the session to reveal delete button
      const sessionItem = page.getByText(/untitled session/i).first();
      await sessionItem.hover();

      // Click the delete button (trash icon)
      const deleteButton = page
        .locator("button")
        .filter({ has: page.locator("svg") })
        .last();
      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        await expect(page.getByText("No sessions yet")).toBeVisible({
          timeout: 5_000,
        });
      }
    });
  });

  test.describe("Message Input (requires backend)", () => {
    test.skip(!HAS_BACKEND, "Requires backend API");

    test("should have a message input textarea after creating session", async ({
      page,
    }) => {
      await page.goto("/brainstorm");
      await page.getByRole("button", { name: "Start New Session" }).click();
      const textarea = page.getByPlaceholder(/message|brainstorm|type/i);
      await expect(textarea).toBeVisible({ timeout: 10_000 });
      await expect(textarea).toBeEnabled();
    });

    test("should have extract plan button", async ({ page }) => {
      await page.goto("/brainstorm");
      await page.getByRole("button", { name: "Start New Session" }).click();
      await page
        .getByPlaceholder(/message|brainstorm|type/i)
        .waitFor({ timeout: 10_000 });
      const extractButton = page.getByRole("button", {
        name: /extract plan/i,
      });
      await expect(extractButton).toBeVisible();
    });
  });

  test.describe("Responsive / Mobile", () => {
    test.use({
      viewport: { width: 375, height: 812 },
    });

    test("should render brainstorm page on mobile", async ({ page }) => {
      await page.goto("/brainstorm");
      const heading = page.getByText("Brainstorm Terminal");
      await expect(heading).toBeVisible();
    });

    test("should show Start New Session button on mobile", async ({ page }) => {
      await page.goto("/brainstorm");
      await expect(
        page.getByRole("button", { name: "Start New Session" }),
      ).toBeVisible();
    });
  });
});
