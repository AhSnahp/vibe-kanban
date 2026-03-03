import { useState, useMemo } from 'react';
import { X, GitBranch } from '@phosphor-icons/react';
import { cn } from '@cc/lib/cn';
import type { BrainstormPlan } from 'shared/types';
import { planToPhases, type PhaseDefinition } from '@cc/lib/plan-to-workflow';
import { usePushPlan } from '@/features/brainstorm/model/hooks/useBrainstormPlan';
import {
  useWorkflowStore,
  type WorkflowPhase,
} from '@cc/stores/workflow-store';

interface CreateWorkflowDialogProps {
  plan: BrainstormPlan;
  sessionId: string;
  onClose: () => void;
  onCreated: (workflowId: string, projectId: string) => void;
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Shows tasks auto-grouped into phases based on dependency analysis.
 * User can review phase groupings before creating the workflow.
 */
export function CreateWorkflowDialog({
  plan,
  sessionId,
  onClose,
  onCreated,
}: CreateWorkflowDialogProps) {
  const pushPlan = usePushPlan();
  const createWorkflow = useWorkflowStore((s) => s.createWorkflow);

  const phases = useMemo(() => planToPhases(plan.items), [plan.items]);
  const [workflowName, setWorkflowName] = useState(plan.project_name);
  const [error, setError] = useState<string | null>(null);
  const [isPushing, setIsPushing] = useState(false);

  const handleCreate = async () => {
    setError(null);
    setIsPushing(true);

    try {
      // Push plan to board first to create project + issues
      const result = await pushPlan.mutateAsync({
        sessionId,
        project_id: null,
        new_project_name: workflowName,
        create_repo: false,
        repo_path: null,
        items: plan.items,
        auto_create_workspaces: false,
        repo_ids: [],
      });

      // Create workflow in store linked to the new project
      const workflowId = generateId();
      const workflowPhases: WorkflowPhase[] = phases.map((phase, i) => ({
        id: generateId(),
        phaseNumber: i + 1,
        name: phase.name,
        status: 'pending',
        tasks: phase.taskIndices.map((idx) => ({
          id: generateId(),
          // We don't have issue IDs yet since they were just created.
          // The workflow dashboard will need to match by title.
          issueId: result.issue_ids[idx] ?? `placeholder-${idx}`,
          workspaceId: null,
          status: 'pending',
        })),
        sanityCheckSessionId: null,
      }));

      createWorkflow({
        id: workflowId,
        projectId: result.project_id,
        brainstormSessionId: sessionId,
        name: workflowName,
        status: 'planning',
        phases: workflowPhases,
        createdAt: new Date().toISOString(),
      });

      onCreated(workflowId, result.project_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create workflow');
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-primary border border-border rounded-sm w-full max-w-md shadow-xl max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-base py-base border-b shrink-0">
            <div className="flex items-center gap-half">
              <GitBranch size={16} className="text-brand" />
              <h3 className="text-sm font-semibold text-high">
                Create Workflow
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-half rounded hover:bg-secondary text-low hover:text-high"
            >
              <X size={14} />
            </button>
          </div>

          {/* Body */}
          <div className="px-base py-base flex flex-col gap-base overflow-y-auto">
            <label className="flex flex-col gap-half">
              <span className="text-xs text-normal font-medium">
                Workflow name
              </span>
              <input
                type="text"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                className="px-base py-half text-sm border rounded-sm bg-secondary text-high outline-none focus:ring-1 ring-brand"
              />
            </label>

            <div className="flex flex-col gap-half">
              <span className="text-xs text-normal font-medium">
                Execution phases
              </span>
              {phases.map((phase, i) => (
                <PhasePreview key={i} phase={phase} />
              ))}
            </div>

            {error && (
              <div className="rounded-sm bg-red-500/10 border border-red-500/20 p-base text-xs text-red-400">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-half px-base py-base border-t shrink-0">
            <button
              onClick={onClose}
              className="px-base py-half text-sm text-normal hover:text-high rounded-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!workflowName.trim() || isPushing}
              className={cn(
                'px-base py-half text-sm font-medium rounded-sm',
                'bg-brand text-on-brand hover:bg-brand-hover',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isPushing ? 'Creating...' : 'Create Workflow'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function PhasePreview({ phase }: { phase: PhaseDefinition }) {
  return (
    <div className="border rounded-sm bg-secondary p-base">
      <span className="text-xs font-medium text-high">{phase.name}</span>
      <div className="mt-half flex flex-col gap-px">
        {phase.taskTitles.map((title, i) => (
          <span key={i} className="text-xs text-normal pl-base">
            • {title}
          </span>
        ))}
      </div>
    </div>
  );
}
