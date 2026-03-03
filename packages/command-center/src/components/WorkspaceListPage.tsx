import { Robot } from '@phosphor-icons/react';
import { useWorkspaceStream } from '@cc/hooks/use-workspace-stream';
import { WorkspaceCard } from './WorkspaceCard';
import { ModeToggle } from './ModeToggle';

export function WorkspaceListPage() {
  const { workspaces, isConnected, isInitialized } = useWorkspaceStream();

  // Sort newest first
  const sorted = [...workspaces].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-base p-base border-b bg-secondary">
        <Robot size={18} className="text-brand" weight="fill" />
        <h1 className="text-lg font-semibold text-high flex-1">Workspaces</h1>
        <ModeToggle />
      </div>

      <div className="flex-1 overflow-y-auto p-base">
        {!isInitialized && !isConnected && (
          <p className="text-sm text-low animate-pulse">
            Connecting to workspace stream...
          </p>
        )}

        {isInitialized && sorted.length === 0 && (
          <div className="flex flex-col items-center gap-base py-double text-center">
            <Robot size={32} className="text-low" />
            <p className="text-sm text-low">
              No workspaces yet. Launch an agent from a kanban card to get
              started.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-half">
          {sorted.map((ws) => (
            <WorkspaceCard key={ws.id} workspace={ws} />
          ))}
        </div>
      </div>
    </div>
  );
}
