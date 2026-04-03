# Create GitHub Issues from Implementation Plan
# Run this script from the repo root after authenticating with GitHub

param(
    [string]$Token = $env:GITHUB_TOKEN
)

# Retrieve token from Windows Credential Manager if not provided
if (-not $Token) {
    $credSource = @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WinCred2 {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct CREDENTIAL {
        public int Flags; public int Type;
        public string TargetName; public string Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public int CredentialBlobSize; public IntPtr CredentialBlob;
        public int Persist; public int AttributeCount;
        public IntPtr Attributes; public string TargetAlias; public string UserName;
    }
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredRead(string target, int type, int flags, out IntPtr credential);
    [DllImport("advapi32.dll", SetLastError = true)]
    public static extern void CredFree(IntPtr credential);
    public static string GetPassword(string target) {
        IntPtr ptr;
        if (!CredRead(target, 1, 0, out ptr)) return null;
        try {
            CREDENTIAL c = (CREDENTIAL)Marshal.PtrToStructure(ptr, typeof(CREDENTIAL));
            if (c.CredentialBlobSize == 0) return "";
            byte[] b = new byte[c.CredentialBlobSize];
            Marshal.Copy(c.CredentialBlob, b, 0, c.CredentialBlobSize);
            return Encoding.ASCII.GetString(b);
        } finally { CredFree(ptr); }
    }
}
"@
    Add-Type -TypeDefinition $credSource -Language CSharp -ErrorAction SilentlyContinue
    $Token = [WinCred2]::GetPassword("GitHub - https://api.github.com/KYLEPARK0514")
    if ($Token) { $Token = $Token.Trim() }
}

if (-not $Token) {
    Write-Error "GitHub token not found. Set GITHUB_TOKEN env var or ensure Git Credential Manager has a stored token."
    exit 1
}

$headers = @{
    Authorization            = "Bearer $Token"
    "X-GitHub-Api-Version"   = "2022-11-28"
    "Content-Type"           = "application/json"
    Accept                   = "application/vnd.github+json"
}
$repo = "KYLEPARK0514/Kaist-ai-agent-2026"
$baseUrl = "https://api.github.com/repos/$repo"

function New-GitHubLabel($name, $color, $description) {
    $body = @{ name = $name; color = $color; description = $description } | ConvertTo-Json
    try {
        $resp = Invoke-RestMethod -Uri "$baseUrl/labels" -Method POST -Headers $headers -Body $body -ErrorAction Stop
        Write-Host "  Label created: $($resp.name)"
    } catch {
        if ($_.Exception.Response.StatusCode -eq 422) {
            Write-Host "  Label already exists: $name"
        } else {
            Write-Warning "  Label error ($name): $_"
        }
    }
}

function New-GitHubIssue($title, $body, $labelNames) {
    $payload = @{
        title  = $title
        body   = $body
        labels = $labelNames
    } | ConvertTo-Json -Depth 5
    $resp = Invoke-RestMethod -Uri "$baseUrl/issues" -Method POST -Headers $headers -Body $payload -ErrorAction Stop
    Write-Host "  Created #$($resp.number): $($resp.title)"
    Write-Host "  -> $($resp.html_url)"
    return $resp.number
}

# ---------------------------------------------------------------------------
# 1. Create Labels
# ---------------------------------------------------------------------------
Write-Host "`n[Step 1] Creating labels..."
New-GitHubLabel "infrastructure" "0075ca" "Azure infrastructure (Bicep/azd)"
New-GitHubLabel "phase-1"        "e4e669" "Phase 1 - Infrastructure"
New-GitHubLabel "phase-2"        "d93f0b" "Phase 2 - API Functions (deferred)"
New-GitHubLabel "phase-3"        "0e8a16" "Phase 3 - Web App (deferred)"

# ---------------------------------------------------------------------------
# 2. Phase 1 sub-issues
# ---------------------------------------------------------------------------
Write-Host "`n[Step 2] Creating Phase 1 sub-issues..."

$issue121 = New-GitHubIssue `
    "[Infra] Add Log Analytics Workspace + Application Insights" `
    @"
## Overview
Add monitoring resources required before the Azure Functions App can be provisioned.
Application Insights depends on a Log Analytics Workspace.

## Resources to add to Bicep
- ``Microsoft.OperationalInsights/workspaces``
- ``Microsoft.Insights/components`` (linked to the workspace above)

## Tasks
- [ ] Create ``kaist-ai-infra/modules/monitoring.bicep``
- [ ] Define Log Analytics Workspace (PerGB2018 SKU, retention 30 days)
- [ ] Define Application Insights component (Web kind, linked to workspace)
- [ ] Expose ``APPLICATIONINSIGHTS_CONNECTION_STRING`` as a Bicep output
- [ ] Reference module from ``main.bicep``

## Notes
This must be provisioned **before** the Function App (section 1.2.2).

## References
- ``docs/implementation-plan.md`` — section 1.2.1
"@ `
    @("infrastructure", "phase-1")

$issue122 = New-GitHubIssue `
    "[Infra] Add Azure Functions App resource to Bicep" `
    @"
## Overview
The App Service Plan (Consumption) already exists. The actual Function App resource is missing.

## Resource to add
``Microsoft.Web/sites`` (kind: ``functionapp,linux``)

## Tasks
- [ ] Create ``kaist-ai-infra/modules/functions.bicep``
- [ ] Move existing App Service Plan resource into this module
- [ ] Define Function App resource (Python 3.11, Linux, Consumption)
- [ ] Wire app settings:
  - ``AzureWebJobsStorage``
  - ``FUNCTIONS_EXTENSION_VERSION`` = ``~4``
  - ``FUNCTIONS_WORKER_RUNTIME`` = ``python``
  - ``APPLICATIONINSIGHTS_CONNECTION_STRING`` (from monitoring module output)
- [ ] Expose ``AZURE_FUNCTIONS_APP_NAME`` as a Bicep output
- [ ] Reference module from ``main.bicep``

## Dependencies
- Issue: [Infra] Add Log Analytics Workspace + Application Insights (must be done first)

## References
- ``docs/implementation-plan.md`` — section 1.2.2
"@ `
    @("infrastructure", "phase-1")

$issue123 = New-GitHubIssue `
    "[Infra] Add Cosmos DB Database and Container (hybrid search)" `
    @"
## Overview
The Cosmos DB Account already exists. The database and container (with vector search + full-text index) are missing.

## Resources to add
- ``Microsoft.DocumentDB/databaseAccounts/sqlDatabases``
- ``Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers``

## Tasks
- [ ] Create ``kaist-ai-infra/modules/cosmos.bicep``
- [ ] Define database resource
- [ ] Define container with:
  - Partition key: ``/sessionId`` (confirm with team)
  - Vector search policy (1536 dims, cosine distance)
  - Full-text index policy
- [ ] Expose ``AZURE_COSMOS_DATABASE_NAME`` and ``AZURE_COSMOS_CONTAINER_NAME`` as outputs
- [ ] Reference module from ``main.bicep``

## References
- ``docs/implementation-plan.md`` — section 1.2.3
- ``docs/specification.md`` — Cosmos DB section
"@ `
    @("infrastructure", "phase-1")

$issue124 = New-GitHubIssue `
    "[Infra] Add Azure Static Web Apps resource stub" `
    @"
## Overview
Define the Static Web Apps resource in Bicep now so ``azd provision`` includes it.
Actual app deployment is deferred to Phase 3.

## Resource to add
``Microsoft.Web/staticSites``

## Tasks
- [ ] Create ``kaist-ai-infra/modules/staticwebapp.bicep``
- [ ] Define Static Web Apps resource (Free SKU for now)
- [ ] Expose ``AZURE_STATIC_WEB_APP_URL`` (default hostname) as a Bicep output
- [ ] Reference module from ``main.bicep``

## References
- ``docs/implementation-plan.md`` — section 1.2.4
"@ `
    @("infrastructure", "phase-1")

$issue125 = New-GitHubIssue `
    "[Infra] Add Key Vault + Managed Identity for secrets management" `
    @"
## Overview
Centralise all secrets and remove raw key outputs from ``main.bicep``.
Grant the Function App a system-assigned managed identity with Key Vault Secrets User role.

## Resources to add
- ``Microsoft.KeyVault/vaults``
- ``Microsoft.Authorization/roleAssignments`` (Key Vault Secrets User)

## Tasks
- [ ] Create ``kaist-ai-infra/modules/keyvault.bicep``
- [ ] Define Key Vault (soft delete enabled, RBAC auth model)
- [ ] Enable system-assigned managed identity on the Function App
- [ ] Grant Function App managed identity the ``Key Vault Secrets User`` role
- [ ] Store Cosmos DB key and Storage Account keys as Key Vault secrets
- [ ] Replace raw key outputs in ``main.bicep`` with Key Vault secret URI references
- [ ] Reference module from ``main.bicep``

## Security note
Current ``main.bicep`` outputs ``cosmosDbAccountKey`` and Storage Account keys in plain text.
This must be resolved before any environment is provisioned.

## References
- ``docs/implementation-plan.md`` — section 1.2.5
"@ `
    @("infrastructure", "phase-1")

$issue13 = New-GitHubIssue `
    "[Infra] Modularize Bicep into modules/ structure" `
    @"
## Overview
Refactor the monolithic ``main.bicep`` into focused module files for maintainability.

## Target structure
``````
kaist-ai-infra/
├── main.bicep                  # Orchestrator only
├── modules/
│   ├── storage.bicep           # PDF storage account + blob container
│   ├── cosmos.bicep            # Cosmos DB account, database, container
│   ├── functions.bicep         # Function storage, App Service Plan, Function App
│   ├── monitoring.bicep        # Log Analytics + Application Insights
│   ├── staticwebapp.bicep      # Static Web Apps
│   └── keyvault.bicep          # Key Vault + role assignments
└── scripts/
    └── post-provision.sh
``````

## Tasks
- [ ] Move existing resources from ``main.bicep`` into appropriate module files
- [ ] Update ``main.bicep`` to be an orchestrator (module calls only + outputs)
- [ ] Verify ``bicep build main.bicep`` passes with no errors or warnings
- [ ] Verify ``azd provision`` completes successfully end-to-end

## Notes
This is a refactoring task — no new resources are added here.
All new resources (issues 1.2.1–1.2.5) should be created directly in their modules.

## References
- ``docs/implementation-plan.md`` — section 1.4
"@ `
    @("infrastructure", "phase-1")

$issue14 = New-GitHubIssue `
    "[Infra] Update azure.yaml with api and web service stubs" `
    @"
## Overview
Add ``api`` and ``web`` service stubs to ``azure.yaml`` so ``azd`` can manage the full lifecycle in Phase 2 and 3.

## Current state
``azure.yaml`` only references the infra project; no services are declared for Functions or Web App.

## Target state
``````yaml
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
``````

## Tasks
- [ ] Update ``azure.yaml`` with api and web service entries
- [ ] Verify ``azd`` recognises the services (``azd show``)

## References
- ``docs/implementation-plan.md`` — section 1.3
"@ `
    @("infrastructure", "phase-1")

# ---------------------------------------------------------------------------
# 3. Phase 1 parent tracking issue
# ---------------------------------------------------------------------------
Write-Host "`n[Step 3] Creating Phase 1 parent tracking issue..."
$phase1 = New-GitHubIssue `
    "[Phase 1] Infrastructure Setup (kaist-ai-infra/)" `
    @"
## Phase 1: Infrastructure

Provision all Azure resources needed for the full system so that Phase 2 and 3 can deploy into a ready environment.
All work lives in ``kaist-ai-infra/`` — Bicep templates and deployment scripts.

## Sub-tasks
- [ ] #$issue121 Add Log Analytics Workspace + Application Insights
- [ ] #$issue122 Add Azure Functions App resource to Bicep
- [ ] #$issue123 Add Cosmos DB Database and Container (hybrid search)
- [ ] #$issue124 Add Azure Static Web Apps resource stub
- [ ] #$issue125 Add Key Vault + Managed Identity
- [ ] #$issue13 Modularize Bicep into modules/ structure
- [ ] #$issue14 Update azure.yaml with api and web service stubs

## Acceptance Criteria
- [ ] ``azd provision`` completes without errors in ``koreacentral``
- [ ] All resources are present in the Azure portal
- [ ] Cosmos DB container has vector search policy and full-text index applied
- [ ] Function App is reachable (health-check endpoint returns 200)
- [ ] Application Insights receives telemetry from the Function App
- [ ] No raw secrets appear in Bicep outputs (Key Vault or managed identity used)
- [ ] ``bicep build main.bicep`` produces no errors/warnings

## References
- ``docs/implementation-plan.md`` — Phase 1
- ``docs/specification.md`` — Infrastructure section
"@ `
    @("infrastructure", "phase-1")

# ---------------------------------------------------------------------------
# 4. Phase 2 issue
# ---------------------------------------------------------------------------
Write-Host "`n[Step 4] Creating Phase 2 issue..."
$phase2 = New-GitHubIssue `
    "[Phase 2] API Functions (kaist-ai-functions/) — Deferred" `
    @"
## Phase 2: API Functions

> Not in scope for the current sprint. Defined here for planning purposes.

All work lives in ``kaist-ai-functions/`` — Azure Functions (Python 3.11).

## Planned Endpoints

| Method | Path | Description |
|--------|------|-------------|
| ``POST``   | ``/api/documents``        | Upload and process a PDF |
| ``GET``    | ``/api/documents``        | List uploaded documents |
| ``DELETE`` | ``/api/documents/{id}``   | Delete a document and its embeddings |
| ``POST``   | ``/api/chat``             | Submit a question, receive an answer |
| ``GET``    | ``/api/health``           | Health check |

## Key Dependencies (from Phase 1)
- Cosmos DB container with vector + full-text index
- PDF Blob Storage container
- Application Insights connection string
- Key Vault for secrets
- ``kaist-ai-functions/`` directory and scaffold

## References
- ``docs/implementation-plan.md`` — Phase 2
- ``docs/specification.md`` — API Server section
"@ `
    @("phase-2")

# ---------------------------------------------------------------------------
# 5. Phase 3 issue
# ---------------------------------------------------------------------------
Write-Host "`n[Step 5] Creating Phase 3 issue..."
$phase3 = New-GitHubIssue `
    "[Phase 3] Web App (kaist-ai-webapp/) — Deferred" `
    @"
## Phase 3: Web App

> Not in scope for the current sprint. Defined here for planning purposes.

All work lives in ``kaist-ai-webapp/`` — React + Vite + TypeScript client.

## Stack
- React + Vite + TypeScript
- Tailwind CSS
- Deployed to Azure Static Web Apps (provisioned in Phase 1)

## Key Features
- PDF upload UI
- Chat interface for Q&A
- Connected to Phase 2 API via Static Web Apps linked backend
- Responsive design

## Key Dependencies (from Phase 1 + 2)
- Static Web Apps resource (provisioned in Phase 1)
- API Functions endpoints (implemented in Phase 2)

## References
- ``docs/implementation-plan.md`` — Phase 3
- ``docs/specification.md`` — Client section
"@ `
    @("phase-3")

Write-Host "`n==========================================="
Write-Host "All issues created successfully!"
Write-Host "Phase 1 parent : #$phase1"
Write-Host "Phase 2        : #$phase2"
Write-Host "Phase 3        : #$phase3"
Write-Host "Sub-issues     : #$issue121, #$issue122, #$issue123, #$issue124, #$issue125, #$issue13, #$issue14"
Write-Host "==========================================="
