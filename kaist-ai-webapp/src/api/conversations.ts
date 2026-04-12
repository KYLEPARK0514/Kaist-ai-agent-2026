/**
 * Typed fetch client for the conversation management API.
 * All endpoints are served by Azure Functions and proxied through Vite dev server.
 */

import type {
  ConversationDetailResponse,
  ConversationListResponse,
  ConversationSummary,
  SendMessageResponse,
} from '../types/conversation';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export async function listConversations(): Promise<ConversationListResponse> {
  const res = await fetch(`${BASE}/api/conversations`);
  if (!res.ok) {
    throw new Error(`listConversations failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<ConversationListResponse>;
}

export async function createConversation(title: string): Promise<ConversationSummary> {
  const res = await fetch(`${BASE}/api/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    throw new Error(`createConversation failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<ConversationSummary>;
}

export async function getConversation(id: string): Promise<ConversationDetailResponse> {
  const res = await fetch(`${BASE}/api/conversations/${encodeURIComponent(id)}`);
  if (!res.ok) {
    throw new Error(`getConversation failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<ConversationDetailResponse>;
}

export async function sendMessage(conversationId: string, content: string): Promise<SendMessageResponse> {
  const res = await fetch(
    `${BASE}/api/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    },
  );
  if (!res.ok) {
    // Surface error body if available
    let errorMsg = `sendMessage failed: ${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) errorMsg = body.error;
    } catch {
      // ignore parse error
    }
    throw new Error(errorMsg);
  }
  return res.json() as Promise<SendMessageResponse>;
}

export async function deleteConversation(id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/conversations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(`deleteConversation failed: ${res.status} ${res.statusText}`);
  }
}
