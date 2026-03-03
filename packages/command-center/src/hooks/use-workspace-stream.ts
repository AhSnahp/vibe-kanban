import { useJsonPatchWsStream } from '@/shared/hooks/useJsonPatchWsStream';
import type { Workspace } from '@cc/lib/workspace-api';

interface WorkspaceStreamData {
  task_attempts: Record<string, Workspace>;
}

/**
 * Streams all workspaces via the JSON Patch WebSocket.
 * Returns a live-updating map of workspace ID → Workspace.
 */
export function useWorkspaceStream(enabled = true) {
  const { data, isConnected, isInitialized, error } =
    useJsonPatchWsStream<WorkspaceStreamData>(
      '/api/task-attempts/stream/ws',
      enabled,
      () => ({ task_attempts: {} })
    );

  const workspaces = data
    ? Object.values(data.task_attempts)
    : ([] as Workspace[]);

  return { workspaces, isConnected, isInitialized, error };
}
