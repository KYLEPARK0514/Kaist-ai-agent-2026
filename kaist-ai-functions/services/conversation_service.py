"""CosmosDB service for conversations and messages containers.

Provides CRUD operations against the 'conversations' and 'messages' containers.
Each method lazily initialises its container client on first use.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Optional

from azure.cosmos import CosmosClient, exceptions

from models.conversation import ConversationRecord, MessageRecord, MessageSource

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lazy singleton clients
# ---------------------------------------------------------------------------

_cosmos_client: Optional[CosmosClient] = None
_conversations_container = None
_messages_container = None


def _get_client() -> CosmosClient:
    global _cosmos_client
    if _cosmos_client is None:
        _cosmos_client = CosmosClient(
            os.environ["AZURE_COSMOS_ENDPOINT"],
            credential=os.environ["AZURE_COSMOS_KEY"],
        )
    return _cosmos_client


def _get_conversations_container():
    global _conversations_container
    if _conversations_container is None:
        database_name = os.environ.get("AZURE_COSMOS_DATABASE_NAME", "kaistdb")
        container_name = os.environ.get(
            "AZURE_COSMOS_CONVERSATIONS_CONTAINER_NAME", "conversations"
        )
        db = _get_client().get_database_client(database_name)
        _conversations_container = db.get_container_client(container_name)
    return _conversations_container


def _get_messages_container():
    global _messages_container
    if _messages_container is None:
        database_name = os.environ.get("AZURE_COSMOS_DATABASE_NAME", "kaistdb")
        container_name = os.environ.get(
            "AZURE_COSMOS_MESSAGES_CONTAINER_NAME", "messages"
        )
        db = _get_client().get_database_client(database_name)
        _messages_container = db.get_container_client(container_name)
    return _messages_container


# ---------------------------------------------------------------------------
# Conversations — CRUD
# ---------------------------------------------------------------------------

def list_conversations() -> list[ConversationRecord]:
    """Return all conversations ordered by updatedAt DESC."""
    container = _get_conversations_container()
    query = (
        "SELECT * FROM c ORDER BY c.updatedAt DESC OFFSET 0 LIMIT 100"
    )
    items = list(
        container.query_items(query=query, enable_cross_partition_query=True)
    )
    return [ConversationRecord.model_validate(item) for item in items]


def create_conversation(title: str) -> ConversationRecord:
    """Create and persist a new conversation, returning the stored record."""
    record = ConversationRecord(title=title)
    container = _get_conversations_container()
    container.upsert_item(record.to_cosmos_dict())
    logger.info("Created conversation %s: %s", record.id, title)
    return record


def get_conversation(conversation_id: str) -> Optional[ConversationRecord]:
    """Return conversation by id, or None if not found."""
    container = _get_conversations_container()
    try:
        item = container.read_item(
            item=conversation_id, partition_key=conversation_id
        )
        return ConversationRecord.model_validate(item)
    except exceptions.CosmosResourceNotFoundError:
        return None


def delete_conversation(conversation_id: str) -> None:
    """Delete a conversation and all of its messages."""
    # Delete all messages first (same partition: conversationId)
    msgs_container = _get_messages_container()
    query = (
        "SELECT c.id, c.conversationId FROM c "
        "WHERE c.conversationId = @conversationId"
    )
    params = [{"name": "@conversationId", "value": conversation_id}]
    message_stubs = list(
        msgs_container.query_items(
            query=query,
            parameters=params,
            partition_key=conversation_id,
        )
    )
    for stub in message_stubs:
        try:
            msgs_container.delete_item(
                item=stub["id"], partition_key=conversation_id
            )
        except exceptions.CosmosResourceNotFoundError:
            pass  # already gone — harmless

    # Delete the conversation itself
    conv_container = _get_conversations_container()
    conv_container.delete_item(
        item=conversation_id, partition_key=conversation_id
    )
    logger.info(
        "Deleted conversation %s and %d messages",
        conversation_id,
        len(message_stubs),
    )


def increment_message_count(conversation_id: str) -> None:
    """Increment messageCount and refresh updatedAt on a conversation."""
    container = _get_conversations_container()
    try:
        item = container.read_item(
            item=conversation_id, partition_key=conversation_id
        )
        item["messageCount"] = item.get("messageCount", 0) + 1
        item["updatedAt"] = datetime.now(timezone.utc).isoformat()
        container.upsert_item(item)
    except exceptions.CosmosResourceNotFoundError:
        logger.warning(
            "increment_message_count: conversation %s not found", conversation_id
        )


# ---------------------------------------------------------------------------
# Messages — CRUD
# ---------------------------------------------------------------------------

def add_message(record: MessageRecord) -> MessageRecord:
    """Persist a message record and return it."""
    container = _get_messages_container()
    container.upsert_item(record.to_cosmos_dict())
    return record


def get_messages(conversation_id: str, limit: int = 1000) -> list[MessageRecord]:
    """Return messages for a conversation ordered by createdAt ASC.

    Args:
        conversation_id: The conversation whose messages to fetch.
        limit: Maximum number of messages to return (default 1000 = "all").
    """
    container = _get_messages_container()
    query = (
        f"SELECT * FROM c WHERE c.conversationId = @conversationId "
        f"ORDER BY c.createdAt ASC OFFSET 0 LIMIT {int(limit)}"
    )
    params = [{"name": "@conversationId", "value": conversation_id}]
    items = list(
        container.query_items(
            query=query,
            parameters=params,
            partition_key=conversation_id,
        )
    )
    records: list[MessageRecord] = []
    for item in items:
        # Reconstruct MessageSource objects from raw dicts
        sources_raw = item.get("sources", [])
        sources = [MessageSource.model_validate(s) for s in sources_raw]
        item["sources"] = [s.model_dump(by_alias=True) for s in sources]
        records.append(MessageRecord.model_validate(item))
    return records
