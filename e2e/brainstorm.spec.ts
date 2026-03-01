import { test, expect } from '@playwright/test';

// ── Brainstorm Page E2E Tests ─────────────────────────────────────
//
// Tests brainstorm page rendering and session management.
// Tests requiring backend API are skipped when E2E_HAS_BACKEND is not set.
//
// Run: E2E_HAS_BACKEND=1 FRONTEND_PORT=3001 npx playwright test e2e/brainstorm.spec.ts

const HAS_BACKEND = !!process.env.E2E_HAS_BACKEND;

test.describe('Brainstorm Page', () => {
  test.describe('Navigation', () => {
    test('should render brainstorm page with Sessions sidebar', async ({
      page,
    }) => {
      await page.goto('/brainstorm');
      await expect(
        page.getByText('Sessions', { exact: true })
      ).toBeVisible({ timeout: 10_000 });
    });

    test('should show AppBar on brainstorm page', async ({ page }) => {
      await page.goto('/brainstorm');
      const appBar = page.locator('nav, [class*="border-r"]').first();
      await expect(appBar).toBeVisible();
    });

    test.skip(!HAS_BACKEND, 'Requires backend API');
    test('should navigate to /brainstorm from home via AppBar', async ({
      page,
    }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const brainstormBtn = page.getByLabel('Brainstorm');
      if (await brainstormBtn.isVisible()) {
        await brainstormBtn.click();
        await expect(page).toHaveURL(/\/brainstorm/);
      }
    });
  });

  test.describe('Layout', () => {
    test('should show sidebar with Sessions header', async ({ page }) => {
      await page.goto('/brainstorm');
      await expect(
        page.getByText('Sessions', { exact: true })
      ).toBeVisible();
    });

    test('should show create session button in sidebar header', async ({
      page,
    }) => {
      await page.goto('/brainstorm');
      const sidebar = page.locator('[class*="border-r"]').first();
      const plusButton = sidebar.getByRole('button').first();
      await expect(plusButton).toBeVisible();
    });

    test('should not show plan review panel by default', async ({ page }) => {
      await page.goto('/brainstorm');
      const planReviewHeading = page.getByText('Plan Review');
      await expect(planReviewHeading).not.toBeVisible();
    });
  });

  test.describe('Session Management (requires backend)', () => {
    test.skip(!HAS_BACKEND, 'Requires backend API');

    test('should show message input after creating a session via API', async ({
      page,
      request,
    }) => {
      // Create session via API (avoids reliance on empty-state button)
      await request.post('/api/brainstorm/sessions', { data: {} });

      await page.goto('/brainstorm');
      await page.waitForLoadState('networkidle');

      const textarea = page.getByPlaceholder(/Message/);
      await expect(textarea).toBeVisible({ timeout: 10_000 });
    });

    test('should show session in sidebar after API creation', async ({
      page,
      request,
    }) => {
      await request.post('/api/brainstorm/sessions', { data: {} });

      await page.goto('/brainstorm');
      await page.waitForLoadState('networkidle');

      // Sidebar should have session content (not the empty "No sessions yet")
      await expect(page.getByText('No sessions yet')).not.toBeVisible({
        timeout: 5_000,
      });
    });

    test('should delete a session via API and verify removal', async ({
      request,
    }) => {
      // Create then delete via API
      const createResp = await request.post('/api/brainstorm/sessions', {
        data: {},
      });
      const session = (await createResp.json()).data;

      const deleteResp = await request.delete(
        `/api/brainstorm/sessions/${session.id}`
      );
      expect(deleteResp.ok()).toBeTruthy();

      // Verify it's gone
      const getResp = await request.get(
        `/api/brainstorm/sessions/${session.id}`
      );
      expect(getResp.ok()).toBeFalsy();
    });
  });

  test.describe('Message Input (requires backend)', () => {
    test.skip(!HAS_BACKEND, 'Requires backend API');

    test('should have an enabled message input after session creation', async ({
      page,
      request,
    }) => {
      await request.post('/api/brainstorm/sessions', { data: {} });

      await page.goto('/brainstorm');
      await page.waitForLoadState('networkidle');

      const textarea = page.getByPlaceholder(/Message/);
      await expect(textarea).toBeVisible({ timeout: 10_000 });
      await expect(textarea).toBeEnabled();
    });

    test('should have extract plan button', async ({ page, request }) => {
      await request.post('/api/brainstorm/sessions', { data: {} });

      await page.goto('/brainstorm');
      await page.waitForLoadState('networkidle');

      const extractButton = page.getByRole('button', {
        name: /extract plan/i,
      });
      await expect(extractButton).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('Responsive / Mobile', () => {
    test.use({
      viewport: { width: 375, height: 812 },
    });

    test('should render brainstorm page on mobile', async ({ page }) => {
      await page.goto('/brainstorm');
      await expect(
        page.getByText('Sessions', { exact: true })
      ).toBeVisible({ timeout: 10_000 });
    });

    test.skip(!HAS_BACKEND, 'Requires backend API');
    test('should show message input on mobile after session creation', async ({
      page,
      request,
    }) => {
      await request.post('/api/brainstorm/sessions', { data: {} });
      await page.goto('/brainstorm');
      await page.waitForLoadState('networkidle');

      const textarea = page.getByPlaceholder(/Message/);
      await expect(textarea).toBeVisible({ timeout: 10_000 });
    });
  });
});
