import { useMutation, useQueryClient } from '@tanstack/react-query';
import { attemptsApi } from '@cc/lib/workspace-api';
import type { CreateAndStartWorkspaceRequest } from '@cc/lib/workspace-api';
import { workspaceKeys } from '@cc/lib/query-keys';
import { useWorkspaceStore } from '@cc/stores/workspace-store';

interface LaunchContext {
  issueId?: string;
}

export function useLaunchWorkspace() {
  const qc = useQueryClient();
  const initRuntime = useWorkspaceStore((s) => s.initRuntime);

  return useMutation({
    mutationFn: (vars: {
      data: CreateAndStartWorkspaceRequest;
      context?: LaunchContext;
    }) => attemptsApi.createAndStart(vars.data),
    onSuccess: (res, vars) => {
      const { workspace, execution_process } = res;
      initRuntime(
        workspace.id,
        execution_process.session_id,
        vars.context?.issueId
      );
      useWorkspaceStore.getState().updateRuntime(workspace.id, {
        loopState: 'running',
        latestProcessId: execution_process.id,
        iterations: 1,
      });
      qc.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
}
