import { type ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { ShortcutsHelpDialog } from './ShortcutsHelpDialog';
import { useCCShortcuts } from '@cc/hooks/use-cc-shortcuts';
import { useNotifications } from '@cc/hooks/use-notifications';

export function AppLayout({ children }: { children: ReactNode }) {
  const { helpOpen, toggleHelp } = useCCShortcuts();
  useNotifications();

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <main className="flex-1 overflow-auto">{children}</main>
      {helpOpen && <ShortcutsHelpDialog onClose={toggleHelp} />}
    </div>
  );
}
