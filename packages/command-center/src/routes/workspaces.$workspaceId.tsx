import { createFileRoute } from '@tanstack/react-router';
import { WorkspaceDetailPage } from '@cc/components/WorkspaceDetailPage';

export const Route = createFileRoute('/workspaces/$workspaceId')({
  component: WorkspaceDetailPage,
});
