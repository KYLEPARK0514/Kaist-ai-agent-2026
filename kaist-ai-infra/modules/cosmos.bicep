// CosmosDB module: Serverless account, kaistdb database, knowledge container
// Vector embedding policy uses dimensions=768 to match Gemini text-embedding-004

param location string
param resourceToken string
param tags object = {}

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' = {
  name: 'kaistcosmos${resourceToken}'
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    capabilities: [
      { name: 'EnableServerless' }
    ]
    enableFreeTier: false
  }
}

resource cosmosDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-11-15' = {
  parent: cosmosAccount
  name: 'kaistdb'
  properties: {
    resource: {
      id: 'kaistdb'
    }
  }
}

resource cosmosContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = {
  parent: cosmosDatabase
  name: 'knowledge'
  properties: {
    resource: {
      id: 'knowledge'
      partitionKey: {
        paths: [
          '/documentId'
        ]
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        includedPaths: [
          { path: '/*' }
        ]
        excludedPaths: [
          { path: '/embedding/*' }
        ]
      }
      vectorEmbeddingPolicy: {
        vectorEmbeddings: [
          {
            path: '/embedding'
            dataType: 'float32'
            dimensions: 768
            distanceFunction: 'cosine'
          }
        ]
      }
    }
  }
}

output endpoint string = cosmosAccount.properties.documentEndpoint
output accountName string = cosmosAccount.name
output databaseName string = cosmosDatabase.name
output containerName string = cosmosContainer.name
output accountId string = cosmosAccount.id
