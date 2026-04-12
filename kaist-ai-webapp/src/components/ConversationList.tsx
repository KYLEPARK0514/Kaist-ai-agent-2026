import { useCallback, useEffect, useState } from 'react';
import { createConversation, deleteConversation, listConversations } from '../api/conversations';
import type { ConversationSummary } from '../types/conversation';
import ConversationItem from './ConversationItem';

interface Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onConversationsChange?: (conversations: ConversationSummary[]) => void;
}

export default function ConversationList({ selectedId, onSelect, onConversationsChange }: Props) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listConversations();
      setConversations(data.conversations);
      onConversationsChange?.(data.conversations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations.');
    } finally {
      setLoading(false);
    }
  }, [onConversationsChange]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const newConv = await createConversation('New Chat');
      setConversations((prev) => [newConv, ...prev]);
      onSelect(newConv.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create conversation.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      // Parent will handle deselection via selectedId check
      if (id === selectedId) {
        onSelect('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete conversation.');
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-3">
        <h2 className="text-sm font-semibold text-gray-900">Conversations</h2>
        <button
          type="button"
          onClick={() => { void handleCreate(); }}
          disabled={creating}
          className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white
            transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="New conversation"
        >
          {creating ? (
            <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          )}
          New Chat
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-2 mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600" role="alert">
          {error}
        </div>
      )}

      {/* List */}
      <nav className="flex-1 overflow-y-auto px-2 py-2" aria-label="Conversations">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <svg className="h-5 w-5 animate-spin text-gray-300" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-gray-400">
            No conversations yet.
            <br />
            Click <strong>New Chat</strong> to start.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {conversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isSelected={conv.id === selectedId}
                onSelect={onSelect}
                onDelete={(id) => { void handleDelete(id); }}
              />
            ))}
          </ul>
        )}
      </nav>
    </div>
  );
}
