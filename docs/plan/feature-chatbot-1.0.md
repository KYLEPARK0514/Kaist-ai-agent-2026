# Feature: Chatbot with Knowledge Base — v1.0

> **Branch**: `L4-knowledge-base`  
> **Depends on**: Phase 2 PDF management (feature-knowledge-base-pdf-management-1.0)  
> **Model**: `gemini-2.5-pro-preview`

---

## 1. Goal

Add a chatbot feature that lets users ask questions against the uploaded PDF knowledge base.

- Webapp lists all conversations at startup
- Selecting a conversation loads the full message history
- User messages trigger Gemini responses using hybrid-search context + conversation history
- All conversations and messages are persisted in CosmosDB
- All request/response schemas are validated with Pydantic v2

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│  Browser (React + TypeScript)                                │
│                                                              │
│  ┌─────────────────┐     ┌──────────────────────────────┐   │
│  │ ConversationList│<───>│ ChatWindow                   │   │
│  │ (sidebar)       │     │  MessageBubble × N           │   │
│  │  ConversationItem│    │  ChatInput                   │   │
│  └─────────────────┘     └──────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
         │                              │
         │  GET /api/conversations      │  POST /api/conversations/{id}/messages
         │  GET /api/conversations/{id} │
         ▼                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Azure Functions (Python 3.11)                               │
│                                                              │
│  list_conversations   →  conversation_service               │
│  create_conversation  →  conversation_service               │
│  get_conversation     →  conversation_service               │
│  send_message         →  search_service (hybrid search)     │
│                          chat_service   (Gemini call)       │
│                          conversation_service (persist)     │
│  delete_conversation  →  conversation_service               │
└──────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌──────────────────┐        ┌───────────────────────────────┐
│  CosmosDB        │        │  Google Gemini API            │
│  • knowledge     │        │  • text-embedding-004 (embed) │
│  • conversations │        │  • gemini-3.1-pro-preview     │
│  • messages      │        └───────────────────────────────┘
└──────────────────┘
```

---

## 3. CosmosDB Schema

### 3.1 Existing Container: `knowledge`

Unchanged from Phase 2. Contains two item types:

| `type` | Description |
|--------|-------------|
| `"document"` | Document metadata (one per uploaded PDF) |
| `"chunk"` | Text chunk with 768-dim embedding (N per PDF) |

Chunk item fields used by hybrid search:

```json
{
  "id": "<uuid>",
  "type": "chunk",
  "documentId": "<uuid>",
  "filename": "string",
  "chunkIndex": 0,
  "content": "string",
  "embedding": [0.0, ...],   // 768 floats
  "_ts": 1234567890
}
```

### 3.2 New Container: `conversations`

| Property | Value |
|---|---|
| Container name | `conversations` |
| Partition key | `/id` |
| Throughput | Serverless (shared) |

Item schema:

```json
{
  "id": "<uuid-v4>",
  "title": "string",
  "createdAt": "2026-04-01T00:00:00Z",
  "updatedAt": "2026-04-01T00:00:00Z",
  "messageCount": 0
}
```

### 3.3 New Container: `messages`

| Property | Value |
|---|---|
| Container name | `messages` |
| Partition key | `/conversationId` |
| Throughput | Serverless (shared) |

Item schema:

```json
{
  "id": "<uuid-v4>",
  "conversationId": "<uuid-v4>",
  "role": "user" | "assistant",
  "content": "string",
  "createdAt": "2026-04-01T00:00:00Z",
  "sources": [
    {
      "documentId": "<uuid>",
      "filename": "lecture1.pdf",
      "chunkIndex": 3
    }
  ]
}
```

> `sources` is only populated on `role == "assistant"` messages.

---

## 4. Environment Variables

Add to `kaist-ai-functions/local.settings.json` and Azure Function App config:

| Key | Example Value |
|---|---|
| `AZURE_COSMOS_CONVERSATIONS_CONTAINER_NAME` | `conversations` |
| `AZURE_COSMOS_MESSAGES_CONTAINER_NAME` | `messages` |
| `GEMINI_CHAT_MODEL` | `gemini-3.1-pro-preview` |
| `CHAT_HISTORY_WINDOW` | `20` |
| `SEARCH_TOP_K` | `8` |

---

## 5. Backend File Structure (additions)

```
kaist-ai-functions/
├── blueprints/
│   ├── list_conversations.py      # GET  /api/conversations
│   ├── create_conversation.py     # POST /api/conversations
│   ├── get_conversation.py        # GET  /api/conversations/{id}
│   ├── send_message.py            # POST /api/conversations/{id}/messages
│   └── delete_conversation.py    # DELETE /api/conversations/{id}
├── models/
│   └── conversation.py            # Pydantic v2 models (see §6)
└── services/
    ├── conversation_service.py    # Conversations + messages CRUD
    ├── search_service.py          # Hybrid search on knowledge container
    └── chat_service.py            # Context assembly + Gemini call
```

---

## 6. Pydantic Models (`models/conversation.py`)

```python
from __future__ import annotations
from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4
from pydantic import BaseModel, Field


# ── CosmosDB Record Models ──────────────────────────────────────────────────

class ConversationRecord(BaseModel):
    """Stored item in the 'conversations' container."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    title: str
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        alias="createdAt",
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        alias="updatedAt",
    )
    message_count: int = Field(default=0, alias="messageCount")

    model_config = {"populate_by_name": True}

    def to_cosmos_dict(self) -> dict:
        return self.model_dump(by_alias=True, mode="json")


class MessageSource(BaseModel):
    document_id: str = Field(alias="documentId")
    filename: str
    chunk_index: int = Field(alias="chunkIndex")

    model_config = {"populate_by_name": True}


class MessageRecord(BaseModel):
    """Stored item in the 'messages' container."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    conversation_id: str = Field(alias="conversationId")
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        alias="createdAt",
    )
    sources: list[MessageSource] = Field(default_factory=list)

    model_config = {"populate_by_name": True}

    def to_cosmos_dict(self) -> dict:
        return self.model_dump(by_alias=True, mode="json")


# ── API Request Models ──────────────────────────────────────────────────────

class CreateConversationRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=8000)


# ── API Response Models ─────────────────────────────────────────────────────

class ConversationSummary(BaseModel):
    id: str
    title: str
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    message_count: int = Field(alias="messageCount")

    model_config = {"populate_by_name": True}

    @classmethod
    def from_record(cls, record: ConversationRecord) -> ConversationSummary:
        return cls(
            id=record.id,
            title=record.title,
            createdAt=record.created_at,
            updatedAt=record.updated_at,
            messageCount=record.message_count,
        )


class ConversationListResponse(BaseModel):
    conversations: list[ConversationSummary]
    total: int


class MessageItem(BaseModel):
    id: str
    conversation_id: str = Field(alias="conversationId")
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime = Field(alias="createdAt")
    sources: list[MessageSource] = Field(default_factory=list)

    model_config = {"populate_by_name": True}

    @classmethod
    def from_record(cls, record: MessageRecord) -> MessageItem:
        return cls(
            id=record.id,
            conversationId=record.conversation_id,
            role=record.role,
            content=record.content,
            createdAt=record.created_at,
            sources=record.sources,
        )


class ConversationDetailResponse(BaseModel):
    conversation: ConversationSummary
    messages: list[MessageItem]


class SendMessageResponse(BaseModel):
    user_message: MessageItem = Field(alias="userMessage")
    assistant_message: MessageItem = Field(alias="assistantMessage")

    model_config = {"populate_by_name": True}
```

---

## 7. Services

### 7.1 `conversation_service.py`

**Responsibilities**: CRUD operations for the `conversations` and `messages` containers.

```
ConversationService
  ├── list_conversations() → list[ConversationRecord]
  │     SELECT * FROM c ORDER BY c.updatedAt DESC OFFSET 0 LIMIT 100
  │
  ├── create_conversation(title) → ConversationRecord
  │     upsert_item(ConversationRecord(title=title).to_cosmos_dict())
  │
  ├── get_conversation(conversation_id) → ConversationRecord | None
  │     read_item(item=conversation_id, partition_key=conversation_id)
  │
  ├── delete_conversation(conversation_id) → None
  │     1. delete_item from conversations container
  │     2. query all messages WHERE conversationId = @id, batch delete
  │
  ├── add_message(record: MessageRecord) → MessageRecord
  │     upsert_item in messages container
  │
  ├── get_messages(conversation_id, limit=20) → list[MessageRecord]
  │     SELECT * FROM c WHERE c.conversationId = @id
  │     ORDER BY c.createdAt ASC
  │
  └── increment_message_count(conversation_id) → None
        read conversation → updated_at = now(), message_count += 1 → upsert
```

Key implementation notes:
- Use `container.read_item(item=..., partition_key=...)` for O(1) point reads
- `delete_conversation` must delete all messages in the same partition (`conversationId`)
- `get_messages` uses `OFFSET 0 LIMIT {CHAT_HISTORY_WINDOW}` ordered by `createdAt ASC`

### 7.2 `search_service.py`

**Responsibilities**: Hybrid search (keyword + vector) against the `knowledge` container.

```
SearchService
  └── hybrid_search(query: str, top_k: int = 8) → list[ChunkResult]
        1. Generate query embedding via text-embedding-004
        2. Execute hybrid search query (RRF) against knowledge container
        3. Return top_k chunks with content + source metadata
```

**Hybrid Search Query** (CosmosDB NoSQL):

```sql
SELECT TOP @topK
    c.content,
    c.documentId,
    c.filename,
    c.chunkIndex,
    RANK RRF(
        FullTextScore(c, @keywords),
        VectorDistance(c.embedding, @queryVector)
    ) AS searchScore
FROM c
WHERE c.type = 'chunk'
ORDER BY RANK RRF(
    FullTextScore(c, @keywords),
    VectorDistance(c.embedding, @queryVector)
)
```

Parameters:
- `@topK`: integer (from `SEARCH_TOP_K` env var, default 8)
- `@keywords`: list of tokens extracted from user query (lower-cased, stop-words removed)
- `@queryVector`: 768-dim float array from `text-embedding-004`

Keyword extraction (simple):
```python
import re, string
STOP_WORDS = {"a", "an", "the", "is", "are", "was", "were", "of", "in", "on",
              "at", "to", "for", "with", "what", "how", "why", "where", "when"}

def extract_keywords(text: str) -> list[str]:
    tokens = re.sub(r"[^\w\s]", "", text.lower()).split()
    return [t for t in tokens if t not in STOP_WORDS and len(t) > 1]
```

**ChunkResult model** (internal dataclass, no Pydantic):

```python
@dataclass
class ChunkResult:
    document_id: str
    filename: str
    chunk_index: int
    content: str
    score: float
```

> **Prerequisite**: The `knowledge` container must have:
> - A **full-text index** on the `content` field (for `FullTextScore`)
> - A **vector index** (quantizedFlat or diskANN) on the `embedding` field
>
> These are provisioned in `cosmos.bicep`. Verify both policies exist before running hybrid search.

### 7.3 `chat_service.py`

**Responsibilities**: Build context from search results + history, call Gemini API, return text.

```
ChatService
  └── generate_response(
          user_query: str,
          search_results: list[ChunkResult],
          history: list[MessageRecord]
      ) → str
        1. Build system prompt with injected PDF context
        2. Build conversation history as chat.history list
        3. Call gemini-3.1-pro-preview chat API
        4. Return response text
```

**System prompt template**:

```
You are a helpful AI assistant for KAIST students.
Answer the user's question using ONLY the provided context.
If the context does not contain enough information, say so clearly.
Do not hallucinate or make up information.

=== KNOWLEDGE BASE CONTEXT ===
{for each chunk: "[Source: {filename}, chunk {chunkIndex}]\n{content}\n\n"}
=== END OF CONTEXT ===

Answer in the same language the user used to ask the question.
```

**Conversation history format** (passed as `chat.history`):

```python
history_turns = [
    {"role": "user",  "parts": [{"text": msg.content}]}
    if msg.role == "user"
    else {"role": "model", "parts": [{"text": msg.content}]}
    for msg in history[:-1]   # exclude the most recent user message
]
```

**Gemini API call**:

```python
import google.generativeai as genai

genai.configure(api_key=os.environ["GOOGLE_API_KEY"])
model = genai.GenerativeModel(
    model_name=os.environ.get("GEMINI_CHAT_MODEL", "gemini-3.1-pro-preview"),
    system_instruction=system_prompt,
)
chat = model.start_chat(history=history_turns)
response = chat.send_message(user_query)
return response.text
```

---

## 8. API Endpoints

### 8.1 `GET /api/conversations`

List all conversations ordered by `updatedAt DESC`.

**Response `200 OK`**:
```json
{
  "conversations": [
    {
      "id": "uuid",
      "title": "What is reinforcement learning?",
      "createdAt": "2026-04-01T10:00:00Z",
      "updatedAt": "2026-04-01T10:05:00Z",
      "messageCount": 4
    }
  ],
  "total": 1
}
```

### 8.2 `POST /api/conversations`

Create a new empty conversation.

**Request body**:
```json
{ "title": "New chat" }
```

**Response `201 Created`**:
```json
{
  "id": "uuid",
  "title": "New chat",
  "createdAt": "2026-04-01T10:00:00Z",
  "updatedAt": "2026-04-01T10:00:00Z",
  "messageCount": 0
}
```

**Error `400 Bad Request`**: when `title` is empty or missing.

### 8.3 `GET /api/conversations/{id}`

Return conversation metadata + full message history.

**Response `200 OK`**:
```json
{
  "conversation": { "id": "...", "title": "...", "createdAt": "...", "updatedAt": "...", "messageCount": 4 },
  "messages": [
    { "id": "...", "conversationId": "...", "role": "user",      "content": "What is RL?", "createdAt": "...", "sources": [] },
    { "id": "...", "conversationId": "...", "role": "assistant", "content": "RL is ...",   "createdAt": "...", "sources": [{"documentId":"...","filename":"lecture1.pdf","chunkIndex":3}] }
  ]
}
```

**Error `404 Not Found`**: when conversation does not exist.

### 8.4 `POST /api/conversations/{id}/messages`

Send a user message and receive an AI response.

**Request body**:
```json
{ "content": "Explain the policy gradient theorem." }
```

**Processing pipeline** (executed synchronously):

```
1.  Validate request body → SendMessageRequest
2.  Verify conversation exists → 404 if not
3.  Persist user MessageRecord → messages container
4.  Retrieve last CHAT_HISTORY_WINDOW messages for context
5.  Run hybrid_search(user.content, top_k=SEARCH_TOP_K)
6.  Call chat_service.generate_response(query, chunks, history)
7.  Build assistant MessageRecord with sources from chunk results
8.  Persist assistant MessageRecord → messages container
9.  Increment conversation.messageCount + updatedAt → conversations container
10. Return SendMessageResponse (both user + assistant messages)
```

**Response `200 OK`**:
```json
{
  "userMessage": {
    "id": "uuid", "conversationId": "uuid", "role": "user",
    "content": "Explain the policy gradient theorem.", "createdAt": "...", "sources": []
  },
  "assistantMessage": {
    "id": "uuid", "conversationId": "uuid", "role": "assistant",
    "content": "The policy gradient theorem states that ...",
    "createdAt": "...",
    "sources": [
      { "documentId": "uuid", "filename": "lecture5.pdf", "chunkIndex": 12 }
    ]
  }
}
```

**Error `404 Not Found`**: conversation does not exist.  
**Error `400 Bad Request`**: empty content.  
**Error `502 Bad Gateway`**: Gemini API failure.

### 8.5 `DELETE /api/conversations/{id}`

Delete a conversation and all its messages.

**Response `204 No Content`**  
**Error `404 Not Found`**: conversation does not exist.

---

## 9. Frontend File Structure (additions)

```
kaist-ai-webapp/src/
├── api/
│   └── conversations.ts          # Typed fetch client for conversation endpoints
├── types/
│   └── conversation.ts           # TypeScript interfaces
└── components/
    ├── ConversationList.tsx       # Left sidebar: list + "New Chat" button
    ├── ConversationItem.tsx       # Single row in sidebar
    ├── ChatWindow.tsx             # Scrollable message history
    ├── MessageBubble.tsx          # User / assistant message bubble
    ├── ChatInput.tsx              # Textarea + Send button
    └── ChatLayout.tsx             # Root layout: sidebar + chat window
```

### 9.1 TypeScript Types (`types/conversation.ts`)

```typescript
export interface MessageSource {
  documentId: string;
  filename: string;
  chunkIndex: number;
}

export interface MessageItem {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
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
```

### 9.2 API Client (`api/conversations.ts`)

```typescript
const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export async function listConversations(): Promise<ConversationListResponse> {
  const res = await fetch(`${BASE}/api/conversations`);
  if (!res.ok) throw new Error(`listConversations failed: ${res.status}`);
  return res.json();
}

export async function createConversation(title: string): Promise<ConversationSummary> {
  const res = await fetch(`${BASE}/api/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`createConversation failed: ${res.status}`);
  return res.json();
}

export async function getConversation(id: string): Promise<ConversationDetailResponse> {
  const res = await fetch(`${BASE}/api/conversations/${id}`);
  if (!res.ok) throw new Error(`getConversation failed: ${res.status}`);
  return res.json();
}

export async function sendMessage(conversationId: string, content: string): Promise<SendMessageResponse> {
  const res = await fetch(`${BASE}/api/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`sendMessage failed: ${res.status}`);
  return res.json();
}

export async function deleteConversation(id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/conversations/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`deleteConversation failed: ${res.status}`);
}
```

### 9.3 Component Responsibilities

| Component | State | Props | Behaviour |
|---|---|---|---|
| `ChatLayout` | `selectedConversationId: string \| null` | — | On mount: call `listConversations()`. Renders `ConversationList` + `ChatWindow` side by side. |
| `ConversationList` | — | `conversations`, `selectedId`, `onSelect`, `onCreate`, `onDelete` | Shows sorted list. "New Chat" button calls `onCreate`. Each row calls `onSelect`. |
| `ConversationItem` | `isRenaming: bool` | `conversation`, `isSelected`, `onSelect`, `onDelete` | Highlights selected. Delete button with confirm. |
| `ChatWindow` | `messages: MessageItem[]`, `loading: bool` | `conversationId \| null` | On `conversationId` change: call `getConversation()` and replace `messages`. Auto-scroll to bottom. Shows empty state when no conversation selected. |
| `MessageBubble` | — | `message: MessageItem` | User messages right-aligned, assistant left-aligned. Shows collapsible sources list for assistant messages. |
| `ChatInput` | `value: string`, `sending: bool` | `onSend(content: string)` | Disabled while `sending`. Submit on Enter (Shift+Enter for newline). |

### 9.4 UI State Flow

```
App starts
  └─ ChatLayout mounts
       └─ listConversations() → populate sidebar
            │
            ▼
  User clicks conversation
       └─ getConversation(id) → load messages into ChatWindow
            │
            ▼
  User types message → hits Send
       └─ sendMessage(id, content)
            ├─ Optimistically append user bubble (role=user, content)
            ├─ Show loading indicator in ChatWindow
            ├─ On response: append assistant bubble
            └─ On error: show error toast, remove optimistic bubble
            │
            ▼
  User clicks "New Chat"
       └─ createConversation("New Chat") → select new conversation
            │
            ▼
  User deletes conversation
       └─ deleteConversation(id) → remove from list, deselect if active
```

---

## 10. Infrastructure Changes (`kaist-ai-infra/modules/cosmos.bicep`)

Add two new containers to the existing `kaistdb` database:

```bicep
// conversations container
{
  name: 'conversations'
  partitionKeyPath: '/id'
  defaultTtl: -1
}

// messages container
{
  name: 'messages'
  partitionKeyPath: '/conversationId'
  defaultTtl: -1
}
```

The `knowledge` container must already have the following policies (verify and add if missing):

```bicep
// Full-text search policy (for FullTextScore in hybrid search)
fullTextPolicy: {
  defaultLanguage: 'en-US'
  fullTextPaths: [
    { path: '/content', language: 'en-US' }
  ]
}

// Vector embedding policy — already provisioned but verify dimensions = 768
vectorEmbeddingPolicy: {
  vectorEmbeddings: [
    {
      path: '/embedding'
      dataType: 'float32'
      dimensions: 768
      distanceFunction: 'cosine'
    }
  ]
}

// Indexing policy — must include full-text and vector indexes
indexingPolicy: {
  fullTextIndexes: [{ path: '/content' }]
  vectorIndexes:  [{ path: '/embedding', type: 'quantizedFlat' }]
}
```

---

## 11. Task List

### Phase A — Infrastructure & Models

| ID | Task | File | Notes |
|---|---|---|---|
| TASK-C001 | Add `conversations` and `messages` containers to `cosmos.bicep` | `kaist-ai-infra/modules/cosmos.bicep` | Partition keys: `/id`, `/conversationId` |
| TASK-C002 | Verify / add full-text index on `knowledge.content` in `cosmos.bicep` | `kaist-ai-infra/modules/cosmos.bicep` | Required for `FullTextScore` in hybrid query |
| TASK-C003 | Re-provision infrastructure (`azd provision`) | — | Deploy container + index changes |
| TASK-C004 | Create `models/conversation.py` with all Pydantic v2 models | `kaist-ai-functions/models/conversation.py` | See §6 for full schema |
| TASK-C005 | Update `models/__init__.py` to export new models | `kaist-ai-functions/models/__init__.py` | |
| TASK-C006 | Add new env vars to `local.settings.json` | `kaist-ai-functions/local.settings.json` | `AZURE_COSMOS_CONVERSATIONS_CONTAINER_NAME`, `AZURE_COSMOS_MESSAGES_CONTAINER_NAME`, `GEMINI_CHAT_MODEL`, `CHAT_HISTORY_WINDOW`, `SEARCH_TOP_K` |

### Phase B — Backend Services

| ID | Task | File | Notes |
|---|---|---|---|
| TASK-C007 | Create `conversation_service.py` | `kaist-ai-functions/services/conversation_service.py` | list, create, get, delete conversations; add/get messages; increment count |
| TASK-C008 | Create `search_service.py` | `kaist-ai-functions/services/search_service.py` | Hybrid search via RRF (`FullTextScore` + `VectorDistance`) against `knowledge` container |
| TASK-C009 | Create `chat_service.py` | `kaist-ai-functions/services/chat_service.py` | System prompt injection, history formatting, Gemini API call via `google-generativeai` |
| TASK-C010 | Update `services/__init__.py` to export new services | `kaist-ai-functions/services/__init__.py` | |

### Phase C — Backend Endpoints

| ID | Task | File | Notes |
|---|---|---|---|
| TASK-C011 | Create `list_conversations.py` blueprint | `kaist-ai-functions/blueprints/list_conversations.py` | `GET /api/conversations` → `ConversationListResponse` |
| TASK-C012 | Create `create_conversation.py` blueprint | `kaist-ai-functions/blueprints/create_conversation.py` | `POST /api/conversations` → `ConversationSummary` (201) |
| TASK-C013 | Create `get_conversation.py` blueprint | `kaist-ai-functions/blueprints/get_conversation.py` | `GET /api/conversations/{id}` → `ConversationDetailResponse` |
| TASK-C014 | Create `send_message.py` blueprint | `kaist-ai-functions/blueprints/send_message.py` | `POST /api/conversations/{id}/messages` → `SendMessageResponse`; runs full pipeline |
| TASK-C015 | Create `delete_conversation.py` blueprint | `kaist-ai-functions/blueprints/delete_conversation.py` | `DELETE /api/conversations/{id}` → 204 |
| TASK-C016 | Register new blueprints in `function_app.py` | `kaist-ai-functions/function_app.py` | `app.register_blueprint(bp)` for each new blueprint |
| TASK-C017 | Add `google-generativeai` to `requirements.txt` | `kaist-ai-functions/requirements.txt` | Pinned version, e.g. `google-generativeai>=0.8.0` |

### Phase D — Frontend

| ID | Task | File | Notes |
|---|---|---|---|
| TASK-C018 | Create `types/conversation.ts` | `kaist-ai-webapp/src/types/conversation.ts` | All TypeScript interfaces (see §9.1) |
| TASK-C019 | Create `api/conversations.ts` | `kaist-ai-webapp/src/api/conversations.ts` | Typed fetch client (see §9.2) |
| TASK-C020 | Create `MessageBubble.tsx` | `kaist-ai-webapp/src/components/MessageBubble.tsx` | User/assistant bubbles, collapsible sources |
| TASK-C021 | Create `ChatInput.tsx` | `kaist-ai-webapp/src/components/ChatInput.tsx` | Textarea + Send; disabled while sending; Enter to submit |
| TASK-C022 | Create `ChatWindow.tsx` | `kaist-ai-webapp/src/components/ChatWindow.tsx` | Loads history on `conversationId` change; auto-scroll; loading state |
| TASK-C023 | Create `ConversationItem.tsx` | `kaist-ai-webapp/src/components/ConversationItem.tsx` | Row with title, selected highlight, delete button |
| TASK-C024 | Create `ConversationList.tsx` | `kaist-ai-webapp/src/components/ConversationList.tsx` | Sidebar with "New Chat" button; fetches list on mount |
| TASK-C025 | Create `ChatLayout.tsx` | `kaist-ai-webapp/src/components/ChatLayout.tsx` | Combines sidebar + chat window; manages `selectedConversationId` state |
| TASK-C026 | Update `App.tsx` to render `ChatLayout` | `kaist-ai-webapp/src/App.tsx` | Replace placeholder with `<ChatLayout />` |

---

## 12. Acceptance Criteria

### Backend
- [ ] `GET /api/conversations` returns `ConversationListResponse` with all existing conversations, ordered by `updatedAt DESC`
- [ ] `POST /api/conversations` creates a conversation in CosmosDB and returns `ConversationSummary` with `201`
- [ ] `GET /api/conversations/{id}` returns `ConversationDetailResponse` with correct messages in order (`createdAt ASC`)
- [ ] `POST /api/conversations/{id}/messages` stores both user and assistant messages; assistant message includes `sources`
- [ ] Hybrid search returns chunks ranked by combined keyword + vector score (RRF)
- [ ] Gemini receives: system prompt with injected PDF chunks + conversation history + new user message
- [ ] `DELETE /api/conversations/{id}` removes the conversation AND all its messages from CosmosDB
- [ ] All endpoints return Pydantic-validated JSON; all field names are camelCase in responses
- [ ] `404` returned when conversation ID does not exist
- [ ] `400` returned for empty message content or empty conversation title

### Frontend
- [ ] Conversation list loads automatically on app startup
- [ ] Clicking a conversation loads and displays its full message history
- [ ] Sending a message appends an optimistic user bubble and a loading indicator
- [ ] After response arrives, assistant bubble renders with sources visible on expand
- [ ] "New Chat" creates a new conversation and selects it
- [ ] Deleting a conversation removes it from the sidebar and deselects it if active
- [ ] Chat input is disabled (spinning) while a message is in-flight
- [ ] UI is responsive and scrolls to the latest message automatically

---

## 13. Dependencies / Pre-requisites

| Dependency | Status | Notes |
|---|---|---|
| Phase 2 endpoints working (PDF upload, chunking, embedding) | Required | Hybrid search relies on `knowledge` container having embedded chunks |
| CosmosDB full-text search preview enabled | Required | Contact Azure support or enable via portal for the account |
| `google-generativeai` SDK ≥ 0.8 | Required | Supports `start_chat(history=...)` API |
| `GOOGLE_API_KEY` set in environment | Required | Already in `local.settings.json` (fill in actual value) |
| CosmosDB `knowledge` container vector index (768 dims) | Required | Provisioned in Phase 2; verify before running hybrid search |
