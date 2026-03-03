import { createFileRoute } from '@tanstack/react-router';
import { MultiAgentDashboard } from '@cc/components/MultiAgentDashboard';

interface MultiSearch {
  ids?: string;
}

export const Route = createFileRoute('/multi')({
  validateSearch: (search: Record<string, unknown>): MultiSearch => ({
    ids: typeof search.ids === 'string' ? search.ids : undefined,
  }),
  component: MultiAgentPage,
});

function MultiAgentPage() {
  const { ids } = Route.useSearch();
  const workspaceIds = ids ? ids.split(',').filter(Boolean) : [];

  return <MultiAgentDashboard workspaceIds={workspaceIds} />;
}
