import { useQuery } from '@tanstack/react-query';
import { configApi } from '@cc/lib/workspace-api';
import { configKeys } from '@cc/lib/query-keys';

export function useAppInfo() {
  return useQuery({
    queryKey: configKeys.info,
    queryFn: () => configApi.getConfig(),
    staleTime: 5 * 60 * 1000, // executors don't change often
  });
}
