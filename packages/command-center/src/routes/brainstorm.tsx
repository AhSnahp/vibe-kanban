import { useState, useCallback } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { GitBranch } from '@phosphor-icons/react';
import { BrainstormTerminal } from '@/features/brainstorm/ui/BrainstormTerminal';
import { useBrainstormStore } from '@/features/brainstorm/model/stores/useBrainstormStore';
import type { BrainstormPlan } from 'shared/types';
import { CreateWorkflowDialog } from '@cc/components/CreateWorkflowDialog';

export const Route = createFileRoute('/brainstorm')({
  component: BrainstormPage,
});

function BrainstormPage() {
  const navigate = useNavigate();
  const activeSessionId = useBrainstormStore((s) => s.activeSessionId);
  const [workflowPlan, setWorkflowPlan] = useState<BrainstormPlan | null>(null);

  const handleWorkflowCreated = useCallback(
    (workflowId: string, _projectId: string) => {
      setWorkflowPlan(null);
      useBrainstormStore.getState().setIsPlanReviewOpen(false);
      useBrainstormStore.getState().setExtractedPlan(null);
      navigate({
        to: '/workflows/$workflowId',
        params: { workflowId },
      });
    },
    [navigate]
  );

  return (
    <div className="h-full">
      <BrainstormTerminal
        renderPlanExtraActions={(plan) => (
          <button
            onClick={() => setWorkflowPlan(plan)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded border border-brand/50 text-brand hover:bg-brand/10 cursor-pointer"
          >
            <GitBranch className="h-3.5 w-3.5" />
            Create Workflow
          </button>
        )}
      />
      {workflowPlan && activeSessionId && (
        <CreateWorkflowDialog
          plan={workflowPlan}
          sessionId={activeSessionId}
          onClose={() => setWorkflowPlan(null)}
          onCreated={handleWorkflowCreated}
        />
      )}
    </div>
  );
}
