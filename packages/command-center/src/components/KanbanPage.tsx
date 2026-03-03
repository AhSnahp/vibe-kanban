import { useState, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Plus } from '@phosphor-icons/react';
import {
  KanbanProvider,
  KanbanBoard,
  KanbanCards,
  KanbanCard,
  KanbanHeader,
  type DropResult,
} from '@vibe/ui/components/KanbanBoard';
import { useStatuses } from '@cc/hooks/use-statuses';
import {
  useIssues,
  useCreateIssue,
  useBulkUpdateIssues,
} from '@cc/hooks/use-issues';
import { useWorkspaceStore } from '@cc/stores/workspace-store';
import type { Issue, ProjectStatus } from '@cc/lib/api';
import { IssueCard, type WorkspaceInfo } from './IssueCard';
import { IssueDetailPanel } from './IssueDetailPanel';
import { LaunchWorkspaceDialog } from './LaunchWorkspaceDialog';
import { SelectionBar } from './SelectionBar';
import { BulkLaunchDialog } from './BulkLaunchDialog';

export function KanbanPage() {
  const { projectId } = useParams({ from: '/projects/$projectId' });
  const navigate = useNavigate();
  const { data: statuses = [] } = useStatuses(projectId);
  const { data: issues = [] } = useIssues(projectId);
  const createIssue = useCreateIssue(projectId);
  const bulkUpdate = useBulkUpdateIssues(projectId);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [launchIssue, setLaunchIssue] = useState<Issue | null>(null);
  const [selectedIssueIds, setSelectedIssueIds] = useState<Set<string>>(
    new Set()
  );
  const [showBulkLaunch, setShowBulkLaunch] = useState(false);

  // Derive issue→workspace map from runtimes
  const runtimes = useWorkspaceStore((s) => s.runtimes);
  const issueWorkspaceMap = useMemo(() => {
    const map: Record<string, WorkspaceInfo> = {};
    for (const [wsId, runtime] of Object.entries(runtimes)) {
      if (runtime.issueId) {
        map[runtime.issueId] = {
          workspaceId: wsId,
          loopState: runtime.loopState,
          iterations: runtime.iterations,
        };
      }
    }
    return map;
  }, [runtimes]);

  const toggleSelectIssue = useCallback((issueId: string) => {
    setSelectedIssueIds((prev) => {
      const next = new Set(prev);
      if (next.has(issueId)) {
        next.delete(issueId);
      } else {
        next.add(issueId);
      }
      return next;
    });
  }, []);

  const selectedIssues = useMemo(
    () => issues.filter((i) => selectedIssueIds.has(i.id)),
    [issues, selectedIssueIds]
  );

  const sortedStatuses = useMemo(
    () => [...statuses].sort((a, b) => a.sort_order - b.sort_order),
    [statuses]
  );

  const issuesByStatus = useMemo(() => {
    const map: Record<string, Issue[]> = {};
    for (const s of sortedStatuses) {
      map[s.id] = [];
    }
    for (const issue of issues) {
      if (map[issue.status_id]) {
        map[issue.status_id].push(issue);
      }
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.sort_order - b.sort_order);
    }
    return map;
  }, [issues, sortedStatuses]);

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { draggableId, source, destination } = result;
      if (!destination) return;
      if (
        source.droppableId === destination.droppableId &&
        source.index === destination.index
      )
        return;

      const destStatusId = destination.droppableId;
      const destIssues = [...(issuesByStatus[destStatusId] ?? [])];

      // If moving within the same column, remove from source position first
      if (source.droppableId === destStatusId) {
        const srcIdx = destIssues.findIndex((i) => i.id === draggableId);
        if (srcIdx >= 0) destIssues.splice(srcIdx, 1);
      }

      // Insert at destination index
      const movedIssue = issues.find((i) => i.id === draggableId);
      if (!movedIssue) return;
      destIssues.splice(destination.index, 0, movedIssue);

      // Compute new sort_orders for all items in destination column
      const updates = destIssues.map((issue, idx) => ({
        id: issue.id,
        status_id: destStatusId,
        sort_order: idx * 1000,
      }));

      bulkUpdate.mutate(updates);
    },
    [issues, issuesByStatus, bulkUpdate]
  );

  const handleAddIssue = async (statusId: string) => {
    const title = newTitle.trim();
    if (!title) return;
    const columnIssues = issuesByStatus[statusId] ?? [];
    const maxOrder = columnIssues.reduce(
      (max, i) => Math.max(max, i.sort_order),
      0
    );
    await createIssue.mutateAsync({
      project_id: projectId,
      status_id: statusId,
      title,
      sort_order: maxOrder + 1000,
    });
    setNewTitle('');
    setAddingToColumn(null);
  };

  const selectedIssue = selectedIssueId
    ? (issues.find((i) => i.id === selectedIssueId) ?? null)
    : null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-base p-base border-b bg-secondary">
        <Link to="/" className="text-low hover:text-normal">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-semibold text-high">Kanban Board</h1>
      </div>

      <div className="flex-1 overflow-x-auto p-base">
        {sortedStatuses.length === 0 ? (
          <p className="text-sm text-low">Loading board...</p>
        ) : (
          <KanbanProvider onDragEnd={handleDragEnd}>
            {sortedStatuses.map((status) => (
              <KanbanBoard key={status.id}>
                <KanbanHeader>
                  <ColumnHeader
                    status={status}
                    count={(issuesByStatus[status.id] ?? []).length}
                    onAdd={() => setAddingToColumn(status.id)}
                  />
                </KanbanHeader>
                <KanbanCards id={status.id}>
                  {(issuesByStatus[status.id] ?? []).map((issue, idx) => (
                    <KanbanCard
                      key={issue.id}
                      id={issue.id}
                      name={issue.title}
                      index={idx}
                      onClick={() => setSelectedIssueId(issue.id)}
                      isOpen={selectedIssueId === issue.id}
                    >
                      <IssueCard
                        issue={issue}
                        onLaunch={setLaunchIssue}
                        workspaceInfo={issueWorkspaceMap[issue.id]}
                        onWorkspaceClick={(wsId) =>
                          navigate({
                            to: '/workspaces/$workspaceId',
                            params: { workspaceId: wsId },
                          })
                        }
                        isSelected={selectedIssueIds.has(issue.id)}
                        onToggleSelect={toggleSelectIssue}
                      />
                    </KanbanCard>
                  ))}
                </KanbanCards>
                {addingToColumn === status.id && (
                  <div className="p-half">
                    <input
                      autoFocus
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddIssue(status.id);
                        if (e.key === 'Escape') setAddingToColumn(null);
                      }}
                      onBlur={() => setAddingToColumn(null)}
                      placeholder="Issue title..."
                      className="w-full px-base py-half border rounded-sm bg-primary text-sm text-high outline-none focus:ring-1 ring-brand"
                    />
                  </div>
                )}
              </KanbanBoard>
            ))}
          </KanbanProvider>
        )}
      </div>

      {selectedIssue && (
        <IssueDetailPanel
          issue={selectedIssue}
          statuses={sortedStatuses}
          projectId={projectId}
          onClose={() => setSelectedIssueId(null)}
        />
      )}

      {launchIssue && (
        <LaunchWorkspaceDialog
          issue={launchIssue}
          projectId={projectId}
          onClose={() => setLaunchIssue(null)}
          onLaunched={(wsId) => {
            setLaunchIssue(null);
            navigate({
              to: '/workspaces/$workspaceId',
              params: { workspaceId: wsId },
            });
          }}
        />
      )}

      {selectedIssueIds.size > 0 && (
        <SelectionBar
          count={selectedIssueIds.size}
          onLaunchAll={() => setShowBulkLaunch(true)}
          onClear={() => setSelectedIssueIds(new Set())}
        />
      )}

      {showBulkLaunch && (
        <BulkLaunchDialog
          issues={selectedIssues}
          projectId={projectId}
          onClose={() => setShowBulkLaunch(false)}
          onLaunched={(wsIds) => {
            setShowBulkLaunch(false);
            setSelectedIssueIds(new Set());
            if (wsIds.length > 1) {
              navigate({
                to: '/multi',
                search: { ids: wsIds.join(',') },
              });
            } else if (wsIds.length === 1) {
              navigate({
                to: '/workspaces/$workspaceId',
                params: { workspaceId: wsIds[0] },
              });
            }
          }}
        />
      )}
    </div>
  );
}

function ColumnHeader({
  status,
  count,
  onAdd,
}: {
  status: ProjectStatus;
  count: number;
  onAdd: () => void;
}) {
  return (
    <div className="sticky top-0 z-20 flex items-center gap-base p-base bg-secondary">
      <div
        className="h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: status.color }}
      />
      <span className="flex-1 text-sm font-medium text-high">
        {status.name}
      </span>
      <span className="text-xs text-low">{count}</span>
      <button
        onClick={onAdd}
        className="text-low hover:text-normal p-0"
        aria-label="Add issue"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
