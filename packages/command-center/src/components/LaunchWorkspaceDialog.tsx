import { useState, useMemo } from 'react';
import { X, Rocket } from '@phosphor-icons/react';
import { cn } from '@cc/lib/cn';
import { useRepos } from '@cc/hooks/use-repos';
import { useAppInfo } from '@cc/hooks/use-app-info';
import { useLaunchWorkspace } from '@cc/hooks/use-launch';
import { useWorkspaceStore } from '@cc/stores/workspace-store';
import { ModeToggle } from './ModeToggle';
import type { Issue } from '@cc/lib/api';
import { BaseCodingAgent } from 'shared/types';

interface LaunchWorkspaceDialogProps {
  issue: Issue;
  projectId?: string;
  onClose: () => void;
  onLaunched: (workspaceId: string) => void;
}

export function LaunchWorkspaceDialog({
  issue,
  projectId,
  onClose,
  onLaunched,
}: LaunchWorkspaceDialogProps) {
  const { data: repos = [] } = useRepos();
  const { data: appInfo } = useAppInfo();
  const launch = useLaunchWorkspace();

  const defaultRepoId = useWorkspaceStore((s) => s.defaultRepoId);
  const defaultExecutor = useWorkspaceStore((s) => s.defaultExecutor);
  const maxIterations = useWorkspaceStore((s) => s.maxIterations);
  const setDefaultRepoId = useWorkspaceStore((s) => s.setDefaultRepoId);
  const setDefaultExecutor = useWorkspaceStore((s) => s.setDefaultExecutor);
  const setMaxIterations = useWorkspaceStore((s) => s.setMaxIterations);

  const [repoId, setRepoId] = useState(defaultRepoId ?? repos[0]?.id ?? '');
  const [executor, setExecutor] = useState(defaultExecutor);
  const [prompt, setPrompt] = useState(buildDefaultPrompt(issue));

  const selectedRepo = repos.find((r) => r.id === repoId);
  const executorOptions = useMemo(() => {
    if (!appInfo?.executors) return Object.values(BaseCodingAgent);
    return Object.keys(appInfo.executors) as string[];
  }, [appInfo]);

  const handleLaunch = async () => {
    if (!repoId || !prompt.trim()) return;

    // Persist selections for next time
    setDefaultRepoId(repoId);
    setDefaultExecutor(executor);

    const targetBranch = selectedRepo?.default_target_branch ?? 'main';

    const result = await launch.mutateAsync({
      data: {
        name: issue.title,
        repos: [{ repo_id: repoId, target_branch: targetBranch }],
        linked_issue: projectId
          ? {
              issue_id: issue.id,
              remote_project_id: projectId,
            }
          : null,
        executor_config: { executor: executor as BaseCodingAgent },
        prompt: prompt.trim(),
        image_ids: null,
      },
      context: { issueId: issue.id },
    });

    onLaunched(result.workspace.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-primary border rounded-sm shadow-lg w-full max-w-lg mx-base">
        {/* Header */}
        <div className="flex items-center justify-between p-base border-b">
          <div className="flex items-center gap-half">
            <Rocket size={16} className="text-brand" weight="fill" />
            <h2 className="text-base font-semibold text-high">Launch Agent</h2>
          </div>
          <button onClick={onClose} className="text-low hover:text-normal">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-base flex flex-col gap-base">
          {/* Issue context */}
          <div className="text-xs text-low">
            <span className="font-mono">{issue.simple_id}</span>
            {' — '}
            <span className="text-normal font-medium">{issue.title}</span>
          </div>

          {/* Repo */}
          <label className="flex flex-col gap-half">
            <span className="text-xs text-normal font-medium">Repository</span>
            <select
              value={repoId}
              onChange={(e) => setRepoId(e.target.value)}
              className="px-base py-half text-sm border rounded-sm bg-secondary text-high outline-none focus:ring-1 ring-brand"
            >
              <option value="">Select a repo...</option>
              {repos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.display_name || r.name}
                </option>
              ))}
            </select>
          </label>

          {/* Executor */}
          <label className="flex flex-col gap-half">
            <span className="text-xs text-normal font-medium">Agent</span>
            <select
              value={executor}
              onChange={(e) => setExecutor(e.target.value)}
              className="px-base py-half text-sm border rounded-sm bg-secondary text-high outline-none focus:ring-1 ring-brand"
            >
              {executorOptions.map((e) => (
                <option key={e} value={e}>
                  {e.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>

          {/* Mode + iterations */}
          <div className="flex items-center gap-base">
            <div className="flex flex-col gap-half">
              <span className="text-xs text-normal font-medium">Mode</span>
              <ModeToggle />
            </div>
            <label className="flex flex-col gap-half">
              <span className="text-xs text-normal font-medium">
                Max iterations
              </span>
              <input
                type="number"
                min={1}
                max={20}
                value={maxIterations}
                onChange={(e) => setMaxIterations(Number(e.target.value) || 1)}
                className="w-16 px-half py-half text-sm border rounded-sm bg-secondary text-high text-center outline-none focus:ring-1 ring-brand"
              />
            </label>
          </div>

          {/* Prompt */}
          <label className="flex flex-col gap-half">
            <span className="text-xs text-normal font-medium">Prompt</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              className="px-base py-half text-sm border rounded-sm bg-secondary text-high outline-none focus:ring-1 ring-brand resize-y font-mono"
            />
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-half p-base border-t">
          <button
            onClick={onClose}
            className="px-base py-half text-sm text-normal hover:text-high rounded-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleLaunch}
            disabled={!repoId || !prompt.trim() || launch.isPending}
            className={cn(
              'flex items-center gap-half px-base py-half text-sm font-medium rounded-sm transition-colors',
              'bg-brand text-on-brand hover:bg-brand-hover',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <Rocket size={14} weight="fill" />
            {launch.isPending ? 'Launching...' : 'Launch'}
          </button>
        </div>
      </div>
    </div>
  );
}

function buildDefaultPrompt(issue: Issue): string {
  let prompt = issue.title;
  if (issue.description) {
    prompt += `\n\n${issue.description}`;
  }
  return prompt;
}
