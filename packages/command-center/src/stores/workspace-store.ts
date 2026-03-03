import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type LoopState =
  | 'idle'
  | 'launching'
  | 'running'
  | 'evaluating'
  | 'following_up'
  | 'paused'
  | 'done'
  | 'failed';

export type LoopMode = 'send-it' | 'review';

export interface WorkspaceRuntime {
  loopState: LoopState;
  iterations: number;
  sessionId: string | null;
  latestProcessId: string | null;
  lastAssistantMessage: string | null;
  error: string | null;
  issueId: string | null;
}

interface WorkspaceStoreState {
  mode: LoopMode;
  maxIterations: number;
  defaultRepoId: string | null;
  defaultExecutor: string;
  runtimes: Record<string, WorkspaceRuntime>;
}

interface WorkspaceStoreActions {
  setMode: (mode: LoopMode) => void;
  setMaxIterations: (n: number) => void;
  setDefaultRepoId: (id: string | null) => void;
  setDefaultExecutor: (executor: string) => void;
  initRuntime: (
    workspaceId: string,
    sessionId: string,
    issueId?: string
  ) => void;
  updateRuntime: (
    workspaceId: string,
    patch: Partial<WorkspaceRuntime>
  ) => void;
  removeRuntime: (workspaceId: string) => void;
}

const emptyRuntime = (): WorkspaceRuntime => ({
  loopState: 'idle',
  iterations: 0,
  sessionId: null,
  latestProcessId: null,
  lastAssistantMessage: null,
  error: null,
  issueId: null,
});

type Store = WorkspaceStoreState & WorkspaceStoreActions;

export const useWorkspaceStore = create<Store>()(
  persist(
    (set) => ({
      // --- persisted settings ---
      mode: 'send-it' as LoopMode,
      maxIterations: 5,
      defaultRepoId: null as string | null,
      defaultExecutor: 'CLAUDE_CODE',

      // --- per-workspace state (now also persisted) ---
      runtimes: {} as Record<string, WorkspaceRuntime>,

      setMode: (mode: LoopMode) => set({ mode }),
      setMaxIterations: (n: number) => set({ maxIterations: n }),
      setDefaultRepoId: (id: string | null) => set({ defaultRepoId: id }),
      setDefaultExecutor: (executor: string) =>
        set({ defaultExecutor: executor }),

      initRuntime: (workspaceId: string, sessionId: string, issueId?: string) =>
        set((s) => ({
          runtimes: {
            ...s.runtimes,
            [workspaceId]: {
              ...emptyRuntime(),
              sessionId,
              issueId: issueId ?? null,
            },
          },
        })),

      updateRuntime: (workspaceId: string, patch: Partial<WorkspaceRuntime>) =>
        set((s) => {
          const prev = s.runtimes[workspaceId];
          if (!prev) return s;
          return {
            runtimes: { ...s.runtimes, [workspaceId]: { ...prev, ...patch } },
          };
        }),

      removeRuntime: (workspaceId: string) =>
        set((s) => {
          const { [workspaceId]: _, ...rest } = s.runtimes;
          return { runtimes: rest };
        }),
    }),
    {
      name: 'cc-workspace-store',
      partialize: (s): Partial<WorkspaceStoreState> => ({
        mode: s.mode,
        maxIterations: s.maxIterations,
        defaultRepoId: s.defaultRepoId,
        defaultExecutor: s.defaultExecutor,
        // Persist runtime essentials for page reload recovery
        runtimes: Object.fromEntries(
          Object.entries(s.runtimes).map(([id, rt]) => [
            id,
            {
              ...rt,
              lastAssistantMessage: null,
              error: null,
            },
          ])
        ),
      }),
      onRehydrateStorage: () => (state) => {
        if (!state?.runtimes) return;
        // Reset active states to 'running' so Ralph loop can re-attach
        const activeStates: LoopState[] = [
          'running',
          'evaluating',
          'following_up',
          'launching',
        ];
        for (const [id, rt] of Object.entries(state.runtimes)) {
          if (activeStates.includes(rt.loopState)) {
            state.runtimes[id] = { ...rt, loopState: 'running', error: null };
          }
        }
      },
    }
  )
);

/** Find the workspace runtime linked to a specific issue. */
export function getWorkspaceForIssue(
  issueId: string
): { workspaceId: string; runtime: WorkspaceRuntime } | null {
  const { runtimes } = useWorkspaceStore.getState();
  for (const [workspaceId, runtime] of Object.entries(runtimes)) {
    if (runtime.issueId === issueId) {
      return { workspaceId, runtime };
    }
  }
  return null;
}
