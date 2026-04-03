from __future__ import annotations

import azure.functions as func

from models.document import DocumentListResponse, DocumentResponse
from services.cosmos_service import CosmosService

bp = func.Blueprint()


@bp.route(route="documents", methods=["GET"], auth_level=func.AuthLevel.FUNCTION)
def list_documents(req: func.HttpRequest) -> func.HttpResponse:
    cosmos_svc = CosmosService()
    items = cosmos_svc.query_documents(
        query="SELECT * FROM c WHERE c.type = 'document' ORDER BY c.uploadedAt DESC",
    )

    documents = [
        DocumentResponse(
            id=item["id"],
            filename=item["filename"],
            fileSize=item["fileSize"],
            status=item["status"],
            chunkCount=item.get("chunkCount", 0),
            uploadedAt=item["uploadedAt"],
            updatedAt=item["updatedAt"],
        )
        for item in items
    ]

    response = DocumentListResponse(documents=documents, total=len(documents))
    return func.HttpResponse(
        response.model_dump_json(),
        status_code=200,
        mimetype="application/json",
    )
