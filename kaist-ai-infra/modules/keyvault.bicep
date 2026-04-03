// Key Vault module: stores Cosmos DB key, Storage key, Google API key

param location string
param resourceToken string
param tags object = {}
param principalId string = ''

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'kaistakv${resourceToken}'
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
  }
}

// Grant the deploying principal Key Vault Secrets Officer role if provided
resource kvSecretsOfficer 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(principalId)) {
  name: guid(keyVault.id, principalId, 'Key Vault Secrets Officer')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7')
    principalId: principalId
    principalType: 'User'
  }
}

output name string = keyVault.name
output endpoint string = keyVault.properties.vaultUri
