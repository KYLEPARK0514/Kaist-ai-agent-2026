# KAIST AI Agent - API Functions

This directory contains the Phase 2 Azure Functions API for the KAIST AI Agent.
It is built using Python 3.11 and the Azure Functions v2 programming model.

## Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/documents` | Upload and process a PDF |
| `GET` | `/api/documents` | List uploaded documents |
| `DELETE` | `/api/documents/{id}` | Delete a document and its embeddings |
| `POST` | `/api/chat` | Submit a question, receive an answer |
| `GET` | `/api/health` | Health check |

## Local Development

1. Create a Python virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the functions locally using Azure Functions Core Tools:
   ```bash
   func start
   ```
