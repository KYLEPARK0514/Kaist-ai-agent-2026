from __future__ import annotations

import json

import azure.functions as func
from azure.cosmos import exceptions

from models.document import GetDocumentResponse
from services.cosmos_service import CosmosService

bp = func.Blueprint()


@bp.route(route="documents/{id}", methods=["GET"], auth_level=func.AuthLevel.FUNCTION)
def get_document(req: func.HttpRequest) -> func.HttpResponse:
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

    response = GetDocumentResponse(
        id=item["id"],
        filename=item["filename"],
        fileSize=item["fileSize"],
        status=item["status"],
        chunkCount=item.get("chunkCount", 0),
        uploadedAt=item["uploadedAt"],
        updatedAt=item["updatedAt"],
        blobName=item["blobName"],
    )
    return func.HttpResponse(
        response.model_dump_json(),
        status_code=200,
        mimetype="application/json",
    )
