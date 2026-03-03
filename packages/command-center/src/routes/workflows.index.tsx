import { createFileRoute } from '@tanstack/react-router';
import { WorkflowListPage } from '@cc/components/WorkflowListPage';

export const Route = createFileRoute('/workflows/')({
  component: WorkflowListPage,
});
