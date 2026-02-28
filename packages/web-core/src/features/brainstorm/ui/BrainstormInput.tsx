import { useCallback, useRef, useState } from 'react';
import {
  PaperPlaneRightIcon,
  StopIcon,
  LightningIcon,
} from '@phosphor-icons/react';
import { useBrainstormSend } from '../model/hooks/useBrainstormSend';
import { useBrainstormStore } from '../model/stores/useBrainstormStore';
import { useExtractPlan } from '../model/hooks/useBrainstormPlan';
import { cn } from '@/shared/lib/utils';

interface BrainstormInputProps {
  sessionId: string;
}

const THINKING_BUDGETS = [
  { label: 'Standard', value: 5000 },
  { label: 'Deep', value: 10000 },
  { label: 'Maximum', value: 32000 },
] as const;

export function BrainstormInput({ sessionId }: BrainstormInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { send, cancel } = useBrainstormSend();
  const isStreaming = useBrainstormStore((s) => s.isStreaming);
  const thinkingBudget = useBrainstormStore((s) => s.thinkingBudget);
  const setThinkingBudget = useBrainstormStore((s) => s.setThinkingBudget);
  const extractPlan = useExtractPlan();

  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed || isStreaming) return;
    setMessage('');
    send(sessionId, trimmed);
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [message, isStreaming, send, sessionId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setMessage(e.target.value);
      // Auto-resize textarea
      const el = e.target;
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    },
    []
  );

  return (
    <div className="border-t border-border bg-primary px-4 py-3 shrink-0">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => extractPlan.mutate(sessionId)}
          disabled={extractPlan.isPending}
          className="px-2.5 py-1 text-xs rounded border border-border text-normal hover:text-high hover:bg-secondary transition-colors disabled:opacity-50 cursor-pointer"
        >
          {extractPlan.isPending ? 'Extracting...' : 'Extract Plan'}
        </button>

        {/* Thinking budget selector */}
        <div className="flex items-center gap-1 ml-auto">
          <LightningIcon className="h-3.5 w-3.5 text-low" />
          <div className="flex rounded border border-border overflow-hidden">
            {THINKING_BUDGETS.map((budget) => (
              <button
                key={budget.value}
                onClick={() => setThinkingBudget(budget.value)}
                className={cn(
                  'px-2 py-0.5 text-xs transition-colors cursor-pointer',
                  thinkingBudget === budget.value
                    ? 'bg-brand text-on-brand'
                    : 'text-low hover:text-normal hover:bg-secondary'
                )}
              >
                {budget.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Input area */}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Message... (Cmd+Enter to send)"
          rows={1}
          disabled={isStreaming}
          className="flex-1 resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-high placeholder:text-low focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50"
        />
        {isStreaming ? (
          <button
            onClick={cancel}
            className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer shrink-0"
            title="Stop generation"
          >
            <StopIcon className="h-5 w-5" weight="fill" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!message.trim()}
            className="p-2 rounded-lg bg-brand text-on-brand hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer shrink-0"
            title="Send (Cmd+Enter)"
          >
            <PaperPlaneRightIcon className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
