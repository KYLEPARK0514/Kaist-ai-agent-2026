// Main entry point for KAIST AI Agent infrastructure
// Region: koreacentral | Resource group: kaist-ai-agent-rg

targetScope = 'resourceGroup'

@description('Azure region for all resources')
param location string = 'koreacentral'

@description('Environment name (used by azd)')
param environmentName string

@description('Principal ID of the deploying user (optional, for Key Vault access)')
param principalId string = ''

var resourceToken = toLower(uniqueString(subscription().id, resourceGroup().id, environmentName))
var tags = {
  'azd-env-name': environmentName
}

module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring'
  params: {
    location: location
    resourceToken: resourceToken
    tags: tags
  }
}

module cosmos 'modules/cosmos.bicep' = {
  name: 'cosmos'
  params: {
    location: location
    resourceToken: resourceToken
    tags: tags
  }
}

module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: {
    location: location
    resourceToken: resourceToken
    tags: tags
  }
}

module keyVault 'modules/keyvault.bicep' = {
  name: 'keyvault'
  params: {
    location: location
    resourceToken: resourceToken
    tags: tags
    principalId: principalId
  }
}

module functions 'modules/functions.bicep' = {
  name: 'functions'
  params: {
    location: location
    resourceToken: resourceToken
    tags: tags
    appInsightsConnectionString: monitoring.outputs.connectionString
    cosmosEndpoint: cosmos.outputs.endpoint
    cosmosDatabaseName: cosmos.outputs.databaseName
    cosmosContainerName: cosmos.outputs.containerName
    storageAccountName: storage.outputs.accountName
    storageContainerName: storage.outputs.containerName
    keyVaultEndpoint: keyVault.outputs.endpoint
  }
}

module webapp 'modules/webapp.bicep' = {
  name: 'webapp'
  params: {
    location: 'eastasia' // Static Web Apps requires specific regions; eastasia closest to koreacentral
    resourceToken: resourceToken
    tags: tags
  }
}

output AZURE_STORAGE_ACCOUNT_NAME string = storage.outputs.accountName
output AZURE_STORAGE_CONTAINER_NAME string = storage.outputs.containerName
output AZURE_COSMOS_ENDPOINT string = cosmos.outputs.endpoint
output AZURE_COSMOS_DATABASE_NAME string = cosmos.outputs.databaseName
output AZURE_COSMOS_CONTAINER_NAME string = cosmos.outputs.containerName
output AZURE_FUNCTIONS_APP_NAME string = functions.outputs.appName
output AZURE_STATIC_WEB_APP_URL string = webapp.outputs.defaultHostName
output APPLICATIONINSIGHTS_CONNECTION_STRING string = monitoring.outputs.connectionString
