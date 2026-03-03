import { useState } from 'react';
import { PaperPlaneRight } from '@phosphor-icons/react';

interface AgentFollowUpInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function AgentFollowUpInput({
  onSend,
  disabled,
  placeholder = 'Send a follow-up message...',
}: AgentFollowUpInputProps) {
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
  };

  return (
    <div className="flex items-center gap-half border-t bg-primary p-half">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        disabled={disabled}
        placeholder={placeholder}
        className="flex-1 px-base py-half text-sm bg-secondary border rounded-sm text-high outline-none focus:ring-1 ring-brand disabled:opacity-50"
      />
      <button
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
        className="p-half text-brand hover:text-brand-hover disabled:opacity-30"
        aria-label="Send follow-up"
      >
        <PaperPlaneRight size={16} weight="fill" />
      </button>
    </div>
  );
}
