import { cn } from '@cc/lib/cn';
import { DiffSummary } from './DiffSummary';

interface AggregateDiffViewProps {
  workspaceIds: string[];
  className?: string;
}

/**
 * Combined diff view for multiple workspaces.
 * Shows each workspace's diff summary stacked vertically.
 */
export function AggregateDiffView({
  workspaceIds,
  className,
}: AggregateDiffViewProps) {
  if (workspaceIds.length === 0) {
    return (
      <div className={cn('text-xs text-low', className)}>
        No workspaces to diff
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-base', className)}>
      {workspaceIds.map((wsId) => (
        <div key={wsId} className="border rounded-sm p-base">
          <span className="text-xs font-mono text-low mb-half block">
            {wsId.slice(0, 8)}...
          </span>
          <DiffSummary workspaceId={wsId} />
        </div>
      ))}
    </div>
  );
}
