import { useCallback, useState } from 'react';
import {
  PlusIcon,
  TrashIcon,
  ChatCircleIcon,
  FolderIcon,
} from '@phosphor-icons/react';
import type { BrainstormSession, BrainstormContext } from 'shared/types';
import { cn } from '@/shared/lib/utils';

interface BrainstormSidebarProps {
  sessions: BrainstormSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
  context: BrainstormContext[];
}

export function BrainstormSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  context,
}: BrainstormSidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleDelete = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      onDeleteSession(id);
    },
    [onDeleteSession]
  );

  return (
    <div className="flex flex-col w-64 border-r border-border bg-secondary shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <span className="text-sm font-medium text-high">Sessions</span>
        <button
          onClick={onCreateSession}
          className="p-1 rounded hover:bg-primary text-low hover:text-high transition-colors cursor-pointer"
          title="New session"
        >
          <PlusIcon className="h-4 w-4" weight="bold" />
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto py-1">
        {sessions.length === 0 ? (
          <div className="px-3 py-4 text-xs text-low text-center">
            No sessions yet
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectSession(session.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectSession(session.id);
                }
              }}
              onMouseEnter={() => setHoveredId(session.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={cn(
                'flex items-center gap-2 w-full px-3 py-2 text-left text-sm transition-colors cursor-pointer',
                session.id === activeSessionId
                  ? 'bg-brand/10 text-high'
                  : 'text-normal hover:bg-primary'
              )}
            >
              <ChatCircleIcon className="h-4 w-4 shrink-0" />
              <span className="truncate flex-1">
                {session.title || 'Untitled Session'}
              </span>
              {hoveredId === session.id && (
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, session.id)}
                  className="p-0.5 rounded hover:bg-secondary text-low hover:text-high cursor-pointer"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Context section */}
      {context.length > 0 && (
        <div className="border-t border-border">
          <div className="px-3 py-2">
            <span className="text-xs font-medium text-low uppercase tracking-wide">
              Context
            </span>
          </div>
          <div className="px-2 pb-2 space-y-1">
            {context.map((ctx) => (
              <div
                key={ctx.id}
                className="flex items-center gap-2 px-2 py-1.5 text-xs text-normal rounded bg-primary"
              >
                <FolderIcon className="h-3.5 w-3.5 shrink-0 text-low" />
                <span className="truncate">{ctx.display_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
