import { Rocket, X } from '@phosphor-icons/react';

interface SelectionBarProps {
  count: number;
  onLaunchAll: () => void;
  onClear: () => void;
}

/**
 * Floating bar at the bottom of the kanban board when issues are selected.
 * Ctrl+click cards to select, then "Launch All" to bulk-launch agents.
 */
export function SelectionBar({
  count,
  onLaunchAll,
  onClear,
}: SelectionBarProps) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-base px-double py-base bg-panel border rounded-sm shadow-lg">
      <span className="text-sm text-high font-medium">{count} selected</span>
      <button
        onClick={onLaunchAll}
        className="flex items-center gap-half px-base py-half text-sm font-medium rounded-sm bg-brand text-on-brand hover:bg-brand-hover transition-colors"
      >
        <Rocket size={14} weight="fill" />
        Launch All
      </button>
      <button
        onClick={onClear}
        className="p-half text-low hover:text-normal rounded-sm"
        aria-label="Clear selection"
      >
        <X size={14} />
      </button>
    </div>
  );
}
