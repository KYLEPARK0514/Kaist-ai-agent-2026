param location string
param uniqueSuffix string

resource pdfStorageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'kaistaipdf${uniqueSuffix}'
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

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: pdfStorageAccount
  name: 'default'
}

resource pdfContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'pdfs'
  properties: {
    publicAccess: 'None'
  }
}

output storageAccountName string = pdfStorageAccount.name
output storageAccountId string = pdfStorageAccount.id
output containerName string = pdfContainer.name

#disable-next-line outputs-should-not-contain-secrets
output connectionString string = 'DefaultEndpointsProtocol=https;AccountName=${pdfStorageAccount.name};AccountKey=${pdfStorageAccount.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
