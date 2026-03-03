import { useState, type ReactNode } from 'react';
import { X, Trash } from '@phosphor-icons/react';
import type { Issue, ProjectStatus } from '@cc/lib/api';
import { useUpdateIssue, useDeleteIssue } from '@cc/hooks/use-issues';
import { cn } from '@cc/lib/cn';

const priorities = [
  { value: null, label: 'None' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
] as const;

export function IssueDetailPanel({
  issue,
  statuses,
  projectId,
  onClose,
}: {
  issue: Issue;
  statuses: ProjectStatus[];
  projectId: string;
  onClose: () => void;
}) {
  const updateIssue = useUpdateIssue(projectId);
  const deleteIssue = useDeleteIssue(projectId);
  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description ?? '');

  const save = (updates: Parameters<typeof updateIssue.mutate>[0]) => {
    updateIssue.mutate(updates);
  };

  const handleTitleBlur = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== issue.title) {
      save({ id: issue.id, title: trimmed });
    }
  };

  const handleDescriptionBlur = () => {
    const val = description.trim() || null;
    if (val !== (issue.description ?? '')) {
      save({ id: issue.id, description: val });
    }
  };

  const handleDelete = async () => {
    await deleteIssue.mutateAsync(issue.id);
    onClose();
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 max-w-full bg-primary border-l shadow-lg z-50 flex flex-col">
      <div className="flex items-center justify-between p-base border-b">
        <span className="text-xs text-low font-mono">{issue.simple_id}</span>
        <button
          onClick={onClose}
          className="text-low hover:text-normal"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-base flex flex-col gap-double">
        {/* Title */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="text-lg font-semibold text-high bg-transparent outline-none border-b border-transparent focus:border-brand pb-half w-full"
        />

        {/* Status */}
        <Field label="Status">
          <select
            value={issue.status_id}
            onChange={(e) => save({ id: issue.id, status_id: e.target.value })}
            className="w-full px-base py-half border rounded-sm bg-primary text-sm text-high outline-none focus:ring-1 ring-brand"
          >
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        {/* Priority */}
        <Field label="Priority">
          <div className="flex flex-wrap gap-half">
            {priorities.map((p) => (
              <button
                key={p.value ?? 'none'}
                onClick={() =>
                  save({
                    id: issue.id,
                    priority: p.value as Issue['priority'],
                  })
                }
                className={cn(
                  'px-base py-half text-xs rounded-sm border',
                  issue.priority === p.value
                    ? 'bg-brand text-on-brand border-brand'
                    : 'bg-primary text-normal border-border hover:bg-secondary'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </Field>

        {/* Description */}
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            rows={6}
            placeholder="Add a description..."
            className="w-full px-base py-half border rounded-sm bg-primary text-sm text-high outline-none focus:ring-1 ring-brand resize-y"
          />
        </Field>

        {/* Delete */}
        <div className="pt-double border-t">
          <button
            onClick={handleDelete}
            className="flex items-center gap-half text-sm text-error hover:underline"
          >
            <Trash size={14} />
            Delete issue
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-half">
      <label className="text-xs font-medium text-low uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}
