import { useMutation } from '@tanstack/react-query';
import { sessionsApi } from '@cc/lib/workspace-api';
import type { CreateFollowUpAttempt } from '@cc/lib/workspace-api';

export function useFollowUp() {
  return useMutation({
    mutationFn: ({
      sessionId,
      data,
    }: {
      sessionId: string;
      data: CreateFollowUpAttempt;
    }) => sessionsApi.followUp(sessionId, data),
  });
}
