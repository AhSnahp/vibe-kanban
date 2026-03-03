import { useEffect } from 'react';
import { XTermInstance } from '@/shared/components/XTermInstance';
import { useTerminal } from '@/shared/hooks/useTerminal';

interface WorkspaceTerminalProps {
  workspaceId: string;
}

/**
 * Thin wrapper around XTermInstance that auto-creates a terminal tab
 * for the given workspace and renders the xterm.js instance.
 */
export function WorkspaceTerminal({ workspaceId }: WorkspaceTerminalProps) {
  const { getTabsForWorkspace, createTab, getActiveTab } = useTerminal();

  const tabs = getTabsForWorkspace(workspaceId);
  const activeTab = getActiveTab(workspaceId);

  // Auto-create a tab on mount if none exist
  useEffect(() => {
    if (tabs.length === 0) {
      createTab(workspaceId, '/');
    }
  }, [workspaceId, tabs.length, createTab]);

  if (!activeTab) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-low">
        Starting terminal...
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-secondary">
      <XTermInstance
        tabId={activeTab.id}
        workspaceId={workspaceId}
        isActive={true}
      />
    </div>
  );
}
