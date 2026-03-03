import { useQuery } from '@tanstack/react-query';
import { fetchTags, fetchIssueTags } from '@cc/lib/api';
import { kanbanKeys } from '@cc/lib/query-keys';

export function useTags(projectId: string) {
  return useQuery({
    queryKey: kanbanKeys.tags(projectId),
    queryFn: () => fetchTags(projectId),
    enabled: !!projectId,
  });
}

export function useIssueTags(projectId: string) {
  return useQuery({
    queryKey: kanbanKeys.issueTags(projectId),
    queryFn: () => fetchIssueTags(projectId),
    enabled: !!projectId,
  });
}
