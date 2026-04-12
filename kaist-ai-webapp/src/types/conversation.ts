/**
 * TypeScript type definitions for the conversation management API.
 * Mirrors the Pydantic v2 models in kaist-ai-functions/models/conversation.py.
 */

export interface MessageSource {
  documentId: string;
  filename: string;
  chunkIndex: number;
}

export interface MessageItem {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  sources: MessageSource[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ConversationListResponse {
  conversations: ConversationSummary[];
  total: number;
}

export interface ConversationDetailResponse {
  conversation: ConversationSummary;
  messages: MessageItem[];
}

export interface SendMessageResponse {
  userMessage: MessageItem;
  assistantMessage: MessageItem;
}
