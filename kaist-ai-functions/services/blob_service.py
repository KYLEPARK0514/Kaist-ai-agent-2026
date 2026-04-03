from __future__ import annotations

import os

from azure.storage.blob import BlobServiceClient, ContentSettings


class BlobStorageService:
    def __init__(self) -> None:
        connection_string = os.environ["AZURE_STORAGE_CONNECTION_STRING"]
        self._container_name: str = os.environ["AZURE_STORAGE_CONTAINER_NAME"]
        self._client = BlobServiceClient.from_connection_string(connection_string)
        self._container_client = self._client.get_container_client(self._container_name)

    def upload_blob(self, blob_name: str, data: bytes, content_type: str = "application/pdf") -> str:
        """Upload bytes to Blob Storage and return the blob URL."""
        blob_client = self._container_client.get_blob_client(blob_name)
        blob_client.upload_blob(
            data,
            overwrite=True,
            content_settings=ContentSettings(content_type=content_type),
        )
        return blob_client.url

    def delete_blob(self, blob_name: str) -> None:
        """Delete a blob by name. No-op if it does not exist."""
        blob_client = self._container_client.get_blob_client(blob_name)
        blob_client.delete_blob(delete_snapshots="include")

    def get_blob_url(self, blob_name: str) -> str:
        """Return the public URL for a blob (no SAS token)."""
        blob_client = self._container_client.get_blob_client(blob_name)
        return blob_client.url
