from __future__ import annotations

import json
from datetime import datetime, timezone

import azure.functions as func
from azure.cosmos import exceptions

from models.document import DocumentResponse, UpdateDocumentRequest
from services.cosmos_service import CosmosService

bp = func.Blueprint()


@bp.route(route="documents/{id}", methods=["PATCH"], auth_level=func.AuthLevel.FUNCTION)
def update_document(req: func.HttpRequest) -> func.HttpResponse:
    document_id = req.route_params.get("id")

    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse(
            json.dumps({"error": "Invalid JSON body"}),
            status_code=400,
            mimetype="application/json",
        )

    try:
        update_req = UpdateDocumentRequest(**body)
    except Exception as exc:  # noqa: BLE001
        return func.HttpResponse(
            json.dumps({"error": str(exc)}),
            status_code=400,
            mimetype="application/json",
        )

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

    item["filename"] = update_req.filename
    item["updatedAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    cosmos_svc.upsert_item(item)

    response = DocumentResponse(
        id=item["id"],
        filename=item["filename"],
        fileSize=item["fileSize"],
        status=item["status"],
        chunkCount=item.get("chunkCount", 0),
        uploadedAt=item["uploadedAt"],
        updatedAt=item["updatedAt"],
    )
    return func.HttpResponse(
        response.model_dump_json(),
        status_code=200,
        mimetype="application/json",
    )
