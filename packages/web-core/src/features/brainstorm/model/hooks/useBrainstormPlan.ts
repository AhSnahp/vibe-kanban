import { useMutation } from '@tanstack/react-query';
import { brainstormApi } from '@/shared/lib/api';
import { useBrainstormStore } from '../stores/useBrainstormStore';

export function useExtractPlan() {
  const { setExtractedPlan, setIsPlanReviewOpen } = useBrainstormStore();

  return useMutation({
    mutationFn: (sessionId: string) => brainstormApi.extractPlan(sessionId),
    onSuccess: (plan) => {
      setExtractedPlan(plan);
      setIsPlanReviewOpen(true);
    },
  });
}

export function usePushPlan() {
  return useMutation({
    mutationFn: ({
      sessionId,
      ...data
    }: { sessionId: string } & Parameters<typeof brainstormApi.pushPlan>[1]) =>
      brainstormApi.pushPlan(sessionId, data),
  });
}
