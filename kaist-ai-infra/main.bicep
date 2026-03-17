param location string = 'koreacentral'
param resourceGroupName string = 'kaist-ai-agent-rg'

// Storage Account for PDF uploads (Blob Storage)
resource pdfStorageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'kaistaipdf${uniqueString(resourceGroup().id)}'
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

// Blob Container for PDFs
resource pdfContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: pdfStorageAccount
  name: 'pdfs'
  properties: {
    publicAccess: 'None'
  }
}

// Cosmos DB Account (Serverless with Vector Search for hybrid search)
resource cosmosDbAccount 'Microsoft.DocumentDB/databaseAccounts@2023-11-15' = {
  name: 'kaistcosmos${uniqueString(resourceGroup().id)}'
  location: location
  properties: {
    databaseAccountOfferType: 'Standard'
    capabilities: [
      {
        name: 'EnableServerless'
      }
      {
        name: 'EnableNoSQLVectorSearch'
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: [
      {
        locationName: location
        failoverPriority: 0
      }
    ]
  }
}

// Storage Account for Azure Functions (prerequisite)
resource functionStorageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'kaistfunc${uniqueString(resourceGroup().id)}'
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

// App Service Plan for Azure Functions (Consumption Plan)
resource functionAppServicePlan 'Microsoft.Web/serverfarms@2022-03-01' = {
  name: 'kaist-asp-${uniqueString(resourceGroup().id)}'
  location: location
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  properties: {}
}

// Outputs for azd compatibility
output pdfStorageAccountName string = pdfStorageAccount.name
output pdfStorageAccountKey string = pdfStorageAccount.listKeys().keys[0].value
output pdfContainerName string = pdfContainer.name
output cosmosDbAccountName string = cosmosDbAccount.name
output cosmosDbAccountEndpoint string = cosmosDbAccount.properties.documentEndpoint
output cosmosDbAccountKey string = cosmosDbAccount.listKeys().keys[0].value
output functionStorageAccountName string = functionStorageAccount.name
output functionStorageAccountKey string = functionStorageAccount.listKeys().keys[0].value
output functionAppServicePlanName string = functionAppServicePlan.name