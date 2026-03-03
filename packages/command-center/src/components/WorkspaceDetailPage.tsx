import { useState, useCallback } from 'react';
import { useParams, Link } from '@tanstack/react-router';
import { ArrowLeft } from '@phosphor-icons/react';
import { cn } from '@cc/lib/cn';
import { attemptsApi } from '@cc/lib/workspace-api';
import { useWorkspaceStore } from '@cc/stores/workspace-store';
import { useWorkspaceSessions } from '@cc/hooks/use-workspace-sessions';
import { useBranchStatus } from '@cc/hooks/use-branch-status';
import { useRalphLoop } from '@cc/hooks/use-ralph-loop';
import { AgentConversation } from './AgentConversation';
import { AgentFollowUpInput } from './AgentFollowUpInput';
import { DiffSummary } from './DiffSummary';
import { WorkspaceTerminal } from './WorkspaceTerminal';
import { WorkspaceActionBar } from './WorkspaceActionBar';
import { ModeToggle } from './ModeToggle';

type Tab = 'conversation' | 'diff' | 'terminal';

export function WorkspaceDetailPage() {
  const { workspaceId } = useParams({
    from: '/workspaces/$workspaceId',
  });
  const [tab, setTab] = useState<Tab>('conversation');

  const runtime = useWorkspaceStore((s) => s.runtimes[workspaceId]);
  const { data: sessions } = useWorkspaceSessions(workspaceId);
  const { data: branchStatuses } = useBranchStatus(workspaceId);

  // Use the latest session
  const latestSession = sessions?.[sessions.length - 1];
  const sessionId = runtime?.sessionId ?? latestSession?.id;

  const { isAttemptRunning, continueLoop, sendCustomFollowUp, stopLoop } =
    useRalphLoop({
      workspaceId,
      sessionId,
      enabled: !!sessionId && !!runtime,
    });

  const handleMerge = useCallback(async () => {
    if (!branchStatuses?.[0]) return;
    try {
      await attemptsApi.merge(workspaceId, {
        repo_id: branchStatuses[0].repo_id,
      });
      useWorkspaceStore.getState().updateRuntime(workspaceId, {
        loopState: 'done',
      });
    } catch (err) {
      useWorkspaceStore.getState().updateRuntime(workspaceId, {
        loopState: 'failed',
        error: err instanceof Error ? err.message : 'Merge failed',
      });
    }
  }, [workspaceId, branchStatuses]);

  const handleStop = useCallback(async () => {
    if (runtime?.latestProcessId) {
      try {
        await attemptsApi.stop(workspaceId);
      } catch {
        // process may already be stopped
      }
    }
    stopLoop();
  }, [workspaceId, runtime?.latestProcessId, stopLoop]);

  const branchInfo = branchStatuses?.[0];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-base p-base border-b bg-secondary">
        <Link to="/workspaces" className="text-low hover:text-normal">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-high truncate">
            Workspace
          </h1>
          {branchInfo && (
            <p className="text-xs text-low font-mono truncate">
              {branchInfo.target_branch_name}
              {branchInfo.commits_ahead != null &&
                branchInfo.commits_ahead > 0 &&
                ` (+${branchInfo.commits_ahead})`}
            </p>
          )}
        </div>
        <ModeToggle />
      </div>

      {/* Tab bar */}
      <div className="flex border-b bg-primary">
        {(['conversation', 'diff', 'terminal'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-base py-half text-xs font-medium capitalize',
              tab === t
                ? 'text-brand border-b-2 border-brand'
                : 'text-low hover:text-normal'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {tab === 'conversation' ? (
          <AgentConversation
            processId={runtime?.latestProcessId ?? null}
            className="h-full"
          />
        ) : tab === 'diff' ? (
          <div className="p-base overflow-y-auto h-full">
            <DiffSummary workspaceId={workspaceId} />
          </div>
        ) : (
          <WorkspaceTerminal workspaceId={workspaceId} />
        )}
      </div>

      {/* Follow-up input */}
      {sessionId && (
        <AgentFollowUpInput
          onSend={sendCustomFollowUp}
          disabled={isAttemptRunning}
          placeholder={
            isAttemptRunning
              ? 'Agent is working...'
              : 'Send a follow-up message...'
          }
        />
      )}

      {/* Action bar */}
      <WorkspaceActionBar
        workspaceId={workspaceId}
        onContinue={continueLoop}
        onStop={handleStop}
        onMerge={handleMerge}
        isAttemptRunning={isAttemptRunning}
      />
    </div>
  );
}
