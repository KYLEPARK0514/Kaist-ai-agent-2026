"""Pydantic v2 models for the conversation management API.

These models define:
  - CosmosDB record shapes (ConversationRecord, MessageRecord)
  - API request bodies (CreateConversationRequest, SendMessageRequest)
  - API response shapes (ConversationListResponse, ConversationDetailResponse,
    SendMessageResponse, ConversationSummary, MessageItem)
"""
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
