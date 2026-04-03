param location string
param uniqueSuffix string
param functionAppPrincipalId string
param cosmosAccountName string
param pdfStorageAccountName string

resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name: 'kaist-kv-${uniqueSuffix}'
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
  }
}

// Reference existing resources to retrieve keys without exposing them as outputs
resource cosmosDbAccount 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' existing = {
  name: cosmosAccountName
}

resource pdfStorageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' existing = {
  name: pdfStorageAccountName
}

resource cosmosKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'cosmos-primary-key'
  properties: {
    value: cosmosDbAccount.listKeys().primaryMasterKey
  }
}

resource storageConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'pdf-storage-connection-string'
  properties: {
    value: 'DefaultEndpointsProtocol=https;AccountName=${pdfStorageAccount.name};AccountKey=${pdfStorageAccount.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
  }
}

// Grant Function App managed identity the Key Vault Secrets User role
// Role ID: 4633458b-17de-408a-b874-0445c86b69e0
resource kvSecretsUserRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, functionAppPrincipalId, '4633458b-17de-408a-b874-0445c86b69e0')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e0')
    principalId: functionAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
