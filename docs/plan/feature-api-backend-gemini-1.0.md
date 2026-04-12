---
goal: Implement Azure Functions API Backend with Python 3.11 and Google Gemini 3 Pro
version: 1.0
date_created: 2026-03-24
owner: AI Assistant Unattended
status: Planned
tags: [feature, backend, ai, infrastructure]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This implementation plan defines the structured steps required to build an API backend core using Azure Functions with a Python 3.11 runtime. The backend will leverage cloud-based Azure Storage exclusively and integrate with Google Gemini 3 Pro for its LLM and embedding capabilities through the `langchain-google-genai` provider. The plan encompasses Google Cloud Platform (GCP) project setup, Azure Key Vault integration for secrets, and the base logic scaffolding for AI tasks.

## 1. Requirements & Constraints

- **REQ-001**: Set up Azure Functions in the `kaist-ai-functions/` directory using Python 3.11.
- **REQ-002**: Utilize cloud-provisioned Azure Storage for the Azure Functions runtime; local Azurite integration is disabled.
- **REQ-003**: Integrate Google Gemini 3 Pro as the main LLM and embedding model.
- **REQ-004**: Use the `langchain-google-genai` library instead of `langchain-google-vertexai`.
- **SEC-001**: All GCP connection strings and API keys (`GOOGLE_API_KEY`) must be stored securely in Azure Key Vault and injected via Key Vault References in Azure Functions.
- **CON-001**: All tasks must be directly executable and verified against Azure & GCP standard architectures.
- **PAT-001**: Follow structural and coding guidelines defined by LangChain's Google GenAI integration recommendations.

## 2. Implementation Steps

### Implementation Phase 1: GCP Setup and Secrets Configuration

- GOAL-001: Provision Google Cloud Platform dependencies and link credentials to the Azure Key Vault.

| Task     | Description           | Completed | Date       |
| -------- | --------------------- | --------- | ---------- |
| TASK-001 | Create a new GCP Project and enable the Google Generative AI API explicitly. |           |            |
| TASK-002 | Generate a new GCP API Key specifically for the Gemini 3 Pro service. |           |            |
| TASK-003 | Update `kaist-ai-infra/modules/keyvault.bicep` to store the output API Key as `GOOGLE-API-KEY`. |           |            |
| TASK-004 | Update `kaist-ai-infra/modules/functions.bicep` to map `GOOGLE_API_KEY` to the `GOOGLE-API-KEY` Key Vault secret via `@Microsoft.KeyVault(...)` referencing. |           |            |

### Implementation Phase 2: Azure Functions Scaffolding

- GOAL-002: Scaffold and configure the `kaist-ai-functions/` project with Python 3.11 dependencies and Azure Storage connections.

| Task     | Description           | Completed | Date |
| -------- | --------------------- | --------- | ---- |
| TASK-005 | Re-initialize the `kaist-ai-functions/` environment as a Python-v2 Azure Functions application locking the runtime to 3.11. |           |      |
| TASK-006 | Update `kaist-ai-functions/local.settings.json` and replace `UseDevelopmentStorage=true` with the explicit connection string of the provisioned Cloud Azure Storage Account. |           |      |
| TASK-007 | Inject `langchain-google-genai`, `langchain`, `google-generativeai`, and `azure-functions` to `kaist-ai-functions/requirements.txt`. |           |      |

### Implementation Phase 3: GenAI Backend Implementation

- GOAL-003: Implement the HTTP-triggered core endpoints leveraging Gemini 3 Pro.

| Task     | Description           | Completed | Date |
| -------- | --------------------- | --------- | ---- |
| TASK-008 | Create `kaist-ai-functions/function_app.py` scaffolding an HTTP-triggered route for natural language inference. |           |      |
| TASK-009 | Implement `ChatGoogleGenerativeAI` wrapper inside `function_app.py` referencing the injected `GOOGLE_API_KEY`. |           |      |
| TASK-010 | Implement `GoogleGenerativeAIEmbeddings` logic to map and return text-to-vector embeddings. |           |      |

## 3. Alternatives

- **ALT-001**: `langchain-google-vertexai` with explicit Google Cloud Service Accounts. Deferred in favor of `langchain-google-genai` due to architectural decisions to manage keys centrally in Azure Key Vault without spinning out extensive GCP Identity integrations.
- **ALT-002**: Local Azure Storage emulation using Azurite. Disabled due to REQ-002 requiring exact cloud-replica state and stability.

## 4. Dependencies

- **DEP-001**: Google Cloud Platform Billing Account for GenAI API.
- **DEP-002**: Azure Functions Core Tools compatible with Python v2 programming model and Python 3.11.
- **DEP-003**: Provisions of Azure Key Vault and Storage built from `kaist-ai-infra/main.bicep`.

## 5. Files

- **FILE-001**: `kaist-ai-functions/local.settings.json`: Target for explicit cloud storage strings.
- **FILE-002**: `kaist-ai-functions/requirements.txt`: Target for PyPI specifications (`langchain-google-genai`).
- **FILE-003**: `kaist-ai-functions/function_app.py`: Main execution endpoint.
- **FILE-004**: `kaist-ai-infra/modules/functions.bicep`: Deployment specification for app settings and Key Vault mapping.

## 6. Testing

- **TEST-001**: Execute HTTP request targeting Gemini Chat functionality, expecting an HTTP 200 payload with the generated text.
- **TEST-002**: Validate Azure Functions cold start times loading Python 3.11 runtime and `langchain` modules.
- **TEST-003**: Inspect Key Vault references in Azure Portal to verify `GOOGLE_API_KEY` mapping resolves as "Initialised / Synced".

## 7. Risks & Assumptions

- **RISK-001**: Potential changes or deprecations in Gemini endpoints in the `langchain-google-genai` module.
- **ASSUMPTION-001**: Python 3.11 is explicitly mandated and available in the target Azure App Service Plan.
- **ASSUMPTION-002**: Costs associated with Gemini 3 Pro and Cloud Storage usage are accommodated within budget limits.

## 8. Related Specifications / Further Reading

- [Google Generative AI Provider Integration (Langchain)](https://docs.langchain.com/oss/python/integrations/providers/google#google-generative-ai)
- [Azure Functions Python Developer Guide](https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-python)
