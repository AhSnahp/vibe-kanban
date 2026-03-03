import { createFileRoute } from '@tanstack/react-router';
import { KanbanPage } from '@cc/components/KanbanPage';

export const Route = createFileRoute('/projects/$projectId')({
  component: KanbanPage,
});
