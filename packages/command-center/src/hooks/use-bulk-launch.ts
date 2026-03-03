import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { attemptsApi } from '@cc/lib/workspace-api';
import type { CreateAndStartWorkspaceRequest } from '@cc/lib/workspace-api';
import { workspaceKeys } from '@cc/lib/query-keys';
import { useWorkspaceStore } from '@cc/stores/workspace-store';

interface BulkLaunchProgress {
  total: number;
  completed: number;
  failed: number;
}

interface BulkLaunchItem {
  issueId: string;
  data: CreateAndStartWorkspaceRequest;
}

/**
 * Launches N workspaces in parallel, tracking progress.
 * Each successful launch initializes a runtime with the issueId link.
 */
export function useBulkLaunch() {
  const qc = useQueryClient();
  const initRuntime = useWorkspaceStore((s) => s.initRuntime);
  const [progress, setProgress] = useState<BulkLaunchProgress>({
    total: 0,
    completed: 0,
    failed: 0,
  });
  const [isLaunching, setIsLaunching] = useState(false);

  const launch = useCallback(
    async (items: BulkLaunchItem[]): Promise<string[]> => {
      setIsLaunching(true);
      setProgress({ total: items.length, completed: 0, failed: 0 });

      const workspaceIds: string[] = [];

      const promises = items.map(async (item) => {
        try {
          const res = await attemptsApi.createAndStart(item.data);
          const { workspace, execution_process } = res;
          initRuntime(workspace.id, execution_process.session_id, item.issueId);
          useWorkspaceStore.getState().updateRuntime(workspace.id, {
            loopState: 'running',
            latestProcessId: execution_process.id,
            iterations: 1,
          });
          workspaceIds.push(workspace.id);
          setProgress((p) => ({ ...p, completed: p.completed + 1 }));
        } catch {
          setProgress((p) => ({ ...p, failed: p.failed + 1 }));
        }
      });

      await Promise.allSettled(promises);
      qc.invalidateQueries({ queryKey: workspaceKeys.all });
      setIsLaunching(false);
      return workspaceIds;
    },
    [qc, initRuntime]
  );

  return { launch, progress, isLaunching };
}
