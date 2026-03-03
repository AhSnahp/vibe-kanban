import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface WorkflowTask {
  id: string;
  issueId: string;
  workspaceId: string | null;
  status: 'pending' | 'running' | 'done' | 'failed';
}

export interface WorkflowPhase {
  id: string;
  phaseNumber: number;
  name: string;
  status: 'pending' | 'running' | 'sanity_check' | 'approved' | 'complete';
  tasks: WorkflowTask[];
  sanityCheckSessionId: string | null;
}

export type WorkflowStatus =
  | 'planning'
  | 'running'
  | 'paused'
  | 'complete'
  | 'aborted';

export interface Workflow {
  id: string;
  projectId: string;
  brainstormSessionId: string;
  name: string;
  status: WorkflowStatus;
  phases: WorkflowPhase[];
  createdAt: string;
}

interface WorkflowStoreState {
  workflows: Record<string, Workflow>;
}

interface WorkflowStoreActions {
  createWorkflow: (workflow: Workflow) => void;
  updateWorkflow: (
    workflowId: string,
    patch: Partial<Pick<Workflow, 'name' | 'status'>>
  ) => void;
  startPhase: (workflowId: string, phaseNumber: number) => void;
  completeTask: (
    workflowId: string,
    phaseId: string,
    taskId: string,
    workspaceId: string
  ) => void;
  failTask: (workflowId: string, phaseId: string, taskId: string) => void;
  setTaskRunning: (
    workflowId: string,
    phaseId: string,
    taskId: string,
    workspaceId: string
  ) => void;
  startSanityCheck: (
    workflowId: string,
    phaseId: string,
    sessionId: string
  ) => void;
  approvePhase: (workflowId: string, phaseId: string) => void;
  abortWorkflow: (workflowId: string) => void;
  removeWorkflow: (workflowId: string) => void;
}

function updatePhase(
  workflow: Workflow,
  phaseId: string,
  updater: (phase: WorkflowPhase) => WorkflowPhase
): Workflow {
  return {
    ...workflow,
    phases: workflow.phases.map((p) => (p.id === phaseId ? updater(p) : p)),
  };
}

function updateTask(
  phase: WorkflowPhase,
  taskId: string,
  updater: (task: WorkflowTask) => WorkflowTask
): WorkflowPhase {
  return {
    ...phase,
    tasks: phase.tasks.map((t) => (t.id === taskId ? updater(t) : t)),
  };
}

export const useWorkflowStore = create<
  WorkflowStoreState & WorkflowStoreActions
>()(
  persist(
    (set) => ({
      workflows: {},

      createWorkflow: (workflow) =>
        set((s) => ({
          workflows: { ...s.workflows, [workflow.id]: workflow },
        })),

      updateWorkflow: (workflowId, patch) =>
        set((s) => {
          const wf = s.workflows[workflowId];
          if (!wf) return s;
          return {
            workflows: { ...s.workflows, [workflowId]: { ...wf, ...patch } },
          };
        }),

      startPhase: (workflowId, phaseNumber) =>
        set((s) => {
          const wf = s.workflows[workflowId];
          if (!wf) return s;
          const updated = {
            ...wf,
            status: 'running' as const,
            phases: wf.phases.map((p) =>
              p.phaseNumber === phaseNumber
                ? { ...p, status: 'running' as const }
                : p
            ),
          };
          return { workflows: { ...s.workflows, [workflowId]: updated } };
        }),

      setTaskRunning: (workflowId, phaseId, taskId, workspaceId) =>
        set((s) => {
          const wf = s.workflows[workflowId];
          if (!wf) return s;
          const updated = updatePhase(wf, phaseId, (phase) =>
            updateTask(phase, taskId, (t) => ({
              ...t,
              status: 'running',
              workspaceId,
            }))
          );
          return { workflows: { ...s.workflows, [workflowId]: updated } };
        }),

      completeTask: (workflowId, phaseId, taskId, workspaceId) =>
        set((s) => {
          const wf = s.workflows[workflowId];
          if (!wf) return s;
          const updated = updatePhase(wf, phaseId, (phase) =>
            updateTask(phase, taskId, (t) => ({
              ...t,
              status: 'done',
              workspaceId,
            }))
          );
          return { workflows: { ...s.workflows, [workflowId]: updated } };
        }),

      failTask: (workflowId, phaseId, taskId) =>
        set((s) => {
          const wf = s.workflows[workflowId];
          if (!wf) return s;
          const updated = updatePhase(wf, phaseId, (phase) =>
            updateTask(phase, taskId, (t) => ({ ...t, status: 'failed' }))
          );
          return { workflows: { ...s.workflows, [workflowId]: updated } };
        }),

      startSanityCheck: (workflowId, phaseId, sessionId) =>
        set((s) => {
          const wf = s.workflows[workflowId];
          if (!wf) return s;
          const updated = updatePhase(wf, phaseId, (phase) => ({
            ...phase,
            status: 'sanity_check',
            sanityCheckSessionId: sessionId,
          }));
          return { workflows: { ...s.workflows, [workflowId]: updated } };
        }),

      approvePhase: (workflowId, phaseId) =>
        set((s) => {
          const wf = s.workflows[workflowId];
          if (!wf) return s;
          const updated = updatePhase(wf, phaseId, (phase) => ({
            ...phase,
            status: 'complete',
          }));
          // Check if all phases are complete
          const allComplete = updated.phases.every(
            (p) => p.status === 'complete'
          );
          if (allComplete) {
            updated.status = 'complete';
          }
          return { workflows: { ...s.workflows, [workflowId]: updated } };
        }),

      abortWorkflow: (workflowId) =>
        set((s) => {
          const wf = s.workflows[workflowId];
          if (!wf) return s;
          return {
            workflows: {
              ...s.workflows,
              [workflowId]: { ...wf, status: 'aborted' },
            },
          };
        }),

      removeWorkflow: (workflowId) =>
        set((s) => {
          const { [workflowId]: _, ...rest } = s.workflows;
          return { workflows: rest };
        }),
    }),
    {
      name: 'cc-workflow-store',
    }
  )
);
