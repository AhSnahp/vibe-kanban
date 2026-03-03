import { Link } from '@tanstack/react-router';
import { cn } from '@cc/lib/cn';
import { useWorkspaceStore, type LoopState } from '@cc/stores/workspace-store';
import type { Workspace } from '@cc/lib/workspace-api';

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

export function WorkspaceCard({ workspace }: { workspace: Workspace }) {
  const runtime = useWorkspaceStore((s) => s.runtimes[workspace.id]);
  const loopState = runtime?.loopState ?? 'idle';
  const iterations = runtime?.iterations ?? 0;

  return (
    <Link
      to="/workspaces/$workspaceId"
      params={{ workspaceId: workspace.id }}
      className={cn(
        'flex items-center gap-base p-base border rounded-sm',
        'bg-primary hover:bg-secondary transition-colors'
      )}
    >
      <div
        className={cn('h-2 w-2 rounded-full shrink-0', dotColor[loopState])}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-high truncate">
          {workspace.name ?? 'Untitled workspace'}
        </p>
        <p className="text-xs text-low font-mono truncate">
          {workspace.branch}
        </p>
      </div>
      {iterations > 0 && (
        <span className="text-xs text-low shrink-0">
          {iterations} iter{iterations !== 1 ? 's' : ''}
        </span>
      )}
    </Link>
  );
}
