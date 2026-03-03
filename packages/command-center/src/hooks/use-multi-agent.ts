import { useCallback, useMemo } from 'react';
import {
  useWorkspaceStore,
  type WorkspaceRuntime,
} from '@cc/stores/workspace-store';
import { attemptsApi } from '@cc/lib/workspace-api';
import { sendFollowUp } from './use-ralph-loop';

interface AggregateStatus {
  total: number;
  running: number;
  done: number;
  failed: number;
  paused: number;
  label: string;
}

/**
 * Manages multi-agent state derived from workspace store.
 * Provides batch operations (stop all, continue all) and aggregate status.
 */
export function useMultiAgent(workspaceIds: string[]) {
  const runtimes = useWorkspaceStore((s) => s.runtimes);

  const runtimeList = useMemo(
    () =>
      workspaceIds
        .map((id) => ({ id, runtime: runtimes[id] }))
        .filter(
          (x): x is { id: string; runtime: WorkspaceRuntime } => !!x.runtime
        ),
    [workspaceIds, runtimes]
  );

  const aggregateStatus = useMemo((): AggregateStatus => {
    const counts: Record<string, number> = {};
    for (const { runtime } of runtimeList) {
      counts[runtime.loopState] = (counts[runtime.loopState] ?? 0) + 1;
    }

    const running =
      (counts['running'] ?? 0) +
      (counts['evaluating'] ?? 0) +
      (counts['following_up'] ?? 0) +
      (counts['launching'] ?? 0);
    const done = counts['done'] ?? 0;
    const failed = counts['failed'] ?? 0;
    const paused = counts['paused'] ?? 0;

    const parts: string[] = [];
    if (running > 0) parts.push(`${running} running`);
    if (paused > 0) parts.push(`${paused} paused`);
    if (done > 0) parts.push(`${done} done`);
    if (failed > 0) parts.push(`${failed} failed`);

    return {
      total: runtimeList.length,
      running,
      done,
      failed,
      paused,
      label: parts.join(', ') || 'idle',
    };
  }, [runtimeList]);

  const stopAll = useCallback(async () => {
    const store = useWorkspaceStore.getState();
    const stopPromises = workspaceIds.map(async (wsId) => {
      const rt = store.runtimes[wsId];
      if (
        rt &&
        ['running', 'evaluating', 'following_up', 'launching'].includes(
          rt.loopState
        )
      ) {
        try {
          await attemptsApi.stop(wsId);
        } catch {
          // process may already be stopped
        }
        store.updateRuntime(wsId, { loopState: 'done' });
      }
    });
    await Promise.allSettled(stopPromises);
  }, [workspaceIds]);

  const continueAll = useCallback(async () => {
    const store = useWorkspaceStore.getState();
    const promises = workspaceIds.map(async (wsId) => {
      const rt = store.runtimes[wsId];
      if (rt?.loopState === 'paused' && rt.sessionId) {
        try {
          await sendFollowUp(wsId, rt.sessionId);
        } catch {
          // handled in sendFollowUp — sets loopState to 'failed'
        }
      }
    });
    await Promise.allSettled(promises);
  }, [workspaceIds]);

  const isAnyRunning = aggregateStatus.running > 0;

  return {
    runtimeList,
    aggregateStatus,
    stopAll,
    continueAll,
    isAnyRunning,
  };
}
