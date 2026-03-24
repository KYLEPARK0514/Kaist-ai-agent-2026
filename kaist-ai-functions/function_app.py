import logging
import azure.functions as func
import os
import json
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings

app = func.FunctionApp(http_auth_level=func.AuthLevel.FUNCTION)

@app.route(route="health", methods=["GET"])
def health_check(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Health check endpoint called.')
    return func.HttpResponse(
        "API Backend Phase 2 is healthy.",
        status_code=200
    )

@app.route(route="chat", methods=["POST"])
def chat(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Chat endpoint called.')
    try:
        req_body = req.get_json()
        question = req_body.get('question')
        
        if not question:
            return func.HttpResponse(
                "Please pass a question in the request body",
                status_code=400
            )

        # Initialize the model (requires GOOGLE_API_KEY env variable)
        api_key = os.environ.get("GOOGLE_API_KEY", "")
        if not api_key:
            return func.HttpResponse("Missing GOOGLE_API_KEY", status_code=500)

        llm = ChatGoogleGenerativeAI(model="gemini-3-pro", google_api_key=api_key)
        response = llm.invoke(question)

        return func.HttpResponse(
            json.dumps({"answer": response.content}),
            mimetype="application/json",
            status_code=200
        )
    except Exception as e:
        logging.error(f'Error processing chat: {e}')
        return func.HttpResponse(
            f"Error processing chat: {e}",
            status_code=500
        )

@app.route(route="documents", methods=["POST"])
def upload_document(req: func.HttpRequest) -> func.HttpResponse:
    # TODO: Implement PDF upload and processing
    return func.HttpResponse("Upload logic pending", status_code=201)

@app.route(route="documents", methods=["GET"])
def list_documents(req: func.HttpRequest) -> func.HttpResponse:
    # TODO: Implement listing of uploaded documents
    return func.HttpResponse(json.dumps([]), mimetype="application/json")

@app.route(route="documents/{id}", methods=["DELETE"])
def delete_document(req: func.HttpRequest) -> func.HttpResponse:
    # TODO: Implement document deletion
    doc_id = req.route_params.get('id')
    return func.HttpResponse(f"Document {doc_id} deleted", status_code=200)

