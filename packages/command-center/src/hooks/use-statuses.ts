import { useQuery } from '@tanstack/react-query';
import { fetchStatuses } from '@cc/lib/api';
import { kanbanKeys } from '@cc/lib/query-keys';

export function useStatuses(projectId: string) {
  return useQuery({
    queryKey: kanbanKeys.statuses(projectId),
    queryFn: () => fetchStatuses(projectId),
    enabled: !!projectId,
  });
}
