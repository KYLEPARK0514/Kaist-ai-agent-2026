import azure.functions as func
import logging

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

@app.route(route="documents", methods=["POST"])
def upload_document(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Processing POST /api/documents request.')
    return func.HttpResponse("Upload and process a PDF dummy response", status_code=200)

@app.route(route="documents", methods=["GET"])
def list_documents(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Processing GET /api/documents request.')
    return func.HttpResponse("List uploaded documents dummy response", status_code=200)

@app.route(route="documents/{id}", methods=["DELETE"])
def delete_document(req: func.HttpRequest) -> func.HttpResponse:
    doc_id = req.route_params.get('id')
    logging.info(f'Processing DELETE /api/documents/{doc_id} request.')
    return func.HttpResponse(f"Delete document {doc_id} dummy response", status_code=200)

@app.route(route="chat", methods=["POST"])
def chat(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Processing POST /api/chat request.')
    return func.HttpResponse("Submit a question, receive an answer dummy response", status_code=200)

@app.route(route="health", methods=["GET"])
def health(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Processing GET /api/health request.')
    return func.HttpResponse(
        "OK",
        status_code=200,
        mimetype="text/plain"
    )
