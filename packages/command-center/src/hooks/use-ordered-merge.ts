import { useState, useCallback } from 'react';
import { attemptsApi } from '@cc/lib/workspace-api';

interface MergeProgress {
  total: number;
  completed: number;
  failed: number;
  currentWorkspaceId: string | null;
}

/**
 * Sequential merge respecting dependency order.
 * Merges workspaces one at a time to avoid conflicts.
 */
export function useOrderedMerge() {
  const [progress, setProgress] = useState<MergeProgress>({
    total: 0,
    completed: 0,
    failed: 0,
    currentWorkspaceId: null,
  });
  const [isMerging, setIsMerging] = useState(false);

  const mergeAll = useCallback(
    async (
      workspaceIds: string[],
      repoId: string
    ): Promise<{ succeeded: string[]; failed: string[] }> => {
      setIsMerging(true);
      setProgress({
        total: workspaceIds.length,
        completed: 0,
        failed: 0,
        currentWorkspaceId: null,
      });

      const succeeded: string[] = [];
      const failed: string[] = [];

      for (const wsId of workspaceIds) {
        setProgress((p) => ({ ...p, currentWorkspaceId: wsId }));
        try {
          await attemptsApi.merge(wsId, { repo_id: repoId });
          succeeded.push(wsId);
          setProgress((p) => ({
            ...p,
            completed: p.completed + 1,
          }));
        } catch {
          failed.push(wsId);
          setProgress((p) => ({
            ...p,
            failed: p.failed + 1,
          }));
        }
      }

      setProgress((p) => ({ ...p, currentWorkspaceId: null }));
      setIsMerging(false);
      return { succeeded, failed };
    },
    []
  );

  return { mergeAll, progress, isMerging };
}
