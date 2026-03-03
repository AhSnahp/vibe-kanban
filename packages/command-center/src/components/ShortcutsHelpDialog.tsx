import { X } from '@phosphor-icons/react';

interface ShortcutsHelpDialogProps {
  onClose: () => void;
}

const shortcuts = [
  { keys: 'm', description: 'Toggle mode (send-it / review)' },
  { keys: 'g b', description: 'Go to Brainstorm' },
  { keys: 'g w', description: 'Go to Workspaces' },
  { keys: 'g d', description: 'Go to Dashboard' },
  { keys: 'g f', description: 'Go to Workflows' },
  { keys: '?', description: 'Toggle this help dialog' },
];

export function ShortcutsHelpDialog({ onClose }: ShortcutsHelpDialogProps) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50">
        <div className="bg-primary border rounded-sm shadow-lg w-full max-w-sm mx-base">
          <div className="flex items-center justify-between p-base border-b">
            <h2 className="text-sm font-semibold text-high">
              Keyboard Shortcuts
            </h2>
            <button onClick={onClose} className="text-low hover:text-normal">
              <X size={14} />
            </button>
          </div>
          <div className="p-base">
            <div className="flex flex-col gap-half">
              {shortcuts.map(({ keys, description }) => (
                <div key={keys} className="flex items-center gap-base">
                  <kbd className="px-half py-px text-xs font-mono bg-secondary border rounded-sm text-normal min-w-[40px] text-center">
                    {keys}
                  </kbd>
                  <span className="text-xs text-normal">{description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
