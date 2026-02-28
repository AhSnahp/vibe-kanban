import type { BrainstormMessage as BrainstormMessageType } from 'shared/types';
import { BrainstormThinking } from './BrainstormThinking';
import { cn } from '@/shared/lib/utils';

interface BrainstormMessageProps {
  message: BrainstormMessageType;
}

export function BrainstormMessage({ message }: BrainstormMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-4 py-3',
          isUser
            ? 'bg-brand/10 border border-brand/20'
            : 'bg-secondary border border-border'
        )}
      >
        {!isUser && message.thinking && (
          <BrainstormThinking thinking={message.thinking} />
        )}
        <div className="text-sm text-high whitespace-pre-wrap leading-relaxed">
          {message.content}
        </div>
        {!isUser && message.model && (
          <div className="mt-2 flex items-center gap-2 text-xs text-low">
            <span>{message.model}</span>
            {message.input_tokens != null && message.output_tokens != null && (
              <span>
                {message.input_tokens.toLocaleString()} in /{' '}
                {message.output_tokens.toLocaleString()} out
                {message.thinking_tokens != null &&
                  ` / ${message.thinking_tokens.toLocaleString()} thinking`}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
