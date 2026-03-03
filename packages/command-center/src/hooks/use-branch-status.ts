import { useQuery } from '@tanstack/react-query';
import { attemptsApi } from '@cc/lib/workspace-api';
import { workspaceKeys } from '@cc/lib/query-keys';

export function useBranchStatus(workspaceId: string | undefined) {
  return useQuery({
    queryKey: workspaceKeys.branchStatus(workspaceId ?? ''),
    queryFn: () => attemptsApi.getBranchStatus(workspaceId!),
    enabled: !!workspaceId,
    refetchInterval: 10_000,
  });
}
