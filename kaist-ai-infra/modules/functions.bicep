// Azure Functions module: storage account, consumption plan, function app (Python 3.11)

param location string
param resourceToken string
param tags object = {}
param appInsightsConnectionString string
param cosmosEndpoint string
param cosmosDatabaseName string
param cosmosContainerName string
param storageAccountName string
param storageContainerName string
param keyVaultEndpoint string

resource funcStorage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'kaistfunc${resourceToken}'
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
  }
}

resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: 'kaist-asp-${resourceToken}'
  location: location
  tags: tags
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  kind: 'functionapp'
  properties: {
    reserved: true // Linux
  }
}

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: 'kaistfunc${resourceToken}'
  location: location
  tags: union(tags, { 'azd-service-name': 'api' })
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'Python|3.11'
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${funcStorage.name};AccountKey=${funcStorage.listKeys().keys[0].value};EndpointSuffix=core.windows.net'
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'python'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        {
          name: 'AZURE_COSMOS_ENDPOINT'
          value: cosmosEndpoint
        }
        {
          name: 'AZURE_COSMOS_DATABASE_NAME'
          value: cosmosDatabaseName
        }
        {
          name: 'AZURE_COSMOS_CONTAINER_NAME'
          value: cosmosContainerName
        }
        {
          name: 'AZURE_STORAGE_ACCOUNT_NAME'
          value: storageAccountName
        }
        {
          name: 'AZURE_STORAGE_CONTAINER_NAME'
          value: storageContainerName
        }
        {
          name: 'AZURE_KEY_VAULT_ENDPOINT'
          value: keyVaultEndpoint
        }
      ]
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
    }
    httpsOnly: true
  }
}

output appName string = functionApp.name
output principalId string = functionApp.identity.principalId
output defaultHostName string = functionApp.properties.defaultHostName
