import type { ConversationSummary } from '../types/conversation';

interface Props {
  conversation: ConversationSummary;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function ConversationItem({
  conversation,
  isSelected,
  onSelect,
  onDelete,
}: Props) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Delete "${conversation.title}"?`)) {
      onDelete(conversation.id);
    }
  };

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(conversation.id)}
        className={`group flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm
          transition-colors
          ${
            isSelected
              ? 'bg-blue-50 text-blue-700 font-medium'
              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
          }`}
        aria-current={isSelected ? 'page' : undefined}
      >
        <div className="flex min-w-0 flex-col">
          <span className="truncate">{conversation.title}</span>
          <span className="text-xs text-gray-400 font-normal">
            {conversation.messageCount} message{conversation.messageCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Delete button — visible on hover / when selected */}
        <span
          role="button"
          tabIndex={0}
          onClick={handleDelete}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleDelete(e as unknown as React.MouseEvent);
            }
          }}
          aria-label={`Delete conversation "${conversation.title}"`}
          className={`shrink-0 rounded p-0.5 text-gray-400 transition-colors
            hover:bg-red-50 hover:text-red-500
            focus:outline-none focus:ring-2 focus:ring-red-400
            opacity-0 group-hover:opacity-100 ${isSelected ? 'opacity-100' : ''}`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </span>
      </button>
    </li>
  );
}
