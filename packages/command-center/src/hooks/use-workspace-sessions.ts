import { useQuery } from '@tanstack/react-query';
import { sessionsApi } from '@cc/lib/workspace-api';
import { workspaceKeys } from '@cc/lib/query-keys';

export function useWorkspaceSessions(workspaceId: string | undefined) {
  return useQuery({
    queryKey: workspaceKeys.sessions(workspaceId ?? ''),
    queryFn: () => sessionsApi.getByWorkspace(workspaceId!),
    enabled: !!workspaceId,
  });
}
