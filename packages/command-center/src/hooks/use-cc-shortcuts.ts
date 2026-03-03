import { useState, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useHotkeys } from 'react-hotkeys-hook';
import { useWorkspaceStore } from '@cc/stores/workspace-store';

/**
 * Global keyboard shortcuts for Command Center.
 *
 * m — Toggle mode (send-it ↔ review)
 * g then b — Go to brainstorm
 * g then w — Go to workspaces
 * g then d — Go to dashboard
 * g then f — Go to workflows
 * ? — Toggle shortcuts help dialog
 */
export function useCCShortcuts() {
  const navigate = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);

  // Mode toggle
  useHotkeys(
    'm',
    () => {
      const store = useWorkspaceStore.getState();
      store.setMode(store.mode === 'send-it' ? 'review' : 'send-it');
    },
    { preventDefault: true }
  );

  // Navigation shortcuts — g prefix
  useHotkeys('g', () => {}, { preventDefault: true });

  useHotkeys('g+b', () => void navigate({ to: '/brainstorm' }), {
    preventDefault: true,
  });

  useHotkeys('g+w', () => void navigate({ to: '/workspaces' }), {
    preventDefault: true,
  });

  useHotkeys('g+d', () => void navigate({ to: '/' }), { preventDefault: true });

  useHotkeys('g+f', () => void navigate({ to: '/workflows' }), {
    preventDefault: true,
  });

  // Help
  useHotkeys('shift+/', () => setHelpOpen((prev) => !prev), {
    preventDefault: true,
  });

  const toggleHelp = useCallback(() => setHelpOpen((prev) => !prev), []);

  return { helpOpen, toggleHelp };
}
