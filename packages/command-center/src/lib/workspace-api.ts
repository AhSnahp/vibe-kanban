// Re-exports from web-core for clean command-center imports.
// All workspace/session/execution APIs go through here.

export {
  attemptsApi,
  sessionsApi,
  repoApi,
  configApi,
  executionProcessesApi,
} from '@/shared/lib/api';

export type {
  Workspace,
  Session,
  ExecutionProcess,
  ExecutionProcessStatus,
  ExecutionProcessRunReason,
  CreateAndStartWorkspaceRequest,
  CreateAndStartWorkspaceResponse,
  CreateFollowUpAttempt,
  ExecutorConfig,
  WorkspaceRepoInput,
  LinkedIssueInfo,
  RepoBranchStatus,
  Repo,
  UserSystemInfo,
  BaseCodingAgent,
} from 'shared/types';
