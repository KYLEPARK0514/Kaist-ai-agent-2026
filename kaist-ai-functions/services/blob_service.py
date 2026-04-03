"""Azure Blob Storage wrapper for PDF management."""
from __future__ import annotations

import os
from typing import Optional

from azure.core.exceptions import ResourceNotFoundError
from azure.storage.blob import BlobServiceClient, ContentSettings

_client: Optional[BlobServiceClient] = None


def _get_client() -> BlobServiceClient:
    """Return a lazily-initialized BlobServiceClient singleton."""
    global _client
    if _client is None:
        connection_string = os.environ["AZURE_STORAGE_CONNECTION_STRING"]
        _client = BlobServiceClient.from_connection_string(connection_string)
    return _client


def _container_name() -> str:
    return os.environ.get("AZURE_STORAGE_CONTAINER_NAME", "pdfs")


def upload_blob(blob_name: str, data: bytes, content_type: str = "application/pdf") -> str:
    """Upload bytes to Blob Storage and return the blob name.

    Args:
        blob_name: The object name to use inside the container.
        data: Raw file bytes.
        content_type: MIME type of the uploaded file.

    Returns:
        The blob_name that was written.
    """
    client = _get_client()
    container_client = client.get_container_client(_container_name())
    blob_client = container_client.get_blob_client(blob_name)
    blob_client.upload_blob(
        data,
        overwrite=True,
        content_settings=ContentSettings(content_type=content_type),
    )
    return blob_name


def delete_blob(blob_name: str) -> None:
    """Delete a blob from storage.

    Silently ignores 404 errors (blob already absent).

    Args:
        blob_name: The object name to delete.
    """
    client = _get_client()
    container_client = client.get_container_client(_container_name())
    blob_client = container_client.get_blob_client(blob_name)
    try:
        blob_client.delete_blob()
    except ResourceNotFoundError:
        pass


def get_blob_url(blob_name: str) -> str:
    """Return the public URL for a blob (no SAS token).

    Note: The container must have public read access, or callers should
    generate a SAS URL separately for secure access.

    Args:
        blob_name: The object name.

    Returns:
        Full https URL to the blob.
    """
    client = _get_client()
    container_client = client.get_container_client(_container_name())
    blob_client = container_client.get_blob_client(blob_name)
    return blob_client.url
