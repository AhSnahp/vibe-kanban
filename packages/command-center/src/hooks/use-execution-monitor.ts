import { useEffect, useRef } from 'react';
import { useExecutionProcesses } from '@/shared/hooks/useExecutionProcesses';
import { ExecutionProcessStatus } from 'shared/types';

interface UseExecutionMonitorOptions {
  sessionId: string | undefined;
  onCompleted?: (processId: string) => void;
  onFailed?: (processId: string) => void;
}

/**
 * Monitors execution processes for a session and fires callbacks
 * when the latest coding-agent process transitions to a terminal state.
 */
export function useExecutionMonitor({
  sessionId,
  onCompleted,
  onFailed,
}: UseExecutionMonitorOptions) {
  const { executionProcesses, isAttemptRunning, isLoading, error } =
    useExecutionProcesses(sessionId);

  // Track the last status we've reacted to, to avoid duplicate callbacks
  const lastSeenRef = useRef<{
    processId: string;
    status: ExecutionProcessStatus;
  } | null>(null);

  useEffect(() => {
    if (executionProcesses.length === 0) return;

    // Look at the most recent process (sorted ascending by created_at)
    const latest = executionProcesses[executionProcesses.length - 1];
    if (!latest || latest.run_reason !== 'codingagent') return;

    const seen = lastSeenRef.current;
    if (seen?.processId === latest.id && seen?.status === latest.status) return;

    lastSeenRef.current = { processId: latest.id, status: latest.status };

    if (latest.status === ExecutionProcessStatus.completed) {
      onCompleted?.(latest.id);
    } else if (
      latest.status === ExecutionProcessStatus.failed ||
      latest.status === ExecutionProcessStatus.killed
    ) {
      onFailed?.(latest.id);
    }
  }, [executionProcesses, onCompleted, onFailed]);

  return { executionProcesses, isAttemptRunning, isLoading, error };
}
