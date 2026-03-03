import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Play, Stop } from '@phosphor-icons/react';
import { cn } from '@cc/lib/cn';
import {
  useWorkflowStore,
  type WorkflowPhase,
} from '@cc/stores/workflow-store';
import { useWorkflowRunner } from '@cc/hooks/use-workflow-runner';
import { useIssues } from '@cc/hooks/use-issues';
import { PhaseTimeline } from './PhaseTimeline';
import { SanityCheckPanel } from './SanityCheckPanel';

interface WorkflowDashboardProps {
  workflowId: string;
  repoId: string;
}

const taskStatusColors = {
  pending: 'bg-gray-400',
  running: 'bg-brand animate-pulse',
  done: 'bg-success',
  failed: 'bg-error',
};

export function WorkflowDashboard({
  workflowId,
  repoId,
}: WorkflowDashboardProps) {
  const [activePhaseId, setActivePhaseId] = useState<string | null>(null);

  const workflowData = useWorkflowStore((s) => s.workflows[workflowId]);

  // Get workflow from runner (which subscribes to store changes)
  const { data: issues = [] } = useIssues(workflowData?.projectId ?? '');

  const { workflow, startPhase, approvePhase, abortWorkflow } =
    useWorkflowRunner({
      workflowId,
      issues,
      repoId,
      projectId: workflowData?.projectId ?? '',
    });

  if (!workflow) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-low">
        Workflow not found
      </div>
    );
  }

  const activePhase = activePhaseId
    ? workflow.phases.find((p) => p.id === activePhaseId)
    : workflow.phases.find(
        (p) =>
          p.status === 'running' ||
          p.status === 'sanity_check' ||
          p.status === 'pending'
      );

  const nextPendingPhase = workflow.phases.find((p) => p.status === 'pending');
  const canStartNext =
    nextPendingPhase &&
    (workflow.status === 'planning' ||
      workflow.phases
        .filter((p) => p.phaseNumber < nextPendingPhase.phaseNumber)
        .every((p) => p.status === 'complete'));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-base p-base border-b bg-secondary shrink-0">
        <Link to="/workflows" className="text-low hover:text-normal">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-high truncate">
            {workflow.name}
          </h1>
          <span
            className={cn(
              'text-xs',
              workflow.status === 'complete'
                ? 'text-success'
                : workflow.status === 'aborted'
                  ? 'text-error'
                  : 'text-low'
            )}
          >
            {workflow.status}
          </span>
        </div>
        {workflow.status === 'running' && (
          <button
            onClick={() => void abortWorkflow()}
            className="flex items-center gap-half px-base py-half text-xs rounded-sm border text-low hover:text-error"
          >
            <Stop size={12} weight="fill" />
            Abort
          </button>
        )}
        {canStartNext && (
          <button
            onClick={() => void startPhase(nextPendingPhase.phaseNumber)}
            className={cn(
              'flex items-center gap-half px-base py-half text-xs rounded-sm',
              'bg-brand text-on-brand hover:bg-brand-hover'
            )}
          >
            <Play size={12} weight="fill" />
            Start {nextPendingPhase.name}
          </button>
        )}
      </div>

      {/* Phase timeline */}
      <div className="px-base py-half border-b shrink-0">
        <PhaseTimeline
          phases={workflow.phases}
          activePhaseId={activePhase?.id}
          onPhaseClick={setActivePhaseId}
        />
      </div>

      {/* Phase detail */}
      <div className="flex-1 overflow-y-auto">
        {activePhase ? (
          <PhaseDetail
            phase={activePhase}
            onApprove={() => {
              approvePhase(activePhase.id);
              // Auto-advance to next pending phase
              const next = workflow.phases.find(
                (p) => p.phaseNumber === activePhase.phaseNumber + 1
              );
              if (next) setActivePhaseId(next.id);
            }}
            onAbort={() => void abortWorkflow()}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-low">
            Select a phase
          </div>
        )}
      </div>
    </div>
  );
}

function PhaseDetail({
  phase,
  onApprove,
  onAbort,
}: {
  phase: WorkflowPhase;
  onApprove: () => void;
  onAbort: () => void;
}) {
  if (phase.status === 'sanity_check') {
    return (
      <SanityCheckPanel phase={phase} onApprove={onApprove} onAbort={onAbort} />
    );
  }

  return (
    <div className="p-base flex flex-col gap-half">
      <span className="text-xs text-normal font-medium">{phase.name}</span>
      {phase.tasks.map((task) => (
        <div
          key={task.id}
          className="flex items-center gap-half p-half border rounded-sm"
        >
          <div
            className={cn(
              'h-2 w-2 rounded-full shrink-0',
              taskStatusColors[task.status]
            )}
          />
          <span className="text-xs text-high flex-1">
            {task.issueId.startsWith('placeholder')
              ? `Task ${task.issueId.split('-')[1]}`
              : task.issueId.slice(0, 8)}
          </span>
          <span className="text-xs text-low capitalize">{task.status}</span>
          {task.workspaceId && (
            <Link
              to="/workspaces/$workspaceId"
              params={{ workspaceId: task.workspaceId }}
              className="text-xs text-brand hover:text-brand-hover"
            >
              view
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
