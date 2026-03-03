import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { XIcon, TrashIcon, PlusIcon } from '@phosphor-icons/react';
import type { BrainstormPlan, BrainstormPlanItem } from 'shared/types';
import { useBrainstormStore } from '../model/stores/useBrainstormStore';
import { BrainstormPushDialog } from './BrainstormPushDialog';
import { cn } from '@/shared/lib/utils';

interface BrainstormPlanReviewProps {
  sessionId: string;
  renderExtraActions?: (plan: BrainstormPlan) => React.ReactNode;
}

const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

function priorityColor(priority: string | null): string {
  switch (priority) {
    case 'urgent':
      return 'bg-red-500/20 text-red-400';
    case 'high':
      return 'bg-orange-500/20 text-orange-400';
    case 'medium':
      return 'bg-yellow-500/20 text-yellow-400';
    case 'low':
      return 'bg-blue-500/20 text-blue-400';
    default:
      return 'bg-secondary text-low';
  }
}

export function BrainstormPlanReview({
  sessionId,
  renderExtraActions,
}: BrainstormPlanReviewProps) {
  const navigate = useNavigate();
  const isPlanReviewOpen = useBrainstormStore((s) => s.isPlanReviewOpen);
  const extractedPlan = useBrainstormStore((s) => s.extractedPlan);
  const setIsPlanReviewOpen = useBrainstormStore((s) => s.setIsPlanReviewOpen);
  const setExtractedPlan = useBrainstormStore((s) => s.setExtractedPlan);

  const [editedPlan, setEditedPlan] = useState<BrainstormPlan | null>(null);
  const [isPushDialogOpen, setIsPushDialogOpen] = useState(false);

  const plan = editedPlan ?? extractedPlan;

  // Sync editedPlan when extractedPlan changes
  useEffect(() => {
    if (extractedPlan) {
      setEditedPlan({ ...extractedPlan });
    }
  }, [extractedPlan]);

  const updateItem = useCallback(
    (index: number, updates: Partial<BrainstormPlanItem>) => {
      if (!plan) return;
      const items = [...plan.items];
      items[index] = { ...items[index], ...updates };
      setEditedPlan({ ...plan, items });
    },
    [plan]
  );

  const removeItem = useCallback(
    (index: number) => {
      if (!plan) return;
      const items = plan.items.filter((_, i) => i !== index);
      setEditedPlan({ ...plan, items });
    },
    [plan]
  );

  const addItem = useCallback(() => {
    if (!plan) return;
    const newItem: BrainstormPlanItem = {
      title: '',
      description: '',
      priority: 'medium',
      estimated_effort: null,
      dependencies: [],
      tags: [],
    };
    setEditedPlan({ ...plan, items: [...plan.items, newItem] });
  }, [plan]);

  const handleClose = useCallback(
    (projectId?: string) => {
      setIsPlanReviewOpen(false);
      setEditedPlan(null);
      setExtractedPlan(null);
      if (projectId) {
        navigate({ to: '/projects/$projectId', params: { projectId } });
      }
    },
    [setIsPlanReviewOpen, setExtractedPlan, navigate]
  );

  if (!isPlanReviewOpen || !plan) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => handleClose()}
      />

      {/* Slide-over panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-primary border-l border-border z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-high">Review Plan</h2>
          <button
            onClick={() => handleClose()}
            className="p-1 rounded hover:bg-secondary text-low hover:text-high cursor-pointer"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Plan metadata */}
        <div className="px-4 py-3 border-b border-border space-y-2 shrink-0">
          <input
            type="text"
            value={plan.project_name}
            onChange={(e) =>
              setEditedPlan({ ...plan, project_name: e.target.value })
            }
            className="w-full px-2 py-1.5 text-sm font-medium rounded border border-border bg-secondary text-high focus:outline-none focus:ring-1 focus:ring-brand"
            placeholder="Project name"
          />
          <textarea
            value={plan.project_description}
            onChange={(e) =>
              setEditedPlan({
                ...plan,
                project_description: e.target.value,
              })
            }
            rows={2}
            className="w-full px-2 py-1.5 text-sm rounded border border-border bg-secondary text-high resize-none focus:outline-none focus:ring-1 focus:ring-brand"
            placeholder="Project description"
          />
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {plan.items.map((item, index) => (
            <div
              key={index}
              className="rounded-lg border border-border bg-secondary p-3 space-y-2"
            >
              <div className="flex items-start gap-2">
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => updateItem(index, { title: e.target.value })}
                  className="flex-1 px-2 py-1 text-sm font-medium rounded bg-primary border border-border text-high focus:outline-none focus:ring-1 focus:ring-brand"
                  placeholder="Task title"
                />
                <button
                  onClick={() => removeItem(index)}
                  className="p-1 rounded hover:bg-primary text-low hover:text-red-400 cursor-pointer shrink-0"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
              <textarea
                value={item.description}
                onChange={(e) =>
                  updateItem(index, { description: e.target.value })
                }
                rows={2}
                className="w-full px-2 py-1 text-xs rounded bg-primary border border-border text-normal resize-none focus:outline-none focus:ring-1 focus:ring-brand"
                placeholder="Description"
              />
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p}
                      onClick={() => updateItem(index, { priority: p })}
                      className={cn(
                        'px-2 py-0.5 text-xs rounded capitalize cursor-pointer',
                        item.priority === p
                          ? priorityColor(p)
                          : 'bg-primary text-low hover:text-normal'
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                {item.estimated_effort && (
                  <span className="text-xs text-low ml-auto">
                    {item.estimated_effort}
                  </span>
                )}
              </div>
            </div>
          ))}

          <button
            onClick={addItem}
            className="flex items-center gap-1 w-full px-3 py-2 rounded-lg border border-dashed border-border text-sm text-low hover:text-normal hover:border-brand/50 transition-colors cursor-pointer"
          >
            <PlusIcon className="h-4 w-4" />
            Add task
          </button>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border flex items-center justify-between shrink-0">
          <span className="text-xs text-low">
            {plan.items.length} task{plan.items.length !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => handleClose()}
              className="px-3 py-1.5 text-sm rounded border border-border text-normal hover:text-high hover:bg-secondary cursor-pointer"
            >
              Cancel
            </button>
            {renderExtraActions?.(plan)}
            <button
              onClick={() => setIsPushDialogOpen(true)}
              disabled={plan.items.length === 0}
              className="px-3 py-1.5 text-sm rounded bg-brand text-on-brand hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              Push to Board
            </button>
          </div>
        </div>
      </div>

      {isPushDialogOpen && editedPlan && (
        <BrainstormPushDialog
          sessionId={sessionId}
          plan={editedPlan}
          onClose={() => setIsPushDialogOpen(false)}
          onSuccess={handleClose}
        />
      )}
    </>
  );
}
