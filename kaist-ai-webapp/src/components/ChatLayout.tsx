import { useState } from 'react';
import ChatWindow from './ChatWindow';
import ConversationList from './ConversationList';

/**
 * ChatLayout — root component for the chat feature.
 *
 * Renders a two-column layout:
 *   Left  : ConversationList sidebar (lists conversations, New Chat button)
 *   Right : ChatWindow (message history + input)
 *
 * Manages `selectedConversationId` state and passes it down to both panels.
 */
export default function ChatLayout() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  // Refresh counter — incremented when a message is sent so ConversationList
  // can re-fetch counts (optional enhancement; we update count optimistically here)
  const [listKey, setListKey] = useState(0);

  const handleSelect = (id: string) => {
    setSelectedConversationId(id || null);
  };

  const handleMessageSent = () => {
    // Bump the list key to trigger a soft-refresh of conversation counts
    setListKey((k) => k + 1);
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* ── Sidebar — Conversation List ── */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white xl:w-72">
        <ConversationList
          key={listKey}
          selectedId={selectedConversationId}
          onSelect={handleSelect}
        />
      </aside>

      {/* ── Main — Chat Window ── */}
      <section className="flex flex-1 flex-col bg-gray-50">
        <ChatWindow
          conversationId={selectedConversationId}
          onMessageSent={handleMessageSent}
        />
      </section>
    </div>
  );
}
