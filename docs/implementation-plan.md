# KAIST AI Agent — Implementation Plan

## Overview

This document outlines the phased implementation plan for the KAIST AI Agent project.  
**Phase 1 (current focus): Infrastructure** — all Azure resources provisioned via Bicep and deployed with `azd`.  
Phase 2 and 3 (deferred) cover the API Functions and Web App respectively.

---

## Directory Structure
z
```
/
├── kaist-ai-infra/          # Bicep templates and deployment scripts
├── kaist-ai-functions/      # Azure Functions (Python 3.11) — Phase 2
└── kaist-ai-webapp/         # React + Vite + TypeScript client — Phase 3
```

---

## Phase 1: Infrastructure (`kaist-ai-infra/`)

### Goals
Provision all Azure resources needed for the full system so that Phase 2 and 3 can deploy into a ready environment.

### 1.1 Current State

The following resources are already defined in `kaist-ai-infra/main.bicep`:

| Resource | Name Pattern | Status |
|---|---|---|
| Storage Account (PDFs) | `kaistaipdf{unique}` | ✅ Done |
| Blob Container (`pdfs`) | — | ✅ Done |
| Cosmos DB Account | `kaistcosmos{unique}` | ✅ Done |
| Storage Account (Functions) | `kaistfunc{unique}` | ✅ Done |
| App Service Plan (Consumption) | `kaist-asp-{unique}` | ✅ Done |

### 1.2 Remaining Bicep Resources

The following resources still need to be added to `main.bicep`:

#### 1.2.1 Log Analytics Workspace + Application Insights
- Required before the Function App (Application Insights depends on it)
- Enables monitoring, logging, and diagnostics across all services

```
Resource: Microsoft.OperationalInsights/workspaces
Resource: Microsoft.Insights/components (linked to workspace)
```

#### 1.2.2 Azure Functions App
- The App Service Plan already exists; the Function App resource itself is missing
- Runtime: Python 3.11, OS: Linux
- Must reference: Function Storage Account, App Service Plan, Application Insights
- App settings to wire up: `AzureWebJobsStorage`, `FUNCTIONS_EXTENSION_VERSION`, `FUNCTIONS_WORKER_RUNTIME`, `APPLICATIONINSIGHTS_CONNECTION_STRING`

```
Resource: Microsoft.Web/sites (kind: 'functionapp,linux')
```

#### 1.2.3 Cosmos DB Database and Container
- The Cosmos DB Account exists, but the database and container are not yet defined
- Container needs a vector search policy and full-text index for hybrid search
- Partition key: `/sessionId` (or `/documentId` — to be confirmed)
- Vector dimension and distance function must be set (e.g., 1536 dims, cosine)

```
Resource: Microsoft.DocumentDB/databaseAccounts/sqlDatabases
Resource: Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers
```

#### 1.2.4 Azure Static Web Apps *(define now, deploy in Phase 3)*
- Define the resource in Bicep now so it is part of `azd provision`
- Leave app deployment wired up to Phase 3 (`kaist-ai-webapp/`)

```
Resource: Microsoft.Web/staticSites
```

#### 1.2.5 Key Vault *(recommended)*
- Centralise secrets: Cosmos DB key, Storage Account keys, future API keys
- Grant the Function App a managed identity and Key Vault secret reader role
- Outputs in `main.bicep` currently expose raw keys — move to Key Vault references

```
Resource: Microsoft.KeyVault/vaults
Resource: Microsoft.Authorization/roleAssignments (Key Vault Secrets User)
```

### 1.3 `azure.yaml` Updates

The current `azure.yaml` references the infra project but does not declare services for Functions or Web App. Update it to add stubs for Phase 2/3 so `azd` can manage the full lifecycle later:

```yaml
name: kaist-ai-agent
metadata:
  template: kaist-ai-agent@0.0.1
services:
  api:
    project: kaist-ai-functions
    language: python
    host: function
  web:
    project: kaist-ai-webapp
    language: js
    host: staticwebapp
```

### 1.4 Bicep File Structure (Target)

Split `main.bicep` into focused modules for maintainability:

```
kaist-ai-infra/
├── main.bicep               # Orchestrator — calls all modules, exposes outputs
├── modules/
│   ├── storage.bicep        # PDF storage account + blob container
│   ├── cosmos.bicep         # Cosmos DB account, database, container
│   ├── functions.bicep      # Function storage, App Service Plan, Function App
│   ├── monitoring.bicep     # Log Analytics workspace + Application Insights
│   ├── staticwebapp.bicep   # Static Web Apps
│   └── keyvault.bicep       # Key Vault + role assignments
└── scripts/
    └── post-provision.sh    # Any post-provision steps (e.g., seed Cosmos DB)
```

### 1.5 Outputs

`main.bicep` should expose the following outputs for `azd` and downstream use:

| Output | Description |
|---|---|
| `AZURE_STORAGE_ACCOUNT_NAME` | PDF storage account name |
| `AZURE_STORAGE_CONTAINER_NAME` | Blob container name |
| `AZURE_COSMOS_ENDPOINT` | Cosmos DB endpoint URL |
| `AZURE_COSMOS_DATABASE_NAME` | Cosmos DB database name |
| `AZURE_COSMOS_CONTAINER_NAME` | Cosmos DB container name |
| `AZURE_FUNCTIONS_APP_NAME` | Function App name |
| `AZURE_STATIC_WEB_APP_URL` | Static Web App default hostname |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | App Insights connection string |

> **Security note:** Do not output raw account keys. Use Key Vault references or managed identity instead.

### 1.6 Acceptance Criteria — Phase 1

- [ ] `azd provision` completes without errors in `koreacentral`
- [ ] All resources in section 1.2 are present in the Azure portal
- [ ] Cosmos DB container has vector search policy and full-text index applied
- [ ] Function App is reachable (HTTP trigger returns 200 on a health-check endpoint)
- [ ] Application Insights receives telemetry from the Function App
- [ ] No raw secrets appear in Bicep outputs (Key Vault or managed identity used)
- [ ] Bicep lints cleanly (`bicep build main.bicep` produces no errors/warnings)

---

## Phase 2: API Functions (`kaist-ai-functions/`) — Deferred

> **Not in scope for current sprint.** Defined here for planning purposes.

### Planned Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/documents` | Upload and process a PDF |
| `GET` | `/api/documents` | List uploaded documents |
| `DELETE` | `/api/documents/{id}` | Delete a document and its embeddings |
| `POST` | `/api/chat` | Submit a question, receive an answer |
| `GET` | `/api/health` | Health check |

### Key Dependencies (from Phase 1)
- Cosmos DB container with vector + full-text index
- PDF Blob Storage container
- Application Insights connection string
- Key Vault for secrets

---

## Phase 3: Web App (`kaist-ai-webapp/`) — Deferred

> **Not in scope for current sprint.** Defined here for planning purposes.

### Stack
- React + Vite + TypeScript
- Tailwind CSS
- Deployed to Azure Static Web Apps (provisioned in Phase 1)

### Key Features
- PDF upload UI
- Chat interface
- Connected to Phase 2 API via Static Web Apps linked backend

---

## Immediate Next Steps (Phase 1)

1. **Add `monitoring.bicep` module** — Log Analytics + Application Insights
2. **Add `functions.bicep` module** — Function App resource (App Service Plan already exists, move it here)
3. **Add `cosmos.bicep` module** — Database + Container with vector/full-text index policy
4. **Add `staticwebapp.bicep` module** — Static Web Apps resource stub
5. **Add `keyvault.bicep` module** — Key Vault + managed identity role assignments
6. **Refactor `main.bicep`** — Modularise, update outputs, remove raw key outputs
7. **Update `azure.yaml`** — Add `api` and `web` service stubs
8. **Run `azd provision`** — Verify all resources provision successfully
9. **Lint and validate** — `bicep build` + manual portal checks
