import { Rocket } from '@phosphor-icons/react';
import type { Issue } from '@cc/lib/api';
import type { LoopState } from '@cc/stores/workspace-store';
import { cn } from '@cc/lib/cn';

const priorityConfig: Record<string, { label: string; className: string }> = {
  urgent: {
    label: 'Urgent',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  high: {
    label: 'High',
    className:
      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  },
  medium: {
    label: 'Medium',
    className:
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  low: {
    label: 'Low',
    className:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
};

const dotColor: Record<LoopState, string> = {
  idle: 'bg-gray-400',
  launching: 'bg-yellow-400',
  running: 'bg-brand animate-pulse',
  evaluating: 'bg-yellow-400 animate-pulse',
  following_up: 'bg-yellow-400 animate-pulse',
  paused: 'bg-blue-400',
  done: 'bg-success',
  failed: 'bg-error',
};

export interface WorkspaceInfo {
  workspaceId: string;
  loopState: LoopState;
  iterations: number;
}

interface IssueCardProps {
  issue: Issue;
  onLaunch?: (issue: Issue) => void;
  workspaceInfo?: WorkspaceInfo;
  onWorkspaceClick?: (workspaceId: string) => void;
  isSelected?: boolean;
  onToggleSelect?: (issueId: string) => void;
}

export function IssueCard({
  issue,
  onLaunch,
  workspaceInfo,
  onWorkspaceClick,
  isSelected,
  onToggleSelect,
}: IssueCardProps) {
  const priority = issue.priority ? priorityConfig[issue.priority] : null;

  return (
    <div
      className={cn(
        'flex flex-col gap-half group',
        isSelected && 'ring-1 ring-brand rounded-sm'
      )}
      onClick={(e) => {
        if (onToggleSelect && (e.ctrlKey || e.metaKey)) {
          e.stopPropagation();
          e.preventDefault();
          onToggleSelect(issue.id);
        }
      }}
    >
      <div className="flex items-center gap-half">
        <span className="text-xs text-low font-mono">{issue.simple_id}</span>
        {priority && (
          <span
            className={cn(
              'text-xs px-1 py-px rounded-sm font-medium',
              priority.className
            )}
          >
            {priority.label}
          </span>
        )}
        {workspaceInfo && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onWorkspaceClick?.(workspaceInfo.workspaceId);
            }}
            className="flex items-center gap-half"
            title={`Agent: ${workspaceInfo.loopState}`}
          >
            <div
              className={cn(
                'h-2 w-2 rounded-full shrink-0',
                dotColor[workspaceInfo.loopState]
              )}
            />
            {workspaceInfo.iterations > 0 && (
              <span className="text-xs text-low">
                {workspaceInfo.iterations}
              </span>
            )}
          </button>
        )}
        {onLaunch && !workspaceInfo && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLaunch(issue);
            }}
            className="ml-auto opacity-0 group-hover:opacity-100 text-brand hover:text-brand-hover transition-opacity p-0"
            aria-label="Launch agent"
            title="Launch agent for this issue"
          >
            <Rocket size={14} weight="fill" />
          </button>
        )}
      </div>
      <p className="text-sm text-high font-medium m-0 leading-snug">
        {issue.title}
      </p>
      {issue.description && (
        <p className="text-xs text-low m-0 line-clamp-2">{issue.description}</p>
      )}
    </div>
  );
}
