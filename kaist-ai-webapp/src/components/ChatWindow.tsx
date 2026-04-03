import { useEffect, useRef, useState } from 'react';
import { getConversation, sendMessage } from '../api/conversations';
import type { MessageItem } from '../types/conversation';
import ChatInput from './ChatInput';
import MessageBubble from './MessageBubble';

interface Props {
  conversationId: string | null;
  onMessageSent?: () => void;
}

export default function ChatWindow({ conversationId, onMessageSent }: Props) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load message history when the selected conversation changes
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoadingHistory(true);
    setError(null);
    setMessages([]);

    getConversation(conversationId)
      .then((data) => {
        if (!cancelled) setMessages(data.messages);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load messages.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  // Auto-scroll to bottom on new messages or loading indicator
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending, loadingHistory]);

  const handleSend = async (content: string) => {
    if (!conversationId || sending) return;

    // Optimistic user bubble
    const optimisticUser: MessageItem = {
      id: `optimistic-${Date.now()}`,
      conversationId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
      sources: [],
    };

    setMessages((prev) => [...prev, optimisticUser]);
    setInput('');
    setSending(true);
    setError(null);

    try {
      const response = await sendMessage(conversationId, content);
      // Replace the optimistic bubble with the server-confirmed user message,
      // then append the assistant message.
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticUser.id),
        response.userMessage,
        response.assistantMessage,
      ]);
      onMessageSent?.();
    } catch (err) {
      // Remove optimistic bubble and show error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id));
      setError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  // ── Render: no conversation selected ──────────────────────────────────
  if (!conversationId) {
    return (
      <section className="flex h-full flex-col">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">Chat</h2>
          <p className="text-xs text-gray-500">Ask questions about your uploaded documents</p>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center text-center px-4">
          <svg
            className="mb-3 h-12 w-12 text-gray-200"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
          <p className="text-sm font-medium text-gray-400">No conversation selected</p>
          <p className="mt-1 text-xs text-gray-300">
            Choose a conversation from the sidebar or create a new one.
          </p>
        </div>
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={() => {}}
          sending={false}
          disabled
        />
      </section>
    );
  }

  // ── Render: conversation selected ─────────────────────────────────────
  return (
    <section className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-lg font-semibold text-gray-900">Chat</h2>
        <p className="text-xs text-gray-500">Ask questions about your uploaded documents</p>
      </div>

      {/* Message history */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loadingHistory && (
          <div className="flex justify-center py-8">
            <svg className="h-6 w-6 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        )}

        {!loadingHistory && messages.length === 0 && !sending && (
          <div className="flex h-full flex-col items-center justify-center text-center py-12">
            <svg
              className="mb-3 h-10 w-10 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            <p className="text-sm text-gray-400">No messages yet.</p>
            <p className="mt-1 text-xs text-gray-300">Press Enter to send, Shift+Enter for a new line.</p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Typing / loading indicator */}
        {sending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-white px-4 py-3 shadow-sm ring-1 ring-gray-100">
              <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div
            className="mx-auto max-w-sm rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            <span className="font-medium">Error: </span>
            {error}
          </div>
        )}

        <div ref={bottomRef} aria-hidden="true" />
      </div>

      <ChatInput
        value={input}
        onChange={setInput}
        onSend={(content) => { void handleSend(content); }}
        sending={sending}
      />
    </section>
  );
}
