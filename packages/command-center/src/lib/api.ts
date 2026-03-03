// Typed fetch wrappers for /v1 endpoints (local SQLite backend)
// GETs are nested under /v1/fallback, mutations under /v1

const READ_BASE = '/v1/fallback';
const WRITE_BASE = '/v1';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${READ_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`GET ${path} failed: ${res.status}`);
  }
  return res.json();
}

async function mutate<T>(
  path: string,
  method: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${WRITE_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    throw new Error(`${method} ${path} failed: ${res.status}`);
  }
  return res.json();
}

// ---------- Types ----------

export type Project = {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ProjectStatus = {
  id: string;
  project_id: string;
  name: string;
  color: string;
  sort_order: number;
  hidden: boolean;
  created_at: string;
};

export type Issue = {
  id: string;
  project_id: string;
  issue_number: number;
  simple_id: string;
  status_id: string;
  title: string;
  description: string | null;
  priority: 'urgent' | 'high' | 'medium' | 'low' | null;
  start_date: string | null;
  target_date: string | null;
  completed_at: string | null;
  sort_order: number;
  parent_issue_id: string | null;
  parent_issue_sort_order: number | null;
  extension_metadata: Record<string, unknown>;
  creator_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Tag = {
  id: string;
  project_id: string;
  name: string;
  color: string;
};

export type IssueTag = {
  id: string;
  issue_id: string;
  tag_id: string;
};

// ---------- GET ----------

export async function fetchProjects(): Promise<Project[]> {
  const data = await get<{ projects: Project[] }>('/projects');
  return data.projects;
}

export async function fetchStatuses(
  projectId: string
): Promise<ProjectStatus[]> {
  const data = await get<{ project_statuses: ProjectStatus[] }>(
    `/project_statuses?project_id=${projectId}`
  );
  return data.project_statuses;
}

export async function fetchIssues(projectId: string): Promise<Issue[]> {
  const data = await get<{ issues: Issue[] }>(
    `/issues?project_id=${projectId}`
  );
  return data.issues;
}

export async function fetchTags(projectId: string): Promise<Tag[]> {
  const data = await get<{ tags: Tag[] }>(`/tags?project_id=${projectId}`);
  return data.tags;
}

export async function fetchIssueTags(projectId: string): Promise<IssueTag[]> {
  const data = await get<{ issue_tags: IssueTag[] }>(
    `/issue_tags?project_id=${projectId}`
  );
  return data.issue_tags;
}

// ---------- Mutations ----------

type TxidResponse = { txid: number };

export async function createProject(
  name: string,
  color = '#3b82f6'
): Promise<TxidResponse> {
  return mutate<TxidResponse>('/projects', 'POST', { name, color });
}

export async function createIssue(params: {
  project_id: string;
  status_id: string;
  title: string;
  description?: string;
  priority?: string;
  sort_order: number;
}): Promise<TxidResponse> {
  return mutate<TxidResponse>('/issues', 'POST', params);
}

export async function updateIssue(
  id: string,
  updates: Partial<
    Pick<
      Issue,
      | 'title'
      | 'description'
      | 'priority'
      | 'status_id'
      | 'sort_order'
      | 'start_date'
      | 'target_date'
    >
  >
): Promise<TxidResponse> {
  return mutate<TxidResponse>(`/issues/${id}`, 'PATCH', updates);
}

export async function deleteIssue(id: string): Promise<TxidResponse> {
  return mutate<TxidResponse>(`/issues/${id}`, 'DELETE');
}

export async function bulkUpdateIssues(
  updates: Array<
    { id: string } & Partial<Pick<Issue, 'status_id' | 'sort_order'>>
  >
): Promise<TxidResponse> {
  return mutate<TxidResponse>('/issues/bulk', 'POST', { updates });
}
