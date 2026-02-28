import { useEffect, useRef } from 'react';
import type { BrainstormMessage as BrainstormMessageType } from 'shared/types';
import { BrainstormMessage } from './BrainstormMessage';
import { BrainstormThinking } from './BrainstormThinking';
import { useBrainstormStore } from '../model/stores/useBrainstormStore';

interface BrainstormMessageListProps {
  messages: BrainstormMessageType[];
  sessionTitle: string | null;
}

export function BrainstormMessageList({
  messages,
  sessionTitle,
}: BrainstormMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const isStreaming = useBrainstormStore((s) => s.isStreaming);
  const streamingText = useBrainstormStore((s) => s.streamingText);
  const streamingThinking = useBrainstormStore((s) => s.streamingThinking);

  // Auto-scroll to bottom on new messages or streaming updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamingText, streamingThinking]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      {sessionTitle && (
        <div className="px-4 py-2 border-b border-border shrink-0">
          <h2 className="text-sm font-medium text-high truncate">
            {sessionTitle}
          </h2>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !isStreaming && (
          <div className="flex items-center justify-center h-full text-low text-sm">
            Start a conversation to brainstorm your project
          </div>
        )}

        {messages.map((msg) => (
          <BrainstormMessage key={msg.id} message={msg} />
        ))}

        {/* Streaming response */}
        {isStreaming && (streamingText || streamingThinking) && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg px-4 py-3 bg-secondary border border-border">
              {streamingThinking && (
                <BrainstormThinking thinking={streamingThinking} isStreaming />
              )}
              {streamingText && (
                <div className="text-sm text-high whitespace-pre-wrap leading-relaxed">
                  {streamingText}
                  <span className="inline-block w-2 h-4 ml-0.5 bg-high/50 animate-pulse" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Streaming indicator without content yet */}
        {isStreaming && !streamingText && !streamingThinking && (
          <div className="flex justify-start">
            <div className="rounded-lg px-4 py-3 bg-secondary border border-border">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand animate-pulse" />
                <span className="h-2 w-2 rounded-full bg-brand animate-pulse [animation-delay:150ms]" />
                <span className="h-2 w-2 rounded-full bg-brand animate-pulse [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
