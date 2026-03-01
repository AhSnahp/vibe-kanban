import { test, expect } from '@playwright/test';

// ── Local Kanban REST API E2E Tests ───────────────────────────────
//
// These tests verify the local SQLite fallback for all /api/remote/ endpoints.
// They require a running backend (no cloud/ElectricSQL needed).
//
// Run: E2E_HAS_BACKEND=1 FRONTEND_PORT=3001 npx playwright test e2e/local-kanban-api.spec.ts

const HAS_BACKEND = !!process.env.E2E_HAS_BACKEND;

/** Helper to create a local project via push-plan (the primary creation path). */
async function createLocalProject(
  request: ReturnType<typeof test.info>['fixme'] extends never
    ? never
    : unknown,
  name: string,
  items: Array<{
    title: string;
    description: string;
    priority?: string;
    estimated_effort?: string;
    dependencies: string[];
    tags: string[];
  }>
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const req = request as any;
  const response = await req.post(
    '/api/brainstorm/sessions/00000000-0000-0000-0000-000000000001/push-plan',
    {
      data: {
        new_project_name: name,
        create_repo: false,
        auto_create_workspaces: false,
        repo_ids: [],
        items,
      },
    }
  );
  return response;
}

test.describe('Local Kanban API', () => {
  test.skip(!HAS_BACKEND, 'Requires backend API');

  const NIL_ORG = '00000000-0000-0000-0000-000000000000';

  // ── Project CRUD ─────────────────────────────────────────────────

  test.describe('Projects', () => {
    test('should list projects (initially empty or existing)', async ({
      request,
    }) => {
      const response = await request.get(
        `/api/remote/projects?organization_id=${NIL_ORG}`
      );
      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body.data).toBeDefined();
      expect(body.data.projects).toBeInstanceOf(Array);
    });

    test('should create a project via push-plan and GET it', async ({
      request,
    }) => {
      const projectName = `API Project ${Date.now()}`;
      const response = await request.post(
        '/api/brainstorm/sessions/00000000-0000-0000-0000-000000000001/push-plan',
        {
          data: {
            new_project_name: projectName,
            create_repo: false,
            auto_create_workspaces: false,
            repo_ids: [],
            items: [
              {
                title: 'Setup task',
                description: 'Initial project setup',
                priority: 'high',
                estimated_effort: '1 hour',
                dependencies: [],
                tags: ['setup'],
              },
            ],
          },
        }
      );
      expect(response.ok()).toBeTruthy();
      const pushBody = await response.json();
      const projectId = pushBody.data.project_id;
      expect(projectId).toBeTruthy();

      // Verify GET project
      const getResponse = await request.get(
        `/api/remote/projects/${projectId}`
      );
      expect(getResponse.ok()).toBeTruthy();
      const project = await getResponse.json();
      expect(project.data.id).toBe(projectId);
      expect(project.data.name).toBe(projectName);
    });
  });

  // ── Project Statuses ─────────────────────────────────────────────

  test.describe('Project Statuses', () => {
    test('should list 4 default status columns for a new local project', async ({
      request,
    }) => {
      const pushResp = await request.post(
        '/api/brainstorm/sessions/00000000-0000-0000-0000-000000000001/push-plan',
        {
          data: {
            new_project_name: `Status Test ${Date.now()}`,
            create_repo: false,
            auto_create_workspaces: false,
            repo_ids: [],
            items: [
              {
                title: 'Placeholder',
                description: 'For status test',
                dependencies: [],
                tags: [],
              },
            ],
          },
        }
      );
      const pushBody = await pushResp.json();
      const projectId = pushBody.data.project_id;

      const response = await request.get(
        `/api/remote/project-statuses?project_id=${projectId}`
      );
      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      const statuses = body.data.project_statuses;

      expect(statuses).toHaveLength(4);
      const names = statuses.map((s: { name: string }) => s.name);
      expect(names).toContain('Backlog');
      expect(names).toContain('To Do');
      expect(names).toContain('In Progress');
      expect(names).toContain('Done');

      // Verify sort order
      const sorted = [...statuses].sort(
        (a: { sort_order: number }, b: { sort_order: number }) =>
          a.sort_order - b.sort_order
      );
      expect(sorted[0].name).toBe('Backlog');
      expect(sorted[3].name).toBe('Done');
    });
  });

  // ── Issue CRUD ───────────────────────────────────────────────────

  test.describe('Issues', () => {
    /** Helper: create a project and return { projectId, statusIds } */
    async function setupProject(request: any) {
      const pushResp = await request.post(
        '/api/brainstorm/sessions/00000000-0000-0000-0000-000000000001/push-plan',
        {
          data: {
            new_project_name: `Issue CRUD ${Date.now()}-${Math.random().toString(36).slice(2)}`,
            create_repo: false,
            auto_create_workspaces: false,
            repo_ids: [],
            items: [
              {
                title: 'Seed issue',
                description: 'Seeded by setup',
                dependencies: [],
                tags: [],
              },
            ],
          },
        }
      );
      const pushBody = await pushResp.json();
      const projectId = pushBody.data.project_id;

      const statusResp = await request.get(
        `/api/remote/project-statuses?project_id=${projectId}`
      );
      const statusBody = await statusResp.json();
      const statusIds = statusBody.data.project_statuses.map(
        (s: { id: string }) => s.id
      );
      return { projectId, statusIds };
    }

    test('should create an issue', async ({ request }) => {
      const { projectId, statusIds } = await setupProject(request);

      const response = await request.post('/api/remote/issues', {
        data: {
          project_id: projectId,
          status_id: statusIds[0],
          title: 'E2E Created Issue',
          description: 'Created by Playwright',
          priority: 'high',
          sort_order: 0,
          extension_metadata: {},
        },
      });
      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      const issue = body.data.data;

      expect(issue.title).toBe('E2E Created Issue');
      expect(issue.priority).toBe('high');
      expect(issue.simple_id).toMatch(/^[A-Z]+-\d+$/);
      expect(issue.project_id).toBe(projectId);
    });

    test('should list issues for a project', async ({ request }) => {
      const { projectId } = await setupProject(request);

      const response = await request.get(
        `/api/remote/issues?project_id=${projectId}`
      );
      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body.data.issues.length).toBeGreaterThanOrEqual(1);
    });

    test('should get a single issue', async ({ request }) => {
      const { projectId } = await setupProject(request);

      const listResp = await request.get(
        `/api/remote/issues?project_id=${projectId}`
      );
      const listBody = await listResp.json();
      const issueId = listBody.data.issues[0].id;

      const response = await request.get(`/api/remote/issues/${issueId}`);
      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body.data.id).toBe(issueId);
    });

    test('should update an issue', async ({ request }) => {
      const { projectId, statusIds } = await setupProject(request);

      const listResp = await request.get(
        `/api/remote/issues?project_id=${projectId}`
      );
      const listBody = await listResp.json();
      const issueId = listBody.data.issues[0].id;

      const response = await request.patch(`/api/remote/issues/${issueId}`, {
        data: {
          title: 'Updated Title',
          priority: 'low',
          status_id: statusIds[2], // In Progress
        },
      });
      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body.data.data.title).toBe('Updated Title');
      expect(body.data.data.priority).toBe('low');
      expect(body.data.data.status_id).toBe(statusIds[2]);
    });

    test('should delete an issue', async ({ request }) => {
      const { projectId, statusIds } = await setupProject(request);

      // Create a fresh issue to delete
      const createResp = await request.post('/api/remote/issues', {
        data: {
          project_id: projectId,
          status_id: statusIds[0],
          title: 'To Be Deleted',
          sort_order: 99,
          extension_metadata: {},
        },
      });
      const created = await createResp.json();
      const deleteId = created.data.data.id;

      const response = await request.delete(`/api/remote/issues/${deleteId}`);
      expect(response.ok()).toBeTruthy();

      // Verify it's gone
      const getResp = await request.get(`/api/remote/issues/${deleteId}`);
      expect(getResp.ok()).toBeFalsy();
    });
  });

  // ── Issue Tags ───────────────────────────────────────────────────

  test.describe('Issue Tags', () => {
    test('should create and list issue tags', async ({ request }) => {
      // Create a project + issue for tagging
      const pushResp = await request.post(
        '/api/brainstorm/sessions/00000000-0000-0000-0000-000000000001/push-plan',
        {
          data: {
            new_project_name: `Tag Test ${Date.now()}`,
            create_repo: false,
            auto_create_workspaces: false,
            repo_ids: [],
            items: [
              {
                title: 'Tag target issue',
                description: 'For tag tests',
                dependencies: [],
                tags: [],
              },
            ],
          },
        }
      );
      const pushBody = await pushResp.json();
      const issueId = pushBody.data.issue_ids[0];

      // Create a tag
      const tagId = crypto.randomUUID();
      const createResp = await request.post('/api/remote/issue-tags', {
        data: {
          issue_id: issueId,
          tag_id: tagId,
        },
      });
      expect(createResp.ok()).toBeTruthy();
      const createBody = await createResp.json();
      const issueTagId = createBody.data.data.id;
      expect(createBody.data.data.issue_id).toBe(issueId);
      expect(createBody.data.data.tag_id).toBe(tagId);

      // List tags — should contain the one we just created
      const listResp = await request.get(
        `/api/remote/issue-tags?issue_id=${issueId}`
      );
      expect(listResp.ok()).toBeTruthy();
      const listBody = await listResp.json();
      expect(listBody.data.issue_tags).toBeInstanceOf(Array);
      expect(listBody.data.issue_tags.length).toBeGreaterThanOrEqual(1);

      // Delete the tag
      const deleteResp = await request.delete(
        `/api/remote/issue-tags/${issueTagId}`
      );
      expect(deleteResp.ok()).toBeTruthy();
    });
  });

  // ── Issue Relationships ──────────────────────────────────────────

  test.describe('Issue Relationships', () => {
    test('should create, list, and delete a blocking relationship', async ({
      request,
    }) => {
      // Create a project with two issues
      const pushResp = await request.post(
        '/api/brainstorm/sessions/00000000-0000-0000-0000-000000000001/push-plan',
        {
          data: {
            new_project_name: `Relationship Test ${Date.now()}`,
            create_repo: false,
            auto_create_workspaces: false,
            repo_ids: [],
            items: [
              {
                title: 'Issue A',
                description: 'First',
                dependencies: [],
                tags: [],
              },
              {
                title: 'Issue B',
                description: 'Second',
                dependencies: [],
                tags: [],
              },
            ],
          },
        }
      );
      const pushBody = await pushResp.json();
      const issue1Id = pushBody.data.issue_ids[0];
      const issue2Id = pushBody.data.issue_ids[1];

      // Create a blocking relationship
      const createResp = await request.post(
        '/api/remote/issue-relationships',
        {
          data: {
            issue_id: issue1Id,
            related_issue_id: issue2Id,
            relationship_type: 'blocking',
          },
        }
      );
      expect(createResp.ok()).toBeTruthy();
      const createBody = await createResp.json();
      const relationshipId = createBody.data.data.id;
      expect(createBody.data.data.relationship_type).toBe('blocking');

      // List relationships
      const listResp = await request.get(
        `/api/remote/issue-relationships?issue_id=${issue1Id}`
      );
      expect(listResp.ok()).toBeTruthy();
      const listBody = await listResp.json();
      expect(
        listBody.data.issue_relationships.length
      ).toBeGreaterThanOrEqual(1);

      // Delete the relationship
      const deleteResp = await request.delete(
        `/api/remote/issue-relationships/${relationshipId}`
      );
      expect(deleteResp.ok()).toBeTruthy();
    });
  });
});

// ── Push Plan Integration Tests ───────────────────────────────────

test.describe('Push Plan Integration', () => {
  test.skip(!HAS_BACKEND, 'Requires backend API');

  test('should create project with multiple issues and correct metadata', async ({
    request,
  }) => {
    const projectName = `Push Plan E2E ${Date.now()}`;
    const response = await request.post(
      '/api/brainstorm/sessions/00000000-0000-0000-0000-000000000001/push-plan',
      {
        data: {
          new_project_name: projectName,
          create_repo: false,
          auto_create_workspaces: false,
          repo_ids: [],
          items: [
            {
              title: 'Authentication module',
              description: 'Implement JWT-based auth with refresh tokens',
              priority: 'high',
              estimated_effort: '3 days',
              dependencies: [],
              tags: ['backend', 'security'],
            },
            {
              title: 'Database schema',
              description: 'Design PostgreSQL schema',
              priority: 'high',
              estimated_effort: '2 days',
              dependencies: [],
              tags: ['backend', 'database'],
            },
            {
              title: 'REST API endpoints',
              description: 'Build CRUD endpoints',
              priority: 'medium',
              estimated_effort: '4 days',
              dependencies: ['Database schema'],
              tags: ['backend', 'api'],
            },
            {
              title: 'Frontend dashboard',
              description: 'React dashboard with charts',
              priority: 'low',
              estimated_effort: '5 days',
              dependencies: ['REST API endpoints'],
              tags: ['frontend', 'ui'],
            },
          ],
        },
      }
    );

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    const { project_id, issue_ids } = body.data;

    expect(project_id).toBeTruthy();
    expect(issue_ids).toHaveLength(4);

    // Verify project
    const projectResp = await request.get(
      `/api/remote/projects/${project_id}`
    );
    expect(projectResp.ok()).toBeTruthy();
    const project = await projectResp.json();
    expect(project.data.name).toBe(projectName);

    // Verify 4 status columns
    const statusResp = await request.get(
      `/api/remote/project-statuses?project_id=${project_id}`
    );
    const statuses = await statusResp.json();
    expect(statuses.data.project_statuses).toHaveLength(4);

    // Verify all issues
    const issuesResp = await request.get(
      `/api/remote/issues?project_id=${project_id}`
    );
    const issues = await issuesResp.json();
    expect(issues.data.issues).toHaveLength(4);

    const titles = issues.data.issues.map((i: { title: string }) => i.title);
    expect(titles).toContain('Authentication module');
    expect(titles).toContain('Database schema');
    expect(titles).toContain('REST API endpoints');
    expect(titles).toContain('Frontend dashboard');

    // Verify priorities
    const authIssue = issues.data.issues.find(
      (i: { title: string }) => i.title === 'Authentication module'
    );
    expect(authIssue.priority).toBe('high');

    // Verify description includes metadata
    expect(authIssue.description).toContain('JWT-based auth');
    expect(authIssue.description).toContain('**Estimated effort:** 3 days');
    expect(authIssue.description).toContain('**Tags:** backend, security');
  });

  test('should add issues to existing project', async ({ request }) => {
    // Create initial project
    const createResp = await request.post(
      '/api/brainstorm/sessions/00000000-0000-0000-0000-000000000001/push-plan',
      {
        data: {
          new_project_name: `Existing ${Date.now()}`,
          create_repo: false,
          auto_create_workspaces: false,
          repo_ids: [],
          items: [
            {
              title: 'Initial task',
              description: 'First',
              dependencies: [],
              tags: [],
            },
          ],
        },
      }
    );
    const existingProjectId = (await createResp.json()).data.project_id;

    // Push additional items
    const pushResp = await request.post(
      '/api/brainstorm/sessions/00000000-0000-0000-0000-000000000001/push-plan',
      {
        data: {
          project_id: existingProjectId,
          create_repo: false,
          auto_create_workspaces: false,
          repo_ids: [],
          items: [
            {
              title: 'Additional 1',
              description: 'Extra',
              dependencies: [],
              tags: [],
            },
            {
              title: 'Additional 2',
              description: 'Also extra',
              dependencies: [],
              tags: [],
            },
          ],
        },
      }
    );
    expect(pushResp.ok()).toBeTruthy();

    // Verify total = 3
    const issuesResp = await request.get(
      `/api/remote/issues?project_id=${existingProjectId}`
    );
    const issues = await issuesResp.json();
    expect(issues.data.issues).toHaveLength(3);
  });

  test('should generate sequential simple_ids', async ({ request }) => {
    const pushResp = await request.post(
      '/api/brainstorm/sessions/00000000-0000-0000-0000-000000000001/push-plan',
      {
        data: {
          new_project_name: `SeqID ${Date.now()}`,
          create_repo: false,
          auto_create_workspaces: false,
          repo_ids: [],
          items: [
            {
              title: 'Task One',
              description: 'First',
              dependencies: [],
              tags: [],
            },
            {
              title: 'Task Two',
              description: 'Second',
              dependencies: [],
              tags: [],
            },
            {
              title: 'Task Three',
              description: 'Third',
              dependencies: [],
              tags: [],
            },
          ],
        },
      }
    );
    const pushBody = await pushResp.json();
    const issuesResp = await request.get(
      `/api/remote/issues?project_id=${pushBody.data.project_id}`
    );
    const issues = await issuesResp.json();

    const numbers = issues.data.issues
      .map((i: { simple_id: string }) =>
        parseInt(i.simple_id.split('-')[1], 10)
      )
      .sort((a: number, b: number) => a - b);

    expect(numbers).toEqual([1, 2, 3]);
  });

  test('should reject when neither project_id nor new_project_name', async ({
    request,
  }) => {
    const response = await request.post(
      '/api/brainstorm/sessions/00000000-0000-0000-0000-000000000001/push-plan',
      {
        data: {
          create_repo: false,
          auto_create_workspaces: false,
          repo_ids: [],
          items: [
            {
              title: 'Orphan',
              description: 'No project',
              dependencies: [],
              tags: [],
            },
          ],
        },
      }
    );
    expect(response.ok()).toBeFalsy();
    expect(response.status()).toBe(400);
  });
});
