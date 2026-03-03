import { createFileRoute } from '@tanstack/react-router';
import { WorkflowDashboard } from '@cc/components/WorkflowDashboard';
import { useWorkspaceStore } from '@cc/stores/workspace-store';

export const Route = createFileRoute('/workflows/$workflowId')({
  component: WorkflowDetailPage,
});

function WorkflowDetailPage() {
  const { workflowId } = Route.useParams();
  const repoId = useWorkspaceStore((s) => s.defaultRepoId) ?? '';

  return <WorkflowDashboard workflowId={workflowId} repoId={repoId} />;
}
