import { useCallback, useState } from 'react';
import { XIcon } from '@phosphor-icons/react';
import type { BrainstormPlan } from 'shared/types';
import { usePushPlan } from '../model/hooks/useBrainstormPlan';

interface BrainstormPushDialogProps {
  sessionId: string;
  plan: BrainstormPlan;
  onClose: () => void;
  onSuccess: (projectId: string) => void;
}

export function BrainstormPushDialog({
  sessionId,
  plan,
  onClose,
  onSuccess,
}: BrainstormPushDialogProps) {
  const pushPlan = usePushPlan();
  const [projectId, setProjectId] = useState('');
  const [newProjectName, setNewProjectName] = useState(plan.project_name);
  const [useExisting, setUseExisting] = useState(false);
  const [autoCreateWorkspaces, setAutoCreateWorkspaces] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePush = useCallback(async () => {
    setError(null);
    try {
      const result = await pushPlan.mutateAsync({
        sessionId,
        project_id: useExisting ? projectId : null,
        new_project_name: useExisting ? null : newProjectName,
        create_repo: false,
        repo_path: null,
        items: plan.items,
        auto_create_workspaces: autoCreateWorkspaces,
        repo_ids: [],
      });
      onSuccess(result.project_id);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Failed to push plan to board';
      setError(msg);
    }
  }, [
    pushPlan,
    sessionId,
    useExisting,
    projectId,
    newProjectName,
    plan.items,
    autoCreateWorkspaces,
    onSuccess,
  ]);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-primary border border-border rounded-xl w-full max-w-md shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-high">
              Push Plan to Board
            </h3>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-secondary text-low hover:text-high cursor-pointer"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-4 space-y-4">
            {/* Project selection */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-normal cursor-pointer">
                <input
                  type="radio"
                  checked={!useExisting}
                  onChange={() => setUseExisting(false)}
                  className="accent-brand"
                />
                Create new project
              </label>
              {!useExisting && (
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm rounded border border-border bg-secondary text-high focus:outline-none focus:ring-1 focus:ring-brand"
                  placeholder="Project name"
                />
              )}

              <label className="flex items-center gap-2 text-sm text-normal cursor-pointer">
                <input
                  type="radio"
                  checked={useExisting}
                  onChange={() => setUseExisting(true)}
                  className="accent-brand"
                />
                Add to existing project
              </label>
              {useExisting && (
                <input
                  type="text"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm rounded border border-border bg-secondary text-high focus:outline-none focus:ring-1 focus:ring-brand"
                  placeholder="Project ID"
                />
              )}
            </div>

            {/* Summary */}
            <div className="rounded-lg bg-secondary p-3 text-sm space-y-1">
              <p className="text-normal">
                <span className="text-high font-medium">
                  {plan.items.length}
                </span>{' '}
                task{plan.items.length !== 1 ? 's' : ''} will be created
              </p>
            </div>

            {/* Error display */}
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Options */}
            <label className="flex items-center gap-2 text-sm text-normal cursor-pointer">
              <input
                type="checkbox"
                checked={autoCreateWorkspaces}
                onChange={(e) => setAutoCreateWorkspaces(e.target.checked)}
                className="accent-brand"
              />
              Auto-start agent workspaces for each task
            </label>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded border border-border text-normal hover:text-high hover:bg-secondary cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handlePush}
              disabled={
                pushPlan.isPending ||
                (!useExisting && !newProjectName.trim()) ||
                (useExisting && !projectId.trim())
              }
              className="px-3 py-1.5 text-sm rounded bg-brand text-on-brand hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {pushPlan.isPending ? 'Pushing...' : 'Push Plan'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
