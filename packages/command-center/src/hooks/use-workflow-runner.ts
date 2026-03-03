import { useCallback, useEffect, useRef } from 'react';
import { useWorkflowStore } from '@cc/stores/workflow-store';
import { useWorkspaceStore } from '@cc/stores/workspace-store';
import { useBulkLaunch } from './use-bulk-launch';
import type { Issue } from '@cc/lib/api';
import { BaseCodingAgent } from 'shared/types';

interface UseWorkflowRunnerOptions {
  workflowId: string;
  issues: Issue[];
  repoId: string;
  projectId: string;
}

/**
 * Orchestrates a workflow: launch phase tasks, monitor completion, advance phases.
 *
 * - startPhase(n): launches workspaces for all tasks in phase n
 * - Monitors workspace runtimes; when all tasks in a phase are done/failed → sanity_check
 * - approvePhase(n): marks phase as complete, can start next phase
 * - abortWorkflow(): stops all running agents
 */
export function useWorkflowRunner({
  workflowId,
  issues,
  repoId,
  projectId,
}: UseWorkflowRunnerOptions) {
  const { launch } = useBulkLaunch();
  const monitorRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const workflow = useWorkflowStore((s) => s.workflows[workflowId]);
  const wfStore = useWorkflowStore;
  const wsStore = useWorkspaceStore;

  // Monitor running phases for completion
  useEffect(() => {
    if (!workflow) return;

    const runningPhase = workflow.phases.find((p) => p.status === 'running');
    if (!runningPhase) {
      if (monitorRef.current) {
        clearInterval(monitorRef.current);
        monitorRef.current = null;
      }
      return;
    }

    // Poll runtimes for task completion
    monitorRef.current = setInterval(() => {
      const runtimes = wsStore.getState().runtimes;
      const wf = wfStore.getState().workflows[workflowId];
      if (!wf) return;

      const phase = wf.phases.find((p) => p.id === runningPhase.id);
      if (!phase || phase.status !== 'running') return;

      for (const task of phase.tasks) {
        if (!task.workspaceId) continue;
        const rt = runtimes[task.workspaceId];
        if (!rt) continue;

        if (rt.loopState === 'done' && task.status !== 'done') {
          wfStore
            .getState()
            .completeTask(workflowId, phase.id, task.id, task.workspaceId);
        } else if (rt.loopState === 'failed' && task.status !== 'failed') {
          wfStore.getState().failTask(workflowId, phase.id, task.id);
        }
      }

      // Re-read after updates
      const freshWf = wfStore.getState().workflows[workflowId];
      const freshPhase = freshWf?.phases.find((p) => p.id === runningPhase.id);
      if (!freshPhase) return;

      const freshAllTerminal = freshPhase.tasks.every(
        (t) => t.status === 'done' || t.status === 'failed'
      );
      if (freshAllTerminal && freshPhase.status === 'running') {
        // Auto-transition to sanity check
        wfStore.getState().startSanityCheck(workflowId, freshPhase.id, '');
      }
    }, 2000);

    return () => {
      if (monitorRef.current) {
        clearInterval(monitorRef.current);
        monitorRef.current = null;
      }
    };
  }, [workflow?.phases, workflowId, wfStore, wsStore]);

  const startPhase = useCallback(
    async (phaseNumber: number) => {
      if (!workflow) return;

      const phase = workflow.phases.find((p) => p.phaseNumber === phaseNumber);
      if (!phase) return;

      wfStore.getState().startPhase(workflowId, phaseNumber);

      const executor = wsStore.getState().defaultExecutor;
      const issueMap = new Map(issues.map((i) => [i.id, i]));

      const items = phase.tasks
        .map((task) => {
          const issue = issueMap.get(task.issueId);
          if (!issue) return null;
          return {
            issueId: issue.id,
            data: {
              name: issue.title,
              repos: [{ repo_id: repoId, target_branch: 'main' }],
              linked_issue: {
                issue_id: issue.id,
                remote_project_id: projectId,
              },
              executor_config: { executor: executor as BaseCodingAgent },
              prompt:
                issue.title +
                (issue.description ? `\n\n${issue.description}` : ''),
              image_ids: null,
            },
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      const wsIds = await launch(items);

      // Link workspace IDs back to tasks
      const store = wfStore.getState();
      for (let i = 0; i < phase.tasks.length && i < wsIds.length; i++) {
        store.setTaskRunning(workflowId, phase.id, phase.tasks[i].id, wsIds[i]);
      }
    },
    [workflow, workflowId, issues, repoId, projectId, launch, wfStore, wsStore]
  );

  const approvePhase = useCallback(
    (phaseId: string) => {
      wfStore.getState().approvePhase(workflowId, phaseId);
    },
    [workflowId, wfStore]
  );

  const abortWorkflow = useCallback(async () => {
    if (!workflow) return;
    // Stop all running workspace agents
    const runtimes = wsStore.getState().runtimes;
    for (const phase of workflow.phases) {
      for (const task of phase.tasks) {
        if (task.workspaceId) {
          const rt = runtimes[task.workspaceId];
          if (
            rt &&
            ['running', 'evaluating', 'following_up'].includes(rt.loopState)
          ) {
            wsStore
              .getState()
              .updateRuntime(task.workspaceId, { loopState: 'done' });
          }
        }
      }
    }
    wfStore.getState().abortWorkflow(workflowId);
  }, [workflow, workflowId, wfStore, wsStore]);

  return {
    workflow,
    startPhase,
    approvePhase,
    abortWorkflow,
  };
}
