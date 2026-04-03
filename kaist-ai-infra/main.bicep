param location string = 'koreacentral'

var uniqueSuffix = uniqueString(resourceGroup().id)

module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring'
  params: {
    location: location
    uniqueSuffix: uniqueSuffix
  }
}

module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: {
    location: location
    uniqueSuffix: uniqueSuffix
  }
}

module cosmos 'modules/cosmos.bicep' = {
  name: 'cosmos'
  params: {
    location: location
    uniqueSuffix: uniqueSuffix
  }
}

module functions 'modules/functions.bicep' = {
  name: 'functions'
  params: {
    location: location
    uniqueSuffix: uniqueSuffix
    appInsightsConnectionString: monitoring.outputs.appInsightsConnectionString
    cosmosEndpoint: cosmos.outputs.cosmosEndpoint
    cosmosDatabaseName: cosmos.outputs.cosmosDatabaseName
    cosmosContainerName: cosmos.outputs.cosmosContainerName
  }
}

module staticwebapp 'modules/staticwebapp.bicep' = {
  name: 'staticwebapp'
  params: {
    uniqueSuffix: uniqueSuffix
  }
}

module keyvault 'modules/keyvault.bicep' = {
  name: 'keyvault'
  params: {
    location: location
    uniqueSuffix: uniqueSuffix
    functionAppPrincipalId: functions.outputs.functionAppPrincipalId
    cosmosAccountName: cosmos.outputs.cosmosAccountName
    pdfStorageAccountName: storage.outputs.storageAccountName
  }
}

// --- Outputs (no raw secrets) ---

output AZURE_STORAGE_ACCOUNT_NAME string = storage.outputs.storageAccountName
output AZURE_STORAGE_CONTAINER_NAME string = storage.outputs.containerName
output AZURE_COSMOS_ENDPOINT string = cosmos.outputs.cosmosEndpoint
output AZURE_COSMOS_DATABASE_NAME string = cosmos.outputs.cosmosDatabaseName
output AZURE_COSMOS_CONTAINER_NAME string = cosmos.outputs.cosmosContainerName
output AZURE_FUNCTIONS_APP_NAME string = functions.outputs.functionAppName
output AZURE_STATIC_WEB_APP_URL string = staticwebapp.outputs.staticWebAppUrl
output APPLICATIONINSIGHTS_CONNECTION_STRING string = monitoring.outputs.appInsightsConnectionString
output AZURE_KEY_VAULT_NAME string = keyvault.outputs.keyVaultName
output AZURE_KEY_VAULT_URI string = keyvault.outputs.keyVaultUri
