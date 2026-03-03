import { useState, useMemo } from 'react';
import { X, Rocket, CaretDown, CaretRight } from '@phosphor-icons/react';
import { cn } from '@cc/lib/cn';
import { useRepos } from '@cc/hooks/use-repos';
import { useAppInfo } from '@cc/hooks/use-app-info';
import { useWorkspaceStore } from '@cc/stores/workspace-store';
import { useBulkLaunch } from '@cc/hooks/use-bulk-launch';
import { ModeToggle } from './ModeToggle';
import type { Issue } from '@cc/lib/api';
import { BaseCodingAgent } from 'shared/types';

interface BulkLaunchDialogProps {
  issues: Issue[];
  projectId: string;
  onClose: () => void;
  onLaunched: (workspaceIds: string[]) => void;
}

function buildDefaultPrompt(issue: Issue): string {
  let prompt = issue.title;
  if (issue.description) {
    prompt += `\n\n${issue.description}`;
  }
  return prompt;
}

export function BulkLaunchDialog({
  issues,
  projectId,
  onClose,
  onLaunched,
}: BulkLaunchDialogProps) {
  const { data: repos = [] } = useRepos();
  const { data: appInfo } = useAppInfo();
  const { launch, progress, isLaunching } = useBulkLaunch();

  const defaultRepoId = useWorkspaceStore((s) => s.defaultRepoId);
  const defaultExecutor = useWorkspaceStore((s) => s.defaultExecutor);
  const maxIterations = useWorkspaceStore((s) => s.maxIterations);
  const setDefaultRepoId = useWorkspaceStore((s) => s.setDefaultRepoId);
  const setDefaultExecutor = useWorkspaceStore((s) => s.setDefaultExecutor);
  const setMaxIterations = useWorkspaceStore((s) => s.setMaxIterations);

  const [repoId, setRepoId] = useState(defaultRepoId ?? repos[0]?.id ?? '');
  const [executor, setExecutor] = useState(defaultExecutor);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);

  const selectedRepo = repos.find((r) => r.id === repoId);
  const executorOptions = useMemo(() => {
    if (!appInfo?.executors) return Object.values(BaseCodingAgent);
    return Object.keys(appInfo.executors) as string[];
  }, [appInfo]);

  const handleLaunch = async () => {
    if (!repoId) return;

    setDefaultRepoId(repoId);
    setDefaultExecutor(executor);

    const targetBranch = selectedRepo?.default_target_branch ?? 'main';

    const items = issues.map((issue) => ({
      issueId: issue.id,
      data: {
        name: issue.title,
        repos: [{ repo_id: repoId, target_branch: targetBranch }],
        linked_issue: {
          issue_id: issue.id,
          remote_project_id: projectId,
        },
        executor_config: { executor: executor as BaseCodingAgent },
        prompt: buildDefaultPrompt(issue),
        image_ids: null,
      },
    }));

    const wsIds = await launch(items);
    onLaunched(wsIds);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-primary border rounded-sm shadow-lg w-full max-w-lg mx-base max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-base border-b shrink-0">
          <div className="flex items-center gap-half">
            <Rocket size={16} className="text-brand" weight="fill" />
            <h2 className="text-base font-semibold text-high">
              Bulk Launch — {issues.length} issue
              {issues.length !== 1 ? 's' : ''}
            </h2>
          </div>
          <button onClick={onClose} className="text-low hover:text-normal">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-base flex flex-col gap-base overflow-y-auto">
          {/* Shared config */}
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

          {/* Per-issue prompts (collapsible) */}
          <div className="flex flex-col gap-half">
            <span className="text-xs text-normal font-medium">
              Issue prompts
            </span>
            {issues.map((issue) => (
              <div key={issue.id} className="border rounded-sm bg-secondary">
                <button
                  onClick={() =>
                    setExpandedIssue(
                      expandedIssue === issue.id ? null : issue.id
                    )
                  }
                  className="flex items-center gap-half w-full px-base py-half text-left"
                >
                  {expandedIssue === issue.id ? (
                    <CaretDown size={12} className="text-low shrink-0" />
                  ) : (
                    <CaretRight size={12} className="text-low shrink-0" />
                  )}
                  <span className="text-xs text-low font-mono">
                    {issue.simple_id}
                  </span>
                  <span className="text-xs text-high truncate flex-1">
                    {issue.title}
                  </span>
                </button>
                {expandedIssue === issue.id && (
                  <div className="px-base pb-half">
                    <pre className="text-xs text-normal font-mono whitespace-pre-wrap">
                      {buildDefaultPrompt(issue)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-base border-t shrink-0">
          {isLaunching ? (
            <span className="text-xs text-normal">
              Launching {progress.completed + progress.failed}/{progress.total}
              {progress.failed > 0 && (
                <span className="text-error ml-half">
                  ({progress.failed} failed)
                </span>
              )}
            </span>
          ) : (
            <span className="text-xs text-low">
              {issues.length} workspace{issues.length !== 1 ? 's' : ''} will be
              created
            </span>
          )}
          <div className="flex items-center gap-half">
            <button
              onClick={onClose}
              className="px-base py-half text-sm text-normal hover:text-high rounded-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleLaunch}
              disabled={!repoId || isLaunching}
              className={cn(
                'flex items-center gap-half px-base py-half text-sm font-medium rounded-sm transition-colors',
                'bg-brand text-on-brand hover:bg-brand-hover',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <Rocket size={14} weight="fill" />
              {isLaunching ? 'Launching...' : `Launch ${issues.length}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
