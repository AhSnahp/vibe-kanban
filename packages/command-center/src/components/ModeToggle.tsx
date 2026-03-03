import { cn } from '@cc/lib/cn';
import { useWorkspaceStore, type LoopMode } from '@cc/stores/workspace-store';

const modes: { value: LoopMode; label: string }[] = [
  { value: 'send-it', label: 'Send It' },
  { value: 'review', label: 'Review' },
];

export function ModeToggle({ className }: { className?: string }) {
  const mode = useWorkspaceStore((s) => s.mode);
  const setMode = useWorkspaceStore((s) => s.setMode);

  return (
    <div
      className={cn(
        'inline-flex rounded-sm border bg-secondary p-px',
        className
      )}
    >
      {modes.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => setMode(value)}
          className={cn(
            'px-base py-half text-xs font-medium rounded-sm transition-colors',
            mode === value
              ? 'bg-brand text-on-brand'
              : 'text-normal hover:text-high'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
