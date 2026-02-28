import { create } from 'zustand';
import type { BrainstormPlan } from 'shared/types';

interface BrainstormState {
  activeSessionId: string | null;
  isStreaming: boolean;
  streamingText: string;
  streamingThinking: string;
  isPlanReviewOpen: boolean;
  extractedPlan: BrainstormPlan | null;
  isContextPanelOpen: boolean;
  thinkingBudget: number;

  setActiveSessionId: (id: string | null) => void;
  setIsStreaming: (streaming: boolean) => void;
  appendStreamingText: (text: string) => void;
  appendStreamingThinking: (thinking: string) => void;
  resetStreaming: () => void;
  setIsPlanReviewOpen: (open: boolean) => void;
  setExtractedPlan: (plan: BrainstormPlan | null) => void;
  setIsContextPanelOpen: (open: boolean) => void;
  setThinkingBudget: (budget: number) => void;
}

export const useBrainstormStore = create<BrainstormState>((set) => ({
  activeSessionId: null,
  isStreaming: false,
  streamingText: '',
  streamingThinking: '',
  isPlanReviewOpen: false,
  extractedPlan: null,
  isContextPanelOpen: false,
  thinkingBudget: 10000,

  setActiveSessionId: (id) => set({ activeSessionId: id }),
  setIsStreaming: (streaming) => set({ isStreaming: streaming }),
  appendStreamingText: (text) =>
    set((state) => ({ streamingText: state.streamingText + text })),
  appendStreamingThinking: (thinking) =>
    set((state) => ({
      streamingThinking: state.streamingThinking + thinking,
    })),
  resetStreaming: () =>
    set({ isStreaming: false, streamingText: '', streamingThinking: '' }),
  setIsPlanReviewOpen: (open) => set({ isPlanReviewOpen: open }),
  setExtractedPlan: (plan) => set({ extractedPlan: plan }),
  setIsContextPanelOpen: (open) => set({ isContextPanelOpen: open }),
  setThinkingBudget: (budget) => set({ thinkingBudget: budget }),
}));
