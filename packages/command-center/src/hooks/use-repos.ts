import { useQuery } from '@tanstack/react-query';
import { repoApi } from '@cc/lib/workspace-api';
import { repoKeys } from '@cc/lib/query-keys';

export function useRepos() {
  return useQuery({
    queryKey: repoKeys.all,
    queryFn: () => repoApi.list(),
  });
}
