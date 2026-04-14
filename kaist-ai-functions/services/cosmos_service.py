"""Azure Cosmos DB wrapper for document metadata and chunk storage.

CosmosDB container schema
-------------------------
Container : knowledge
Partition key : /documentId

Item types
~~~~~~~~~~
Metadata item  (type == "metadata"):
    id          : str  — same as documentId
    documentId  : str  — partition key
    type        : "metadata"
    filename    : str
    blobName    : str
    chunkCount  : int
    uploadedAt  : str  — ISO 8601

Chunk item  (type == "chunk"):
    id          : str  — unique UUID per chunk
    documentId  : str  — partition key (links to metadata)
    type        : "chunk"
    content     : str  — chunk text
    chunkIndex  : int  — 0-based position
    embedding   : list[float]  — 768-dimensional vector
"""
from __future__ import annotations

import os
from typing import Any, Optional

from azure.cosmos import CosmosClient, PartitionKey, exceptions

_client: Optional[CosmosClient] = None
_container = None


def _get_container():
    """Return a lazily-initialized CosmosDB container client singleton."""
    global _client, _container
    if _container is None:
        endpoint = os.environ["AZURE_COSMOS_ENDPOINT"]
        key = os.environ["AZURE_COSMOS_KEY"]
        database_name = os.environ.get("AZURE_COSMOS_DATABASE_NAME", "kaistdb")
        container_name = os.environ.get("AZURE_COSMOS_CONTAINER_NAME", "knowledge")
        _client = CosmosClient(endpoint, credential=key)
        database = _client.get_database_client(database_name)
        _container = database.get_container_client(container_name)
    return _container


# ---------------------------------------------------------------------------
# Write operations
# ---------------------------------------------------------------------------

def create_metadata_item(item: dict[str, Any]) -> dict[str, Any]:
    """Upsert a metadata item and return the created document.

    Args:
        item: Dictionary containing all metadata fields.

    Returns:
        The item as returned by CosmosDB (includes system fields).
    """
    container = _get_container()
    return container.upsert_item(item)


def create_chunk_item(item: dict[str, Any]) -> dict[str, Any]:
    """Upsert a chunk item and return the created document.

    Args:
        item: Dictionary containing all chunk fields including embedding.

    Returns:
        The item as returned by CosmosDB.
    """
    container = _get_container()
    return container.upsert_item(item)


def upsert_item(item: dict[str, Any]) -> dict[str, Any]:
    """Upsert any item type and return stored document."""
    container = _get_container()
    return container.upsert_item(item)


# ---------------------------------------------------------------------------
# Read operations
# ---------------------------------------------------------------------------

def list_documents() -> list[dict[str, Any]]:
    """Return all metadata items (type == "metadata") across all partitions.

    Returns:
        List of metadata item dictionaries, sorted by uploadedAt descending.
    """
    container = _get_container()
    query = "SELECT * FROM c WHERE c.type = 'metadata' ORDER BY c.uploadedAt DESC"
    items = list(
        container.query_items(query=query, enable_cross_partition_query=True)
    )
    return items


def get_document(document_id: str) -> Optional[dict[str, Any]]:
    """Return the metadata item for a given documentId, or None if not found.

    Args:
        document_id: The documentId (also used as the item id for metadata).

    Returns:
        Metadata dict or None.
    """
    container = _get_container()
    try:
        # The metadata item id == documentId and partition key == documentId
        item = container.read_item(item=document_id, partition_key=document_id)
        return item
    except exceptions.CosmosResourceNotFoundError:
        return None


def update_document(document_id: str, updates: dict[str, Any]) -> dict[str, Any]:
    """Partially update a metadata item and return the updated document.

    Reads the current item, merges `updates`, then replaces the item.

    Args:
        document_id: The documentId.
        updates: Fields to update (e.g. {"filename": "new_name.pdf"}).

    Returns:
        Updated item dictionary.

    Raises:
        exceptions.CosmosResourceNotFoundError: If the document does not exist.
    """
    container = _get_container()
    item = container.read_item(item=document_id, partition_key=document_id)
    item.update(updates)
    return container.replace_item(item=document_id, body=item)


def delete_document_items(document_id: str) -> int:
    """Delete the metadata item and all chunk items for a document.

    Args:
        document_id: The documentId whose items should be deleted.

    Returns:
        Total number of items deleted.
    """
    container = _get_container()
    query = "SELECT c.id FROM c WHERE c.documentId = @documentId"
    params: list[dict[str, Any]] = [{"name": "@documentId", "value": document_id}]
    items = list(
        container.query_items(
            query=query,
            parameters=params,
            partition_key=document_id,
        )
    )
    deleted = 0
    for item in items:
        container.delete_item(item=item["id"], partition_key=document_id)
        deleted += 1
    return deleted
