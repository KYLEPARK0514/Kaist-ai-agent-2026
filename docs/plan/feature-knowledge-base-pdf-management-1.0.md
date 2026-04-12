---
goal: PDF Knowledge Base Management — Full CRUD API & Web UI
version: 1.0
date_created: 2026-04-01
owner: Team
status: 'Planned'
tags: [`feature`, `backend`, `frontend`, `knowledge-base`, `pdf`, `cosmosdb`, `blob-storage`]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan implements full CRUD management for PDF documents that form the AI knowledge base. Users can upload a PDF via the web UI; the backend stores the file in Azure Blob Storage, extracts and chunks the text, generates Gemini embeddings, and persists both document metadata and chunks in the existing Cosmos DB `knowledge` container for hybrid (full-text + semantic) search. A document list view, detail view, inline rename, and delete UI are added to the React web app.

---

## 1. Requirements & Constraints

- **REQ-001**: Every PDF upload must be streamed to Azure Blob Storage and stored under the key `{documentId}/{original_filename}`.
- **REQ-002**: Text must be extracted from the PDF using `pypdf`, split into overlapping chunks (chunk size 1 000 chars, overlap 200 chars), and each chunk stored as a Cosmos DB item with its embedding vector.
- **REQ-003**: Embedding vectors must be generated using Google Gemini `models/text-embedding-004` (768 dimensions) via `langchain-google-genai`.
- **REQ-004**: Each API operation must have its own Python file inside `kaist-ai-functions/blueprints/`.
- **REQ-005**: All request and response models must be declared with Pydantic v2 (`pydantic.BaseModel`).
- **REQ-006**: The 5 HTTP endpoints required are: `POST /api/documents`, `GET /api/documents`, `GET /api/documents/{id}`, `PATCH /api/documents/{id}`, `DELETE /api/documents/{id}`.
- **REQ-007**: Delete must remove both the Blob Storage object and all Cosmos DB items (metadata + chunks) belonging to the document.
- **REQ-008**: The web app must provide a document management panel: list, upload (with progress), rename, and delete with confirmation.
- **SEC-001**: `GOOGLE_API_KEY`, `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_COSMOS_ENDPOINT`, `AZURE_COSMOS_KEY` must be injected via environment variables / Key Vault references — never hardcoded.
- **SEC-002**: File upload must validate `Content-Type: application/pdf` and enforce a maximum file size of 50 MB server-side.
- **CON-001**: The existing Cosmos DB container `knowledge` (partition key `/documentId`) must be reused. A new `documents` container must NOT be created.
- **CON-002**: The existing Azure Blob Storage container `pdfs` must be reused.
- **CON-003**: The Cosmos DB vector dimension in `cosmos.bicep` must be updated from 1 536 → 768 to match Gemini `text-embedding-004` output.
- **PAT-001**: Use the Azure Functions Python v2 programming model (`Blueprint` class) for each endpoint file; register all blueprints in `function_app.py`.

---

## 2. Implementation Steps

### Implementation Phase 1: Infrastructure — CosmosDB Vector Dimension Fix

- GOAL-001: Update `kaist-ai-infra/modules/cosmos.bicep` so the vector embedding policy reflects the 768-dimensional output of Gemini `text-embedding-004`.

| Task     | Description                                                                                                              | Completed | Date |
| -------- | ------------------------------------------------------------------------------------------------------------------------ | --------- | ---- |
| TASK-001 | In `kaist-ai-infra/modules/cosmos.bicep`, change `dimensions: 1536` → `dimensions: 768` in the `vectorEmbeddingPolicy`. |           |      |
| TASK-002 | Run `bicep build kaist-ai-infra/main.bicep` and confirm zero errors/warnings.                                            |           |      |
| TASK-003 | Re-provision with `azd provision` (or manual ARM update) so the existing container reflects the new policy.              |           |      |

### Implementation Phase 2: Backend — Shared Models & Services

- GOAL-002: Create the Pydantic data models and reusable service classes that all blueprint functions will import.

| Task     | Description                                                                                                                                                                                                                                                                                                                                            | Completed | Date |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---- |
| TASK-004 | Create `kaist-ai-functions/models/__init__.py` (empty).                                                                                                                                                                                                                                                                                                |           |      |
| TASK-005 | Create `kaist-ai-functions/models/document.py` with the following Pydantic models: `DocumentStatus` (Enum: `processing`, `processed`, `failed`), `DocumentRecord` (CosmosDB metadata item), `ChunkRecord` (CosmosDB chunk item), `UploadDocumentResponse`, `DocumentResponse`, `DocumentListResponse`, `GetDocumentResponse`, `UpdateDocumentRequest`. |           |      |
| TASK-006 | Create `kaist-ai-functions/services/__init__.py` (empty).                                                                                                                                                                                                                                                                                              |           |      |
| TASK-007 | Create `kaist-ai-functions/services/blob_service.py` with class `BlobStorageService`. Methods: `upload_blob(blob_name: str, data: bytes) -> str`, `delete_blob(blob_name: str) -> None`, `get_blob_url(blob_name: str) -> str`. Reads `AZURE_STORAGE_CONNECTION_STRING` and `AZURE_STORAGE_CONTAINER_NAME` from `os.environ`.                          |           |      |
| TASK-008 | Create `kaist-ai-functions/services/cosmos_service.py` with class `CosmosService`. Methods: `upsert_item(item: dict) -> None`, `get_item(document_id: str, item_id: str) -> dict`, `query_documents(query: str, params: list) -> list[dict]`, `delete_items_by_document(document_id: str) -> None`. Reads `AZURE_COSMOS_ENDPOINT` and `AZURE_COSMOS_KEY` from env. |           |      |
| TASK-009 | Create `kaist-ai-functions/services/pdf_service.py` with class `PdfService`. Methods: `extract_text(pdf_bytes: bytes) -> str` (uses `pypdf.PdfReader`), `chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> list[str]`, `embed_chunks(chunks: list[str]) -> list[list[float]]` (uses `GoogleGenerativeAIEmbeddings(model="models/text-embedding-004")`). |           |      |
| TASK-010 | Add `pypdf` to `kaist-ai-functions/requirements.txt` if not already present (it is already in `.venv`; ensure the file entry exists for cloud deployment).                                                                                                                                                                                             |           |      |

**CosmosDB Document Schema (for reference — no DDL change needed beyond TASK-001):**

*Document metadata item* (one per PDF):
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

*Chunk item* (one per text chunk):
```json
{
  "id": "doc_<uuid>_chunk_0",
  "documentId": "doc_<uuid>",
  "type": "chunk",
  "chunkIndex": 0,
  "content": "The first 1000 characters of extracted text...",
  "embedding": [0.001, -0.042, ...]
}
```

### Implementation Phase 3: Backend — Blueprint API Functions

- GOAL-003: Implement each of the 5 CRUD endpoints as independent Azure Functions blueprint files.

| Task     | Description                                                                                                                                                                                                                                                                                                                                                                                                                   | Completed | Date |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-011 | Create `kaist-ai-functions/blueprints/__init__.py` (empty).                                                                                                                                                                                                                                                                                                                                                                   |           |      |
| TASK-012 | Create `kaist-ai-functions/blueprints/upload_document.py`. Route: `POST /api/documents`. Logic: (1) Validate `Content-Type` is `application/pdf` and size ≤ 50 MB. (2) Generate `doc_<uuid>`. (3) Upload raw bytes to Blob Storage as `{documentId}/{filename}`. (4) Write `DocumentRecord` with `status=processing` to CosmosDB. (5) Extract text → chunk → embed → write each `ChunkRecord`. (6) Update `DocumentRecord` `status=processed`, `chunkCount`. (7) Return `UploadDocumentResponse` (HTTP 201). |           |      |
| TASK-013 | Create `kaist-ai-functions/blueprints/list_documents.py`. Route: `GET /api/documents`. Logic: Query CosmosDB with `SELECT * FROM c WHERE c.type = 'document' ORDER BY c.uploadedAt DESC`. Return `DocumentListResponse` (HTTP 200).                                                                                                                                                                                           |           |      |
| TASK-014 | Create `kaist-ai-functions/blueprints/get_document.py`. Route: `GET /api/documents/{id}`. Logic: Read single `DocumentRecord` from CosmosDB by `id` (partition key = `id`). Return `GetDocumentResponse` (HTTP 200) or `404` if not found.                                                                                                                                                                                   |           |      |
| TASK-015 | Create `kaist-ai-functions/blueprints/update_document.py`. Route: `PATCH /api/documents/{id}`. Body: `UpdateDocumentRequest`. Logic: Parse body as `UpdateDocumentRequest`. Read existing `DocumentRecord`. Update `filename` field and `updatedAt`. Write back to CosmosDB. Return updated `DocumentResponse` (HTTP 200) or `404` if not found.                                                                              |           |      |
| TASK-016 | Create `kaist-ai-functions/blueprints/delete_document.py`. Route: `DELETE /api/documents/{id}`. Logic: (1) Read `DocumentRecord` to get `blobName`. (2) Delete blob from Blob Storage. (3) Delete all items with `documentId = id` from CosmosDB (metadata + all chunks) using `DELETE FROM c WHERE c.documentId = @documentId`. (4) Return HTTP 204.                                                                        |           |      |
| TASK-017 | Update `kaist-ai-functions/function_app.py`: import each `Blueprint` from all 5 blueprint files and call `app.register_blueprint(bp)` for each. Remove stub implementations that were previously inline.                                                                                                                                                                                                                     |           |      |

**Pydantic Models Summary** (defined in `kaist-ai-functions/models/document.py`):

| Model | Direction | Fields |
|---|---|---|
| `DocumentStatus` | — | Enum: `processing`, `processed`, `failed` |
| `DocumentRecord` | CosmosDB item | `id`, `documentId`, `type="document"`, `filename`, `blobName`, `fileSize`, `status`, `chunkCount`, `uploadedAt`, `updatedAt` |
| `ChunkRecord` | CosmosDB item | `id`, `documentId`, `type="chunk"`, `chunkIndex`, `content`, `embedding: list[float]` |
| `UploadDocumentResponse` | Response (201) | `id`, `filename`, `status`, `message` |
| `DocumentResponse` | Response (200) | `id`, `filename`, `fileSize`, `status`, `chunkCount`, `uploadedAt`, `updatedAt` |
| `DocumentListResponse` | Response (200) | `documents: list[DocumentResponse]`, `total: int` |
| `GetDocumentResponse` | Response (200) | all `DocumentResponse` fields + `blobName` |
| `UpdateDocumentRequest` | Request body | `filename: str` |

### Implementation Phase 4: Frontend — Document Management UI

- GOAL-004: Add a fully functional document management panel to the React web app that connects to the Phase 3 API.

| Task     | Description                                                                                                                                                                                                                                                                              | Completed | Date |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-018 | Create `kaist-ai-webapp/src/types/document.ts` with TypeScript types mirroring the Pydantic models: `DocumentStatus`, `Document`, `DocumentListResponse`, `UploadDocumentResponse`.                                                                                                     |           |      |
| TASK-019 | Create `kaist-ai-webapp/src/api/documents.ts` with the following typed async functions: `uploadDocument(file: File): Promise<UploadDocumentResponse>`, `listDocuments(): Promise<DocumentListResponse>`, `getDocument(id: string): Promise<Document>`, `updateDocument(id: string, filename: string): Promise<Document>`, `deleteDocument(id: string): Promise<void>`. All functions use `fetch` against `/api/documents`. |           |      |
| TASK-020 | Create `kaist-ai-webapp/src/components/DocumentListItem.tsx`. Props: `document: Document`, `onDelete: (id: string) => void`, `onRename: (id: string, newName: string) => void`. Renders: filename, upload date, status badge, chunk count, rename inline edit (pencil icon toggle), delete button with confirmation dialog. |           |      |
| TASK-021 | Create `kaist-ai-webapp/src/components/DocumentManager.tsx`. Responsibilities: (1) Fetch document list on mount via `listDocuments()`. (2) Render `PdfUpload` component; on successful upload refresh list. (3) Render `DocumentListItem` for each document. (4) Handle rename via `updateDocument`. (5) Handle delete via `deleteDocument` then refresh list. Show loading and error states. |           |      |
| TASK-022 | Update `kaist-ai-webapp/src/components/PdfUpload.tsx`: implement `handleUpload` to call `uploadDocument(file)` from the API module. Show an upload progress bar (use `XMLHttpRequest` with `progress` event). Emit an `onUploaded` callback prop after success. Validate file is PDF by MIME type before sending. |           |      |
| TASK-023 | Update `kaist-ai-webapp/src/App.tsx`: replace the standalone `<PdfUpload />` in the sidebar with `<DocumentManager />` (which internally renders `PdfUpload` plus the document list).                                                                                                   |           |      |

---

## 3. Alternatives

- **ALT-001**: Add a separate `documents` container in CosmosDB for metadata instead of co-locating with chunks. Rejected — the same partition key (`documentId`) allows efficient document + chunk operations together, and cross-partition list queries (`type = 'document'`) are acceptable at this scale with serverless CosmosDB.
- **ALT-002**: Use Azure Cognitive Search instead of native CosmosDB hybrid search. Rejected — the existing Bicep and requirements explicitly target CosmosDB's built-in vector + full-text hybrid search, avoiding an extra service.
- **ALT-003**: Use `azure-ai-textanalytics` or `langchain` text splitters for chunking instead of a hand-rolled splitter. Rejected for the chunking stage to minimize dependencies; `langchain`'s `RecursiveCharacterTextSplitter` may be adopted as a follow-up if boundary quality is insufficient.
- **ALT-004**: Generate embeddings using OpenAI Ada-002 (1536 dims). Rejected — the project already uses Gemini for LLM; using the same provider for embeddings avoids an additional API key and the vector dimension mismatch it would create.

---

## 4. Dependencies

- **DEP-001**: `pypdf >= 4.0` — PDF text extraction (already in `.venv`; must be in `requirements.txt`).
- **DEP-002**: `langchain-google-genai >= 4.0` — Gemini embedding generation (already in `.venv`).
- **DEP-003**: `azure-storage-blob >= 12.0` — Blob Storage SDK (already in `.venv`).
- **DEP-004**: `azure-cosmos >= 4.0` — Cosmos DB SDK (already in `.venv`).
- **DEP-005**: `pydantic >= 2.0` — Request/response model validation (already in `.venv`).
- **DEP-006**: `GOOGLE_API_KEY` environment variable pointing to a valid Gemini API key (provisioned in Key Vault in `feature-api-backend-gemini-1.0`).
- **DEP-007**: Azure Blob Storage container `pdfs` must exist (provisioned in Phase 1 / L2).
- **DEP-008**: Azure Cosmos DB container `knowledge` with partition key `/documentId` must exist (provisioned in L2 and updated in Phase 1 of this plan).

---

## 5. Files

### New Files

- **FILE-001**: `kaist-ai-functions/models/__init__.py` — Package init.
- **FILE-002**: `kaist-ai-functions/models/document.py` — Pydantic models for all document API requests and responses, plus CosmosDB item schemas.
- **FILE-003**: `kaist-ai-functions/services/__init__.py` — Package init.
- **FILE-004**: `kaist-ai-functions/services/blob_service.py` — `BlobStorageService` class wrapping `azure-storage-blob`.
- **FILE-005**: `kaist-ai-functions/services/cosmos_service.py` — `CosmosService` class wrapping `azure-cosmos` SDK.
- **FILE-006**: `kaist-ai-functions/services/pdf_service.py` — `PdfService` class (extract, chunk, embed using Gemini).
- **FILE-007**: `kaist-ai-functions/blueprints/__init__.py` — Package init.
- **FILE-008**: `kaist-ai-functions/blueprints/upload_document.py` — `POST /api/documents` blueprint.
- **FILE-009**: `kaist-ai-functions/blueprints/list_documents.py` — `GET /api/documents` blueprint.
- **FILE-010**: `kaist-ai-functions/blueprints/get_document.py` — `GET /api/documents/{id}` blueprint.
- **FILE-011**: `kaist-ai-functions/blueprints/update_document.py` — `PATCH /api/documents/{id}` blueprint.
- **FILE-012**: `kaist-ai-functions/blueprints/delete_document.py` — `DELETE /api/documents/{id}` blueprint.
- **FILE-013**: `kaist-ai-webapp/src/types/document.ts` — TypeScript type definitions.
- **FILE-014**: `kaist-ai-webapp/src/api/documents.ts` — Typed fetch API client for document endpoints.
- **FILE-015**: `kaist-ai-webapp/src/components/DocumentListItem.tsx` — Single document row component with rename/delete actions.
- **FILE-016**: `kaist-ai-webapp/src/components/DocumentManager.tsx` — Document management panel (list + upload orchestration).

### Modified Files

- **FILE-017**: `kaist-ai-functions/function_app.py` — Register all 5 blueprints; remove inline stub handlers.
- **FILE-018**: `kaist-ai-functions/requirements.txt` — Ensure `pypdf`, `langchain-google-genai`, `azure-storage-blob`, `azure-cosmos`, `pydantic` are listed.
- **FILE-019**: `kaist-ai-infra/modules/cosmos.bicep` — Change vector embedding `dimensions` from `1536` to `768`.
- **FILE-020**: `kaist-ai-webapp/src/components/PdfUpload.tsx` — Implement actual upload with progress; add `onUploaded` callback prop.
- **FILE-021**: `kaist-ai-webapp/src/App.tsx` — Replace `<PdfUpload />` with `<DocumentManager />`.
- **FILE-022**: `docs/specification.md` — Add document management API section; update CosmosDB schema description.
- **FILE-023**: `docs/implementation-plan.md` — Mark Phase 2 API Functions as In Progress; reference this plan.

---

## 6. Testing

- **TEST-001**: `POST /api/documents` — Upload a valid PDF; assert HTTP 201, Blob Storage object exists at `{documentId}/{filename}`, CosmosDB contains one `type=document` item and N `type=chunk` items, all chunks have `embedding` array of length 768.
- **TEST-002**: `POST /api/documents` — Upload a non-PDF file; assert HTTP 400 with validation error message.
- **TEST-003**: `POST /api/documents` — Upload a PDF exceeding 50 MB; assert HTTP 413.
- **TEST-004**: `GET /api/documents` — After uploading 2 PDFs, list returns both with correct fields; `total = 2`.
- **TEST-005**: `GET /api/documents/{id}` — Returns correct metadata for a known document ID; returns HTTP 404 for unknown ID.
- **TEST-006**: `PATCH /api/documents/{id}` — Rename a document; assert response contains new `filename`; CosmosDB item reflects change; Blob Storage object name is unchanged.
- **TEST-007**: `DELETE /api/documents/{id}` — After delete: HTTP 204 returned; Blob Storage object no longer exists; CosmosDB returns no items with that `documentId`.
- **TEST-008**: Web UI — Upload a PDF via the drop zone; document appears in list with `processing` then `processed` status; upload progress bar is visible during transfer.
- **TEST-009**: Web UI — Click rename icon, edit name, confirm; document list updates to show new name.
- **TEST-010**: Web UI — Click delete, confirm dialog; document disappears from list.

---

## 7. Risks & Assumptions

- **RISK-001**: Gemini `text-embedding-004` rate limits may throttle batch embedding during large PDF uploads. Mitigation: embed chunks sequentially or in small batches with retry logic.
- **RISK-002**: Changing the CosmosDB vector dimension from 1536 to 768 requires re-provisioning the container. Any existing items with 1536-dim vectors will be incompatible. Mitigation: this is a new container (no production data yet); document this in deployment notes.
- **RISK-003**: `pypdf` may fail to extract text from scanned (image-only) PDFs. Mitigation: return a user-facing error with `status=failed`; OCR support is a future enhancement.
- **RISK-004**: Azure Functions cold-start latency with all service imports may cause the first upload request to time out. Mitigation: lazy-initialize service clients inside functions; consider configuring minimum instance count.
- **ASSUMPTION-001**: The Blob Storage container `pdfs` and Cosmos DB container `knowledge` are already provisioned (Phase 1 of the main implementation plan is complete).
- **ASSUMPTION-002**: `GOOGLE_API_KEY` is available as an environment variable in both local and cloud Azure Functions environments.
- **ASSUMPTION-003**: The web app is served from a domain that shares the same origin as the Azure Functions API, or CORS is configured to allow cross-origin requests.
- **ASSUMPTION-004**: Each PDF uploaded by a user is a new document; re-uploading the same filename creates a new document with a new `documentId`.

---

## 8. Related Specifications / Further Reading

- [docs/specification.md](../specification.md) — System-level spec (updated by this plan)
- [docs/implementation-plan.md](../implementation-plan.md) — Phase 2 of the master plan
- [docs/plan/feature-api-backend-gemini-1.0.md](feature-api-backend-gemini-1.0.md) — Gemini + Azure Functions setup (prerequisite)
- [Azure Functions Python v2 Programming Model — Blueprints](https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-python?tabs=get-started%2Casgi%2Capplication-level&pivots=python-mode-decorators#blueprints)
- [Azure Cosmos DB NoSQL Vector Search](https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/vector-search)
- [Google Gemini text-embedding-004](https://ai.google.dev/gemini-api/docs/models#text-embedding)
- [pypdf Documentation](https://pypdf.readthedocs.io/)
