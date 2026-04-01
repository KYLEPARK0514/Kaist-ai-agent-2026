# KAIST AI Agent — Implementation Plan

## Overview

This document outlines the phased implementation plan for the KAIST AI Agent project.

- **Phase 1 (complete)** — Azure infrastructure provisioned via Bicep and deployed with `azd`.
- **Phase 2 (in progress)** — API Functions: PDF management CRUD, text extraction, embedding, and chat.
- **Phase 3 (deferred)** — Web App: React UI for document management and chat.

---

## Directory Structure

```
/
├── kaist-ai-infra/          # Bicep templates and deployment scripts
├── kaist-ai-functions/      # Azure Functions (Python 3.11) — Phase 2
└── kaist-ai-webapp/         # React + Vite + TypeScript client — Phase 3
```

---

## Phase 1: Infrastructure (`kaist-ai-infra/`) ✅ Complete

All Azure resources provisioned. See the Bicep modules in `kaist-ai-infra/modules/` for the full definitions.

| Resource | Name Pattern | Status |
|---|---|---|
| Storage Account (PDFs) | `kaistaipdf{unique}` | ✅ Done |
| Blob Container (`pdfs`) | — | ✅ Done |
| Cosmos DB Account + DB + Container | `kaistcosmos{unique}` / `kaistdb` / `knowledge` | ✅ Done |
| Function Storage Account | `kaistfunc{unique}` | ✅ Done |
| App Service Plan (Consumption) | `kaist-asp-{unique}` | ✅ Done |
| Function App | `kaistfunc{unique}` | ✅ Done |
| Log Analytics + Application Insights | — | ✅ Done |
| Azure Static Web Apps | — | ✅ Done |
| Key Vault | `kaistakv{unique}` | ✅ Done |

### Outputs

| Output | Description |
|---|---|
| `AZURE_STORAGE_ACCOUNT_NAME` | PDF storage account name |
| `AZURE_STORAGE_CONTAINER_NAME` | Blob container name (`pdfs`) |
| `AZURE_COSMOS_ENDPOINT` | Cosmos DB endpoint URL |
| `AZURE_COSMOS_DATABASE_NAME` | `kaistdb` |
| `AZURE_COSMOS_CONTAINER_NAME` | `knowledge` |
| `AZURE_FUNCTIONS_APP_NAME` | Function App name |
| `AZURE_STATIC_WEB_APP_URL` | Static Web App default hostname |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | App Insights connection string |

---

## Phase 2: API Functions (`kaist-ai-functions/`) — In Progress

See **[docs/plan/feature-knowledge-base-pdf-management-1.0.md](plan/feature-knowledge-base-pdf-management-1.0.md)** for the detailed implementation plan.

### Endpoints

| Method | Path | Description | Status |
|---|---|---|---|
| `GET` | `/api/health` | Health check | ✅ Done |
| `POST` | `/api/chat` | Submit question, receive Gemini answer | ✅ Done |
| `POST` | `/api/documents` | Upload PDF, extract text, embed, store | 🔲 Planned |
| `GET` | `/api/documents` | List uploaded documents | 🔲 Planned |
| `GET` | `/api/documents/{id}` | Get single document metadata | 🔲 Planned |
| `PATCH` | `/api/documents/{id}` | Update document metadata (rename) | 🔲 Planned |
| `DELETE` | `/api/documents/{id}` | Delete document (blob + CosmosDB) | 🔲 Planned |

### 2.1 File Structure (Target)

```
kaist-ai-functions/
├── function_app.py           # Entry point — registers blueprints
├── host.json
├── local.settings.json
├── requirements.txt
├── blueprints/               # One file per API endpoint
│   ├── __init__.py
│   ├── upload_document.py    # POST /api/documents
│   ├── list_documents.py     # GET /api/documents
│   ├── get_document.py       # GET /api/documents/{id}
│   ├── update_document.py    # PATCH /api/documents/{id}
│   └── delete_document.py    # DELETE /api/documents/{id}
├── models/
│   ├── __init__.py
│   └── document.py           # Pydantic v2 request/response models
└── services/
    ├── __init__.py
    ├── blob_service.py       # Azure Blob Storage wrapper
    ├── cosmos_service.py     # Cosmos DB wrapper
    └── pdf_service.py        # Text extraction, chunking, embedding
```

### 2.2 CosmosDB Schema change

The `knowledge` container vector embedding dimensions must change from **1 536 → 768** to match Google Gemini `text-embedding-004`. Update: `kaist-ai-infra/modules/cosmos.bicep` → `vectorEmbeddingPolicy.vectorEmbeddings[0].dimensions`.

### 2.3 Acceptance Criteria — Phase 2

- [ ] `POST /api/documents` stores file in Blob Storage and N chunks + 1 metadata item in CosmosDB
- [ ] All chunks have `embedding` array of length 768
- [ ] `GET /api/documents` returns all document metadata items
- [ ] `PATCH /api/documents/{id}` updates `filename` in CosmosDB
- [ ] `DELETE /api/documents/{id}` removes blob and all CosmosDB items for that `documentId`
- [ ] All endpoints return correct HTTP status codes and Pydantic-validated response bodies
- [ ] Each endpoint is in its own file under `blueprints/`

---

## Phase 3: Web App (`kaist-ai-webapp/`) — Deferred

> **Not in scope for current sprint.** Defined here for planning purposes.

See **[docs/plan/feature-knowledge-base-pdf-management-1.0.md](plan/feature-knowledge-base-pdf-management-1.0.md)** Phase 4 for the frontend implementation tasks.

### Stack

- React 18 + Vite + TypeScript
- Tailwind CSS
- Deployed to Azure Static Web Apps

### Target File Structure

```
kaist-ai-webapp/src/
├── api/
│   └── documents.ts          # Typed fetch client
├── types/
│   └── document.ts           # TypeScript type definitions
├── components/
│   ├── DocumentManager.tsx   # PDF list + upload panel
│   ├── DocumentListItem.tsx  # Document row with rename/delete
│   ├── PdfUpload.tsx         # Drop zone with progress bar
│   └── ChatInterface.tsx     # Chat UI
├── App.tsx
└── main.tsx
```

### Key Features

- Document Manager panel: list, upload with progress, inline rename, delete with confirmation
- Chat Interface: Q&A against the knowledge base
- Responsive layout

---

## Immediate Next Steps

1. **TASK-001** — Update `cosmos.bicep` vector dimensions 1536 → 768 and re-provision
2. **TASK-004 to TASK-010** — Create models and service classes
3. **TASK-011 to TASK-017** — Implement blueprint API functions and update `function_app.py`
4. **TASK-018 to TASK-023** — Implement frontend document management UI
