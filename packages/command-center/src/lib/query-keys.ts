export const projectKeys = {
  all: ['projects'] as const,
  list: () => [...projectKeys.all, 'list'] as const,
};

export const kanbanKeys = {
  all: (projectId: string) => ['kanban', projectId] as const,
  statuses: (projectId: string) =>
    [...kanbanKeys.all(projectId), 'statuses'] as const,
  issues: (projectId: string) =>
    [...kanbanKeys.all(projectId), 'issues'] as const,
  tags: (projectId: string) => [...kanbanKeys.all(projectId), 'tags'] as const,
  issueTags: (projectId: string) =>
    [...kanbanKeys.all(projectId), 'issueTags'] as const,
};

export const workspaceKeys = {
  all: ['workspaces'] as const,
  detail: (id: string) => [...workspaceKeys.all, id] as const,
  sessions: (wsId: string) => [...workspaceKeys.all, wsId, 'sessions'] as const,
  branchStatus: (wsId: string) =>
    [...workspaceKeys.all, wsId, 'branchStatus'] as const,
};

export const repoKeys = {
  all: ['repos'] as const,
  recent: () => [...repoKeys.all, 'recent'] as const,
};

export const configKeys = {
  info: ['config', 'info'] as const,
};
