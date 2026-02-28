import { useCallback, useState } from 'react';
import {
  PlusIcon,
  XIcon,
  FolderIcon,
  FileIcon,
  ProjectorScreenIcon,
} from '@phosphor-icons/react';
import type { BrainstormContext, BrainstormContextType } from 'shared/types';
import { brainstormApi } from '@/shared/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { brainstormKeys } from '../model/hooks/useBrainstormSessions';

interface BrainstormContextPanelProps {
  sessionId: string;
  context: BrainstormContext[];
}

const CONTEXT_TYPES: { type: BrainstormContextType; label: string }[] = [
  { type: 'repo', label: 'Repository' },
  { type: 'file', label: 'File' },
  { type: 'project', label: 'Project' },
];

function contextIcon(type: BrainstormContextType) {
  switch (type) {
    case 'repo':
      return <FolderIcon className="h-4 w-4 shrink-0" />;
    case 'file':
      return <FileIcon className="h-4 w-4 shrink-0" />;
    case 'project':
      return <ProjectorScreenIcon className="h-4 w-4 shrink-0" />;
    default:
      return <FolderIcon className="h-4 w-4 shrink-0" />;
  }
}

export function BrainstormContextPanel({
  sessionId,
  context,
}: BrainstormContextPanelProps) {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [referenceId, setReferenceId] = useState('');
  const [selectedType, setSelectedType] =
    useState<BrainstormContextType>('repo');

  const handleAdd = useCallback(async () => {
    if (!referenceId.trim()) return;
    try {
      await brainstormApi.addContext(sessionId, {
        context_type: selectedType,
        reference_id: referenceId.trim(),
        display_name: referenceId.trim(),
        content_snapshot: null,
      });
      queryClient.invalidateQueries({
        queryKey: brainstormKeys.session(sessionId),
      });
      setReferenceId('');
      setIsAdding(false);
    } catch (e) {
      console.error('Failed to add context:', e);
    }
  }, [sessionId, selectedType, referenceId, queryClient]);

  const handleRemove = useCallback(
    async (contextId: string) => {
      try {
        await brainstormApi.removeContext(sessionId, contextId);
        queryClient.invalidateQueries({
          queryKey: brainstormKeys.session(sessionId),
        });
      } catch (e) {
        console.error('Failed to remove context:', e);
      }
    },
    [sessionId, queryClient]
  );

  return (
    <div className="border-t border-border bg-secondary p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-low uppercase tracking-wide">
          Attached Context
        </span>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="p-1 rounded hover:bg-primary text-low hover:text-high transition-colors cursor-pointer"
        >
          <PlusIcon className="h-3.5 w-3.5" weight="bold" />
        </button>
      </div>

      {/* Context items */}
      {context.length === 0 && !isAdding && (
        <p className="text-xs text-low">
          No context attached. Add repos or files to give Claude more
          information.
        </p>
      )}

      <div className="space-y-1">
        {context.map((ctx) => (
          <div
            key={ctx.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded bg-primary text-sm"
          >
            {contextIcon(ctx.context_type)}
            <span className="flex-1 truncate text-normal text-xs">
              {ctx.display_name}
            </span>
            <button
              onClick={() => handleRemove(ctx.id)}
              className="p-0.5 rounded hover:bg-secondary text-low hover:text-high cursor-pointer"
            >
              <XIcon className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Add form */}
      {isAdding && (
        <div className="mt-2 space-y-2">
          <div className="flex gap-1">
            {CONTEXT_TYPES.map((ct) => (
              <button
                key={ct.type}
                onClick={() => setSelectedType(ct.type)}
                className={`px-2 py-1 text-xs rounded cursor-pointer ${
                  selectedType === ct.type
                    ? 'bg-brand text-on-brand'
                    : 'bg-primary text-normal hover:bg-primary'
                }`}
              >
                {ct.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <input
              type="text"
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              placeholder="Reference ID or path"
              className="flex-1 px-2 py-1 text-xs rounded border border-border bg-primary text-high placeholder:text-low focus:outline-none focus:ring-1 focus:ring-brand"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button
              onClick={handleAdd}
              className="px-2 py-1 text-xs rounded bg-brand text-on-brand hover:opacity-90 cursor-pointer"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
