import { Check, X, Warning } from '@phosphor-icons/react';
import { cn } from '@cc/lib/cn';
import type { WorkflowPhase } from '@cc/stores/workflow-store';
import { DiffSummary } from './DiffSummary';

interface SanityCheckPanelProps {
  phase: WorkflowPhase;
  onApprove: () => void;
  onAbort: () => void;
}

/**
 * Review panel shown during the sanity_check phase status.
 * Shows aggregate diffs for all task workspaces + approve/abort buttons.
 */
export function SanityCheckPanel({
  phase,
  onApprove,
  onAbort,
}: SanityCheckPanelProps) {
  const doneTasks = phase.tasks.filter((t) => t.status === 'done');
  const failedTasks = phase.tasks.filter((t) => t.status === 'failed');

  return (
    <div className="flex flex-col gap-base p-base">
      <div className="flex items-center gap-half">
        <Warning size={16} className="text-yellow-400" />
        <h3 className="text-sm font-semibold text-high">
          Sanity Check — {phase.name}
        </h3>
      </div>

      {/* Summary */}
      <div className="rounded-sm bg-secondary p-base text-xs">
        <p className="text-normal">
          <span className="text-success font-medium">{doneTasks.length}</span>{' '}
          completed
          {failedTasks.length > 0 && (
            <>
              {', '}
              <span className="text-error font-medium">
                {failedTasks.length}
              </span>{' '}
              failed
            </>
          )}
        </p>
      </div>

      {/* Diffs per workspace */}
      <div className="flex flex-col gap-half">
        <span className="text-xs text-normal font-medium">Changes</span>
        {doneTasks.map(
          (task) =>
            task.workspaceId && (
              <div key={task.id} className="border rounded-sm p-half">
                <DiffSummary workspaceId={task.workspaceId} />
              </div>
            )
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-half">
        <button
          onClick={onApprove}
          className={cn(
            'flex items-center gap-half px-base py-half text-sm font-medium rounded-sm',
            'bg-success/20 text-success hover:bg-success/30'
          )}
        >
          <Check size={14} weight="bold" />
          Approve & Continue
        </button>
        <button
          onClick={onAbort}
          className="flex items-center gap-half px-base py-half text-sm text-low hover:text-error rounded-sm"
        >
          <X size={14} />
          Abort
        </button>
      </div>
    </div>
  );
}
