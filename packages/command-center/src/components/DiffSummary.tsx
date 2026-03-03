import { useJsonPatchWsStream } from '@/shared/hooks/useJsonPatchWsStream';
import { cn } from '@cc/lib/cn';

interface DiffEntry {
  path?: string;
  additions?: number;
  deletions?: number;
  [key: string]: unknown;
}

interface DiffStreamData {
  entries: DiffEntry[];
}

interface DiffSummaryProps {
  workspaceId: string | null;
  className?: string;
}

/**
 * Shows a compact diff summary — file count, additions, deletions.
 * Streams from the workspace diff WebSocket with stats_only mode.
 */
export function DiffSummary({ workspaceId, className }: DiffSummaryProps) {
  const endpoint = workspaceId
    ? `/api/task-attempts/${workspaceId}/diff/ws?stats_only=true`
    : undefined;

  const { data } = useJsonPatchWsStream<DiffStreamData>(
    endpoint,
    !!workspaceId,
    () => ({ entries: [] })
  );

  const entries = data?.entries ?? [];
  if (entries.length === 0) {
    return (
      <div className={cn('text-xs text-low', className)}>No changes yet</div>
    );
  }

  const totalAdd = entries.reduce((sum, e) => sum + (e.additions ?? 0), 0);
  const totalDel = entries.reduce((sum, e) => sum + (e.deletions ?? 0), 0);

  return (
    <div className={cn('flex flex-col gap-half', className)}>
      <div className="flex items-center gap-base text-xs">
        <span className="text-normal font-medium">
          {entries.length} file{entries.length !== 1 ? 's' : ''} changed
        </span>
        {totalAdd > 0 && (
          <span className="text-success font-mono">+{totalAdd}</span>
        )}
        {totalDel > 0 && (
          <span className="text-error font-mono">-{totalDel}</span>
        )}
      </div>
      <div className="flex flex-col gap-px max-h-48 overflow-y-auto">
        {entries.map((entry, i) => (
          <div
            key={entry.path ?? i}
            className="flex items-center gap-half text-xs font-mono"
          >
            <span className="flex-1 text-normal truncate">{entry.path}</span>
            {(entry.additions ?? 0) > 0 && (
              <span className="text-success">+{entry.additions}</span>
            )}
            {(entry.deletions ?? 0) > 0 && (
              <span className="text-error">-{entry.deletions}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
