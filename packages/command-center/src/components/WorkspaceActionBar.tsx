import { Stop, Play, GitMerge, Spinner } from '@phosphor-icons/react';
import { cn } from '@cc/lib/cn';
import { useWorkspaceStore, type LoopState } from '@cc/stores/workspace-store';

const stateLabels: Record<LoopState, string> = {
  idle: 'Idle',
  launching: 'Launching...',
  running: 'Agent running',
  evaluating: 'Evaluating...',
  following_up: 'Sending follow-up...',
  paused: 'Paused — waiting for review',
  done: 'Done',
  failed: 'Failed',
};

const stateColors: Record<LoopState, string> = {
  idle: 'bg-gray-400',
  launching: 'bg-yellow-400 animate-pulse',
  running: 'bg-brand animate-pulse',
  evaluating: 'bg-yellow-400 animate-pulse',
  following_up: 'bg-yellow-400 animate-pulse',
  paused: 'bg-blue-400',
  done: 'bg-success',
  failed: 'bg-error',
};

interface WorkspaceActionBarProps {
  workspaceId: string;
  onContinue: () => void;
  onStop: () => void;
  onMerge: () => void;
  isAttemptRunning: boolean;
  className?: string;
}

export function WorkspaceActionBar({
  workspaceId,
  onContinue,
  onStop,
  onMerge,
  isAttemptRunning,
  className,
}: WorkspaceActionBarProps) {
  const runtime = useWorkspaceStore((s) => s.runtimes[workspaceId]);
  const loopState = runtime?.loopState ?? 'idle';
  const iterations = runtime?.iterations ?? 0;

  return (
    <div
      className={cn(
        'flex items-center gap-base p-half border-t bg-secondary',
        className
      )}
    >
      {/* Status indicator */}
      <div className="flex items-center gap-half flex-1">
        <div
          className={cn(
            'h-2 w-2 rounded-full shrink-0',
            stateColors[loopState]
          )}
        />
        <span className="text-xs text-normal">{stateLabels[loopState]}</span>
        {iterations > 0 && (
          <span className="text-xs text-low">(iteration {iterations})</span>
        )}
        {runtime?.error && (
          <span className="text-xs text-error truncate max-w-[200px]">
            {runtime.error}
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-half">
        {loopState === 'paused' && (
          <button
            onClick={onContinue}
            className="flex items-center gap-half px-base py-half text-xs font-medium rounded-sm bg-brand text-on-brand hover:bg-brand-hover"
          >
            <Play size={12} weight="fill" />
            Continue
          </button>
        )}

        {(loopState === 'done' || loopState === 'paused') && (
          <button
            onClick={onMerge}
            className="flex items-center gap-half px-base py-half text-xs font-medium rounded-sm bg-merged text-white hover:opacity-90"
          >
            <GitMerge size={12} weight="fill" />
            Merge
          </button>
        )}

        {isAttemptRunning && (
          <button
            onClick={onStop}
            className="flex items-center gap-half px-base py-half text-xs font-medium rounded-sm border text-error hover:bg-error/10"
          >
            <Stop size={12} weight="fill" />
            Stop
          </button>
        )}

        {(loopState === 'running' ||
          loopState === 'evaluating' ||
          loopState === 'following_up') && (
          <Spinner size={14} className="text-low animate-spin" />
        )}
      </div>
    </div>
  );
}
