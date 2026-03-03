import { createRootRoute, Outlet } from '@tanstack/react-router';
import { AppLayout } from '@cc/components/AppLayout';

export const Route = createRootRoute({
  component: () => (
    <AppLayout>
      <Outlet />
    </AppLayout>
  ),
});
