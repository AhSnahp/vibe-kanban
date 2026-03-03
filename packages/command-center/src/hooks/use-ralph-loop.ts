import { useCallback, useRef } from 'react';
import { streamJsonPatchEntries } from '@/shared/lib/streamJsonPatchEntries';
import { sessionsApi } from '@cc/lib/workspace-api';
import { BaseCodingAgent } from 'shared/types';
import { useWorkspaceStore } from '@cc/stores/workspace-store';
import { useExecutionMonitor } from './use-execution-monitor';

const FOLLOW_UP_PROMPT =
  'Review all the changes you made. Check for bugs, missing edge cases, and code quality issues. If everything looks good, respond with just the word DONE on its own line. Otherwise, fix any issues you find.';

const DONE_REGEX = /^DONE$/m;
const ENTRY_LOAD_TIMEOUT_MS = 10_000;

interface LogEntry {
  role?: string;
  content?: string;
  [key: string]: unknown;
}

interface UseRalphLoopOptions {
  workspaceId: string;
  sessionId: string | undefined;
  enabled: boolean;
}

/**
 * Core orchestrator for the Ralph Loop agent cycle.
 *
 * On each execution process completion:
 * 1. Load normalized log entries to find the last assistant message
 * 2. Check for DONE marker or max iterations
 * 3. Based on mode, either auto-follow-up (send-it) or pause (review)
 */
export function useRalphLoop({
  workspaceId,
  sessionId,
  enabled,
}: UseRalphLoopOptions) {
  const processingRef = useRef(false);
  const store = useWorkspaceStore;
  const updateRuntime = store((s) => s.updateRuntime);

  const evaluateCompletion = useCallback(
    async (processId: string) => {
      // Prevent double-evaluation from concurrent renders
      if (processingRef.current) return;
      processingRef.current = true;

      const state = store.getState();
      const runtime = state.runtimes[workspaceId];
      if (!runtime?.sessionId) {
        processingRef.current = false;
        return;
      }

      updateRuntime(workspaceId, { loopState: 'evaluating' });

      try {
        // Load normalized log entries to find last assistant message
        const lastMessage = await loadLastAssistantMessage(processId);
        updateRuntime(workspaceId, { lastAssistantMessage: lastMessage });

        // Check for DONE marker
        if (lastMessage && DONE_REGEX.test(lastMessage)) {
          updateRuntime(workspaceId, { loopState: 'done' });
          processingRef.current = false;
          return;
        }

        // Check max iterations (re-read state for fresh value)
        const freshState = store.getState();
        const freshRuntime = freshState.runtimes[workspaceId];
        if (
          freshRuntime &&
          freshRuntime.iterations >= freshState.maxIterations
        ) {
          updateRuntime(workspaceId, { loopState: 'done' });
          processingRef.current = false;
          return;
        }

        // Read mode at evaluation time (not closure capture time)
        const { mode } = freshState;

        if (mode === 'review') {
          updateRuntime(workspaceId, { loopState: 'paused' });
          processingRef.current = false;
          return;
        }

        // send-it mode: auto-follow-up
        await sendFollowUp(workspaceId, runtime.sessionId);
      } catch (err) {
        updateRuntime(workspaceId, {
          loopState: 'failed',
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        processingRef.current = false;
      }
    },
    [workspaceId, updateRuntime, store]
  );

  const handleFailed = useCallback(
    (processId: string) => {
      updateRuntime(workspaceId, {
        loopState: 'failed',
        latestProcessId: processId,
        error: 'Agent process failed or was killed',
      });
    },
    [workspaceId, updateRuntime]
  );

  const { executionProcesses, isAttemptRunning } = useExecutionMonitor({
    sessionId: enabled ? sessionId : undefined,
    onCompleted: (processId) => {
      updateRuntime(workspaceId, { latestProcessId: processId });
      void evaluateCompletion(processId);
    },
    onFailed: handleFailed,
  });

  // Manual continue (from review mode pause)
  const continueLoop = useCallback(async () => {
    const state = store.getState();
    const runtime = state.runtimes[workspaceId];
    if (!runtime?.sessionId) return;
    await sendFollowUp(workspaceId, runtime.sessionId);
  }, [workspaceId, store]);

  // Manual follow-up with custom prompt
  const sendCustomFollowUp = useCallback(
    async (prompt: string) => {
      const state = store.getState();
      const runtime = state.runtimes[workspaceId];
      if (!runtime?.sessionId) return;
      await sendFollowUp(workspaceId, runtime.sessionId, prompt);
    },
    [workspaceId, store]
  );

  // Stop the loop
  const stopLoop = useCallback(() => {
    updateRuntime(workspaceId, { loopState: 'done' });
  }, [workspaceId, updateRuntime]);

  return {
    executionProcesses,
    isAttemptRunning,
    continueLoop,
    sendCustomFollowUp,
    stopLoop,
  };
}

/** Load normalized logs for a process and extract the last assistant message. */
async function loadLastAssistantMessage(
  processId: string
): Promise<string | null> {
  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const ctrl = streamJsonPatchEntries<LogEntry>(
      `/api/execution-processes/${processId}/normalized-logs/ws`,
      {
        onFinished: (entries) => {
          clearTimeout(timeoutId);
          const last = findLastAssistant(entries);
          ctrl.close();
          resolve(last);
        },
        onError: () => {
          clearTimeout(timeoutId);
          ctrl.close();
          resolve(null);
        },
      }
    );

    // Safety timeout — if the WS never sends "finished"
    timeoutId = setTimeout(() => {
      const entries = ctrl.getEntries();
      ctrl.close();
      resolve(findLastAssistant(entries));
    }, ENTRY_LOAD_TIMEOUT_MS);
  });
}

function findLastAssistant(entries: LogEntry[]): string | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e?.role === 'assistant' && typeof e.content === 'string') {
      return e.content;
    }
  }
  return null;
}

/** Send a follow-up message and update the store. */
export async function sendFollowUp(
  workspaceId: string,
  sessionId: string,
  prompt = FOLLOW_UP_PROMPT
) {
  const store = useWorkspaceStore;
  const state = store.getState();
  const runtime = state.runtimes[workspaceId];

  store.getState().updateRuntime(workspaceId, { loopState: 'following_up' });

  const process = await sessionsApi.followUp(sessionId, {
    prompt,
    executor_config: {
      executor: state.defaultExecutor as BaseCodingAgent,
    },
    retry_process_id: null,
    force_when_dirty: null,
    perform_git_reset: null,
  });

  store.getState().updateRuntime(workspaceId, {
    loopState: 'running',
    latestProcessId: process.id,
    iterations: (runtime?.iterations ?? 0) + 1,
  });
}
