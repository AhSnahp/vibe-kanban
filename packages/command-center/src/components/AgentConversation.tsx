import { useMemo } from 'react';
import { useJsonPatchWsStream } from '@/shared/hooks/useJsonPatchWsStream';
import { cn } from '@cc/lib/cn';

interface LogEntry {
  id?: string;
  role?: string;
  content?: string;
  tool_name?: string;
  tool_input?: unknown;
  [key: string]: unknown;
}

interface LogStreamData {
  entries: LogEntry[];
}

interface AgentConversationProps {
  processId: string | null;
  className?: string;
}

/**
 * Lean agent conversation view. Streams normalized log entries
 * and renders user messages, assistant text, and tool-use indicators.
 */
export function AgentConversation({
  processId,
  className,
}: AgentConversationProps) {
  const endpoint = processId
    ? `/api/execution-processes/${processId}/normalized-logs/ws`
    : undefined;

  const { data, isConnected } = useJsonPatchWsStream<LogStreamData>(
    endpoint,
    !!processId,
    () => ({ entries: [] })
  );

  const entries = data?.entries ?? [];

  // Collapse consecutive tool entries into a single indicator
  const rendered = useMemo(() => {
    const result: Array<
      | { type: 'user'; content: string; key: string }
      | { type: 'assistant'; content: string; key: string }
      | { type: 'tools'; names: string[]; key: string }
    > = [];

    let toolBatch: string[] = [];
    let toolKey = '';

    const flushTools = () => {
      if (toolBatch.length > 0) {
        result.push({
          type: 'tools',
          names: [...toolBatch],
          key: toolKey,
        });
        toolBatch = [];
      }
    };

    entries.forEach((entry, i) => {
      const key = entry.id ?? String(i);
      if (entry.role === 'user' && entry.content) {
        flushTools();
        result.push({ type: 'user', content: entry.content, key });
      } else if (entry.role === 'assistant' && entry.content) {
        flushTools();
        result.push({ type: 'assistant', content: entry.content, key });
      } else if (entry.tool_name) {
        if (toolBatch.length === 0) toolKey = key;
        toolBatch.push(entry.tool_name);
      }
    });
    flushTools();

    return result;
  }, [entries]);

  if (!processId) {
    return (
      <div className={cn('p-base text-sm text-low', className)}>
        No execution process selected.
      </div>
    );
  }

  return (
    <div
      className={cn('flex flex-col gap-half p-half overflow-y-auto', className)}
    >
      {!isConnected && entries.length === 0 && (
        <p className="text-xs text-low animate-pulse">
          Connecting to agent stream...
        </p>
      )}

      {rendered.map((item) => {
        if (item.type === 'user') {
          return (
            <div
              key={item.key}
              className="px-base py-half rounded-sm bg-brand/10 text-sm text-high"
            >
              <span className="text-xs font-medium text-brand mr-half">
                You:
              </span>
              <span className="whitespace-pre-wrap">{item.content}</span>
            </div>
          );
        }
        if (item.type === 'assistant') {
          return (
            <div
              key={item.key}
              className="px-base py-half text-sm text-high whitespace-pre-wrap"
            >
              {item.content}
            </div>
          );
        }
        // tools
        return (
          <div
            key={item.key}
            className="px-base py-px text-xs text-low font-mono"
          >
            {item.names.length === 1
              ? `> ${item.names[0]}`
              : `> ${item.names.length} tool calls`}
          </div>
        );
      })}
    </div>
  );
}
