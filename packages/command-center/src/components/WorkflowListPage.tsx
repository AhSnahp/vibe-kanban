import { Link } from '@tanstack/react-router';
import { cn } from '@cc/lib/cn';
import {
  useWorkflowStore,
  type Workflow,
  type WorkflowStatus,
} from '@cc/stores/workflow-store';

const statusBadge: Record<
  WorkflowStatus,
  { label: string; className: string }
> = {
  planning: {
    label: 'Planning',
    className: 'bg-gray-400/20 text-gray-400',
  },
  running: {
    label: 'Running',
    className: 'bg-brand/20 text-brand',
  },
  paused: {
    label: 'Paused',
    className: 'bg-blue-400/20 text-blue-400',
  },
  complete: {
    label: 'Complete',
    className: 'bg-success/20 text-success',
  },
  aborted: {
    label: 'Aborted',
    className: 'bg-error/20 text-error',
  },
};

export function WorkflowListPage() {
  const workflows = useWorkflowStore((s) => s.workflows);
  const workflowList = Object.values(workflows).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-base p-base border-b bg-secondary">
        <h1 className="text-lg font-semibold text-high">Workflows</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-base">
        {workflowList.length === 0 ? (
          <p className="text-sm text-low">
            No workflows yet. Create one from the Brainstorm plan review.
          </p>
        ) : (
          <div className="flex flex-col gap-half">
            {workflowList.map((wf) => (
              <WorkflowItem key={wf.id} workflow={wf} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WorkflowItem({ workflow }: { workflow: Workflow }) {
  const badge = statusBadge[workflow.status];
  const phaseCount = workflow.phases.length;
  const completedPhases = workflow.phases.filter(
    (p) => p.status === 'complete'
  ).length;

  return (
    <Link
      to="/workflows/$workflowId"
      params={{ workflowId: workflow.id }}
      className={cn(
        'flex items-center gap-base p-base border rounded-sm',
        'bg-primary hover:bg-secondary transition-colors'
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-high truncate">
          {workflow.name}
        </p>
        <p className="text-xs text-low">
          {completedPhases}/{phaseCount} phases •{' '}
          {new Date(workflow.createdAt).toLocaleDateString()}
        </p>
      </div>
      <span
        className={cn(
          'text-xs px-base py-px rounded-sm font-medium shrink-0',
          badge.className
        )}
      >
        {badge.label}
      </span>
    </Link>
  );
}
