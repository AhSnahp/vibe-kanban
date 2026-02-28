import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { brainstormApi } from '@/shared/lib/api';

export const brainstormKeys = {
  all: ['brainstorm'] as const,
  sessions: () => [...brainstormKeys.all, 'sessions'] as const,
  session: (id: string) => [...brainstormKeys.all, 'session', id] as const,
  status: () => [...brainstormKeys.all, 'status'] as const,
};

export function useBrainstormStatus() {
  return useQuery({
    queryKey: brainstormKeys.status(),
    queryFn: () => brainstormApi.getStatus(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBrainstormSessions() {
  return useQuery({
    queryKey: brainstormKeys.sessions(),
    queryFn: () => brainstormApi.listSessions(),
    staleTime: 30 * 1000,
  });
}

export function useBrainstormSession(id: string | null) {
  return useQuery({
    queryKey: brainstormKeys.session(id ?? ''),
    queryFn: () => brainstormApi.getSession(id!),
    enabled: !!id,
    staleTime: 10 * 1000,
  });
}

export function useCreateBrainstormSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: brainstormApi.createSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brainstormKeys.sessions() });
    },
  });
}

export function useUpdateBrainstormSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: { id: string } & Parameters<typeof brainstormApi.updateSession>[1]) =>
      brainstormApi.updateSession(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: brainstormKeys.sessions() });
      queryClient.invalidateQueries({
        queryKey: brainstormKeys.session(variables.id),
      });
    },
  });
}

export function useDeleteBrainstormSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => brainstormApi.deleteSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brainstormKeys.sessions() });
    },
  });
}
