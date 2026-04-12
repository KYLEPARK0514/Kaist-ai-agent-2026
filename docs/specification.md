# KAIST AI Agent Specification

## Overview

This project builds an AI chatbot agent that lets users upload PDF files to create a knowledge base. The system answers user questions by querying that knowledge base. The chatbot agent is deployed on Microsoft Azure and integrates Google Gemini via `langchain-google-genai`.

---

## System Architecture

The system consists of three main components:

1. **Client** — React + Vite + TypeScript web application for PDF management and chat interaction.
2. **API Server** — Azure Functions (Python 3.11) handling PDF processing, knowledge base management, and chatbot responses.
3. **Infrastructure** — Azure resources for storage, database, and deployment, provisioned via Bicep.

### Data Flow

1. User uploads a PDF via the web client.
2. The API server validates the file and uploads it to Azure Blob Storage (`pdfs` container).
3. The API server extracts text from the PDF using `pypdf`, splits it into overlapping chunks, and generates embedding vectors via Google Gemini `text-embedding-004`.
4. Each chunk (content + embedding) and the document metadata record are stored in Azure Cosmos DB (`knowledge` container).
5. User asks questions through the chat interface.
6. The API server performs hybrid search (full-text + vector) over the knowledge base and synthesises a response using Google Gemini.

---

## Infrastructure

- **Cloud Provider**: Microsoft Azure
- **Region**: koreacentral
- **Deployment Tool**: Azure Developer CLI (`azd`)
- **Infrastructure as Code**: Bicep templates (`kaist-ai-infra/`)
- **Resource Group**: `kaist-ai-agent-rg`

### Resources

| Resource | Purpose |
|---|---|
| Azure Cosmos DB (Serverless) | Stores knowledge base chunks, embeddings, and document metadata |
| Azure Blob Storage (`pdfs` container) | Stores uploaded PDF files |
| Azure Functions (Python 3.11) | Hosts the API server |
| Azure Static Web Apps | Hosts the React client |
| Azure Key Vault | Stores secrets (Cosmos DB key, Storage key, Google API key) |
| Log Analytics + Application Insights | Monitoring and diagnostics |

---

## CosmosDB Schema

**Database**: `kaistdb`  
**Container**: `knowledge`  
**Partition key**: `/documentId`  
**Indexing**: All paths included; `/embedding/*` excluded from regular index; full-text index on `/content`  
**Vector policy**: `path=/embedding`, `dataType=float32`, `dimensions=768`, `distanceFunction=cosine`

### Item Types

All items in the `knowledge` container carry a `type` discriminator field.

#### Document Metadata Item (`type = "document"`)

One item per uploaded PDF.

```json
{
  "id": "doc_<uuid>",
  "documentId": "doc_<uuid>",
  "type": "document",
  "filename": "lecture-notes.pdf",
  "blobName": "doc_<uuid>/lecture-notes.pdf",
  "fileSize": 204800,
  "status": "processed",
  "chunkCount": 18,
  "uploadedAt": "2026-04-01T12:00:00Z",
  "updatedAt": "2026-04-01T12:00:00Z"
}
```

| Field | Type | Description |
|---|---|---|
| `id` | string | Same as `documentId` |
| `documentId` | string | Partition key |
| `type` | string | Always `"document"` |
| `filename` | string | Original (or renamed) filename |
| `blobName` | string | Blob Storage object key: `{documentId}/{filename}` |
| `fileSize` | int | Size in bytes |
| `status` | string | `processing` / `processed` / `failed` |
| `chunkCount` | int | Number of text chunks stored |
| `uploadedAt` | string | ISO 8601 timestamp |
| `updatedAt` | string | ISO 8601 timestamp |

#### Chunk Item (`type = "chunk"`)

One item per text chunk extracted from the PDF.

```json
{
  "id": "doc_<uuid>_chunk_0",
  "documentId": "doc_<uuid>",
  "type": "chunk",
  "chunkIndex": 0,
  "content": "The first 1000 characters of extracted text...",
  "embedding": [0.001, -0.042, "...768 values total..."]
}
```

| Field | Type | Description |
|---|---|---|
| `id` | string | `{documentId}_chunk_{index}` |
| `documentId` | string | Partition key — links to parent document |
| `type` | string | Always `"chunk"` |
| `chunkIndex` | int | Zero-based position within the document |
| `content` | string | Extracted text (≈1 000 chars with 200-char overlap) |
| `embedding` | float32[] | 768-dimensional Gemini embedding vector |

---

## API Server

- **Runtime**: Python 3.11
- **Deployment**: Azure Functions
- **Programming model**: Azure Functions Python v2 (decorator-based)
- **Structure**: Each endpoint is an independent file in `blueprints/`; blueprints are registered in `function_app.py`

### Endpoints

#### Document Management (Knowledge Base)

| Method | Path | Description | Auth |
|---|---|---|---|
| `POST` | `/api/documents` | Upload PDF, extract text, embed chunks, store in CosmosDB & Blob | Function key |
| `GET` | `/api/documents` | List all uploaded documents (metadata only) | Function key |
| `GET` | `/api/documents/{id}` | Get metadata for a single document | Function key |
| `PATCH` | `/api/documents/{id}` | Update document metadata (filename) | Function key |
| `DELETE` | `/api/documents/{id}` | Delete document from Blob Storage and all CosmosDB items | Function key |

#### Chat

| Method | Path | Description | Auth |
|---|---|---|---|
| `POST` | `/api/chat` | Submit a question; receive an answer using Gemini + hybrid search | Function key |
| `GET` | `/api/health` | Health check | Anonymous |

#### Request & Response Models

All request and response models are declared using **Pydantic v2** (`pydantic.BaseModel`) in `kaist-ai-functions/models/document.py`.

**POST /api/documents**
- Request: `multipart/form-data` with a `file` field (PDF, max 50 MB)
- Response 201: `UploadDocumentResponse { id, filename, status, message }`
- Response 400: validation error (not a PDF, or missing file)
- Response 413: file too large

**GET /api/documents**
- Response 200: `DocumentListResponse { documents: DocumentResponse[], total: int }`

**GET /api/documents/{id}**
- Response 200: `GetDocumentResponse { id, filename, fileSize, status, chunkCount, uploadedAt, updatedAt, blobName }`
- Response 404: not found

**PATCH /api/documents/{id}**
- Request body: `UpdateDocumentRequest { filename: str }`
- Response 200: `DocumentResponse`
- Response 404: not found

**DELETE /api/documents/{id}**
- Response 204: no content
- Response 404: not found

### Key Technologies

- PDF processing: `pypdf`
- Embedding: `langchain-google-genai` (`GoogleGenerativeAIEmbeddings`, model `text-embedding-004`, 768 dims)
- LLM: `langchain-google-genai` (`ChatGoogleGenerativeAI`)
- Database: `azure-cosmos` SDK
- Storage: `azure-storage-blob` SDK
- Validation: `pydantic` v2

---

## Client

- **Framework**: React 18 + Vite + TypeScript
- **Styling**: Tailwind CSS
- **Deployment**: Azure Static Web Apps
- **API communication**: `fetch` (native browser API)
- **Validation**: `zod`

### Features

- **Document Manager** — sidebar panel showing the list of uploaded documents; each row shows filename, upload date, status badge, and chunk count; supports inline rename and delete with confirmation dialog.
- **PDF Upload** — drag-and-drop or click to select PDF; upload progress bar; triggers document list refresh on success.
- **Chat Interface** — text input + message history; submits questions to `/api/chat`; displays AI-generated answers.
- Responsive layout (single-column on mobile, 2-column on desktop).

### File Structure (Source)

```
kaist-ai-webapp/src/
├── api/
│   └── documents.ts          # Typed fetch API client (CRUD)
├── types/
│   └── document.ts           # TypeScript types mirroring Pydantic models
├── components/
│   ├── DocumentManager.tsx   # Document list + upload orchestration
│   ├── DocumentListItem.tsx  # Single document row (rename/delete actions)
│   ├── PdfUpload.tsx         # File drop zone with progress bar
│   └── ChatInterface.tsx     # Chat UI
├── App.tsx
├── main.tsx
└── index.css
```

---

## Deployment

- Use `azd up` to provision infrastructure and deploy both services.
- `azure.yaml` declares two services: `api` (Python Functions) and `web` (Static Web App).
- All secrets are stored in Azure Key Vault and injected as Key Vault references into the Function App settings.

---

## Security Considerations

- File upload validates `Content-Type: application/pdf` and enforces 50 MB maximum server-side.
- All secrets (`GOOGLE_API_KEY`, Cosmos DB key, Storage key) are stored in Key Vault — never hardcoded.
- Function endpoints use Function-level auth keys.
- Data is encrypted at rest (Azure default) and in transit (HTTPS).

---

## Future Enhancements

- OCR support for scanned (image-only) PDFs.
- User authentication and per-user document isolation.
- Advanced chunking with semantic boundary detection (LangChain `RecursiveCharacterTextSplitter`).
- Analytics dashboard and usage monitoring.
- Support for additional file types (DOCX, PPTX).
- Streaming chat responses.
