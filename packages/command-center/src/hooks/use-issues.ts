import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchIssues,
  createIssue,
  updateIssue,
  deleteIssue,
  bulkUpdateIssues,
} from '@cc/lib/api';
import { kanbanKeys } from '@cc/lib/query-keys';

export function useIssues(projectId: string) {
  return useQuery({
    queryKey: kanbanKeys.issues(projectId),
    queryFn: () => fetchIssues(projectId),
    enabled: !!projectId,
  });
}

export function useCreateIssue(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createIssue,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: kanbanKeys.issues(projectId) });
    },
  });
}

export function useUpdateIssue(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...updates
    }: { id: string } & Parameters<typeof updateIssue>[1]) =>
      updateIssue(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: kanbanKeys.issues(projectId) });
    },
  });
}

export function useDeleteIssue(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteIssue,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: kanbanKeys.issues(projectId) });
    },
  });
}

export function useBulkUpdateIssues(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: bulkUpdateIssues,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: kanbanKeys.issues(projectId) });
    },
  });
}
