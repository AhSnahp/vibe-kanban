import { useState } from 'react';
import { cn } from '@cc/lib/cn';
import { useWorkspaceStore, type LoopState } from '@cc/stores/workspace-store';
import { AgentConversation } from './AgentConversation';
import { DiffSummary } from './DiffSummary';
import { WorkspaceTerminal } from './WorkspaceTerminal';

const dotColor: Record<LoopState, string> = {
  idle: 'bg-gray-400',
  launching: 'bg-yellow-400',
  running: 'bg-brand animate-pulse',
  evaluating: 'bg-yellow-400 animate-pulse',
  following_up: 'bg-yellow-400 animate-pulse',
  paused: 'bg-blue-400',
  done: 'bg-success',
  failed: 'bg-error',
};

type PaneTab = 'conversation' | 'diff' | 'terminal';

interface WorkspacePaneProps {
  workspaceId: string;
  isActive: boolean;
}

/**
 * Compact workspace view for embedding in the multi-agent split layout.
 * Shows a status header + tabbed content (conversation, diff, terminal).
 */
export function WorkspacePane({ workspaceId, isActive }: WorkspacePaneProps) {
  const [tab, setTab] = useState<PaneTab>('conversation');
  const runtime = useWorkspaceStore((s) => s.runtimes[workspaceId]);
  const loopState = runtime?.loopState ?? 'idle';

  return (
    <div
      className={cn(
        'flex flex-col h-full border rounded-sm overflow-hidden',
        isActive ? 'border-brand/50' : 'border-border'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-half px-base py-half bg-secondary border-b shrink-0">
        <div
          className={cn('h-2 w-2 rounded-full shrink-0', dotColor[loopState])}
        />
        <span className="text-xs font-medium text-high truncate flex-1">
          {workspaceId.slice(0, 8)}...
        </span>
        {runtime?.iterations ? (
          <span className="text-xs text-low">
            {runtime.iterations} iter
            {runtime.iterations !== 1 ? 's' : ''}
          </span>
        ) : null}
      </div>

      {/* Tabs */}
      <div className="flex border-b bg-primary shrink-0">
        {(['conversation', 'diff', 'terminal'] as PaneTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-half py-px text-xs capitalize',
              tab === t
                ? 'text-brand border-b border-brand'
                : 'text-low hover:text-normal'
            )}
          >
            {t === 'conversation' ? 'chat' : t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'conversation' ? (
          <AgentConversation
            processId={runtime?.latestProcessId ?? null}
            className="h-full"
          />
        ) : tab === 'diff' ? (
          <div className="p-half overflow-y-auto h-full">
            <DiffSummary workspaceId={workspaceId} />
          </div>
        ) : (
          <WorkspaceTerminal workspaceId={workspaceId} />
        )}
      </div>
    </div>
  );
}
