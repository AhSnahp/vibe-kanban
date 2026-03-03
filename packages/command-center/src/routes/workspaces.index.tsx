import { createFileRoute } from '@tanstack/react-router';
import { WorkspaceListPage } from '@cc/components/WorkspaceListPage';

export const Route = createFileRoute('/workspaces/')({
  component: WorkspaceListPage,
});
