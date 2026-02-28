import { useState } from 'react';
import { CaretRightIcon } from '@phosphor-icons/react';
import { cn } from '@/shared/lib/utils';

interface BrainstormThinkingProps {
  thinking: string;
  isStreaming?: boolean;
}

export function BrainstormThinking({
  thinking,
  isStreaming = false,
}: BrainstormThinkingProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!thinking) return null;

  return (
    <div className="mt-2 mb-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 text-xs text-low hover:text-normal transition-colors cursor-pointer"
      >
        <CaretRightIcon
          className={cn(
            'h-3 w-3 transition-transform',
            isExpanded && 'rotate-90'
          )}
          weight="bold"
        />
        <span className="font-medium">
          {isStreaming ? 'Thinking...' : 'Thinking'}
        </span>
      </button>
      {isExpanded && (
        <div className="mt-1.5 pl-4 border-l-2 border-indigo-500/30">
          <pre className="text-xs text-low font-ibm-plex-mono whitespace-pre-wrap leading-relaxed">
            {thinking}
          </pre>
        </div>
      )}
    </div>
  );
}
