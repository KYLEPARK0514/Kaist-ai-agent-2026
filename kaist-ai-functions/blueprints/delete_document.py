from __future__ import annotations

import json

import azure.functions as func
from azure.cosmos import exceptions

from services.blob_service import BlobStorageService
from services.cosmos_service import CosmosService

bp = func.Blueprint()


@bp.route(route="documents/{id}", methods=["DELETE"], auth_level=func.AuthLevel.FUNCTION)
def delete_document(req: func.HttpRequest) -> func.HttpResponse:
    document_id = req.route_params.get("id")

    cosmos_svc = CosmosService()
    try:
        item = cosmos_svc.get_item(item_id=document_id, partition_key=document_id)
    except exceptions.CosmosResourceNotFoundError:
        return func.HttpResponse(
            json.dumps({"error": f"Document '{document_id}' not found"}),
            status_code=404,
            mimetype="application/json",
        )

    if item.get("type") != "document":
        return func.HttpResponse(
            json.dumps({"error": f"Document '{document_id}' not found"}),
            status_code=404,
            mimetype="application/json",
        )

    blob_name: str = item["blobName"]

    # Delete blob from Blob Storage
    blob_svc = BlobStorageService()
    blob_svc.delete_blob(blob_name)

    # Delete all CosmosDB items for this document (metadata + all chunks)
    cosmos_svc.delete_items_by_document(document_id)

    return func.HttpResponse(status_code=204)
