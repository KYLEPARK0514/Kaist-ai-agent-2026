// Storage module: PDF Blob Storage account and container

param location string
param resourceToken string
param tags object = {}

resource pdfStorage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'kaistaipdf${resourceToken}'
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: pdfStorage
  name: 'default'
}

resource pdfsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'pdfs'
  properties: {
    publicAccess: 'None'
  }
}

output accountName string = pdfStorage.name
output containerName string = pdfsContainer.name
output accountId string = pdfStorage.id
