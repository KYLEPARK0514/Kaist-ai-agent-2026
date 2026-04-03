import { useRef } from 'react';

interface Props {
  onSend: (content: string) => void;
  value: string;
  onChange: (value: string) => void;
  sending: boolean;
  disabled?: boolean;
}

export default function ChatInput({ onSend, value, onChange, sending, disabled = false }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || sending || disabled) return;
    onSend(trimmed);
    // Focus back after send
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isDisabled = sending || disabled;

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
          rows={1}
          placeholder={disabled ? 'Select a conversation to start chatting…' : 'Ask a question…'}
          className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm
            focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100
            disabled:bg-gray-50 disabled:opacity-60"
          style={{ maxHeight: '8rem', overflowY: 'auto' }}
          aria-label="Chat input"
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={isDisabled || !value.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white
            transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Send message"
        >
          {sending ? (
            <svg
              className="h-4 w-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg
              className="h-4 w-4 translate-x-px"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
