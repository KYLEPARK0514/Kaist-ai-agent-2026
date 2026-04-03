from __future__ import annotations

import os
from typing import Any

from azure.cosmos import CosmosClient, PartitionKey, exceptions


class CosmosService:
    def __init__(self) -> None:
        endpoint = os.environ["AZURE_COSMOS_ENDPOINT"]
        key = os.environ["AZURE_COSMOS_KEY"]
        database_name = os.environ.get("AZURE_COSMOS_DATABASE_NAME", "kaistdb")
        container_name = os.environ.get("AZURE_COSMOS_CONTAINER_NAME", "knowledge")

        client = CosmosClient(url=endpoint, credential=key)
        database = client.get_database_client(database_name)
        self._container = database.get_container_client(container_name)

    def upsert_item(self, item: dict[str, Any]) -> dict[str, Any]:
        """Create or replace an item in the container."""
        return self._container.upsert_item(body=item)

    def get_item(self, item_id: str, partition_key: str) -> dict[str, Any]:
        """Read a single item by id and partition key."""
        return self._container.read_item(item=item_id, partition_key=partition_key)

    def query_documents(self, query: str, parameters: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
        """Execute a SQL query and return all matching items."""
        items = self._container.query_items(
            query=query,
            parameters=parameters or [],
            enable_cross_partition_query=True,
        )
        return list(items)

    def delete_items_by_document(self, document_id: str) -> None:
        """Delete every item (document record + all chunks) for the given documentId."""
        items = self.query_documents(
            query="SELECT c.id, c.documentId FROM c WHERE c.documentId = @documentId",
            parameters=[{"name": "@documentId", "value": document_id}],
        )
        for item in items:
            try:
                self._container.delete_item(item=item["id"], partition_key=item["documentId"])
            except exceptions.CosmosResourceNotFoundError:
                pass
