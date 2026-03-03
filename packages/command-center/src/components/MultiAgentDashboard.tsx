import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { ArrowLeft, Stop, Play } from '@phosphor-icons/react';
import { cn } from '@cc/lib/cn';
import { useMultiAgent } from '@cc/hooks/use-multi-agent';
import { WorkspacePane } from './WorkspacePane';

interface MultiAgentDashboardProps {
  workspaceIds: string[];
}

/**
 * Side-by-side view of 2-4 active workspaces using resizable panels.
 * 2 workspaces = side-by-side, 3-4 workspaces = 2x2 grid.
 */
export function MultiAgentDashboard({
  workspaceIds,
}: MultiAgentDashboardProps) {
  const { aggregateStatus, stopAll, continueAll, isAnyRunning } =
    useMultiAgent(workspaceIds);

  const ids = useMemo(() => workspaceIds.slice(0, 4), [workspaceIds]);

  if (ids.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-low">
        No workspaces selected
      </div>
    );
  }

  const useGrid = ids.length > 2;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-base p-base border-b bg-secondary shrink-0">
        <Link to="/workspaces" className="text-low hover:text-normal">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-base font-semibold text-high">
          Multi-Agent ({ids.length})
        </h1>
        <span className="text-xs text-low flex-1">{aggregateStatus.label}</span>
        <div className="flex items-center gap-half">
          {aggregateStatus.paused > 0 && (
            <button
              onClick={() => void continueAll()}
              className={cn(
                'flex items-center gap-half px-base py-half text-xs rounded-sm',
                'bg-brand text-on-brand hover:bg-brand-hover'
              )}
            >
              <Play size={12} weight="fill" />
              Continue All
            </button>
          )}
          {isAnyRunning && (
            <button
              onClick={() => void stopAll()}
              className="flex items-center gap-half px-base py-half text-xs rounded-sm border text-normal hover:text-high"
            >
              <Stop size={12} weight="fill" />
              Stop All
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-half">
        {useGrid ? (
          // 2x2 grid for 3-4 workspaces
          <Group orientation="vertical">
            <Panel defaultSize={50} minSize={20}>
              <Group orientation="horizontal">
                <Panel defaultSize={50} minSize={20}>
                  <WorkspacePane workspaceId={ids[0]} isActive={true} />
                </Panel>
                <Separator className="w-1 bg-transparent hover:bg-brand/50 transition-colors cursor-col-resize" />
                <Panel defaultSize={50} minSize={20}>
                  <WorkspacePane workspaceId={ids[1]} isActive={true} />
                </Panel>
              </Group>
            </Panel>
            <Separator className="h-1 bg-transparent hover:bg-brand/50 transition-colors cursor-row-resize" />
            <Panel defaultSize={50} minSize={20}>
              <Group orientation="horizontal">
                <Panel defaultSize={50} minSize={20}>
                  <WorkspacePane workspaceId={ids[2]} isActive={true} />
                </Panel>
                {ids[3] && (
                  <>
                    <Separator className="w-1 bg-transparent hover:bg-brand/50 transition-colors cursor-col-resize" />
                    <Panel defaultSize={50} minSize={20}>
                      <WorkspacePane workspaceId={ids[3]} isActive={true} />
                    </Panel>
                  </>
                )}
              </Group>
            </Panel>
          </Group>
        ) : (
          // Side-by-side for 1-2 workspaces
          <Group orientation="horizontal">
            <Panel defaultSize={50} minSize={20}>
              <WorkspacePane workspaceId={ids[0]} isActive={true} />
            </Panel>
            {ids[1] && (
              <>
                <Separator className="w-1 bg-transparent hover:bg-brand/50 transition-colors cursor-col-resize" />
                <Panel defaultSize={50} minSize={20}>
                  <WorkspacePane workspaceId={ids[1]} isActive={true} />
                </Panel>
              </>
            )}
          </Group>
        )}
      </div>
    </div>
  );
}
