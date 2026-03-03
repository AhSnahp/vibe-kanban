import { createFileRoute } from '@tanstack/react-router';
import { Dashboard } from '@cc/components/Dashboard';

export const Route = createFileRoute('/')({
  component: Dashboard,
});
