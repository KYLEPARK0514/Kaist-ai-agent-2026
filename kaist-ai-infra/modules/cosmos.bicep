param location string
param uniqueSuffix string

resource cosmosDbAccount 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' = {
  name: 'kaistcosmos${uniqueSuffix}'
  location: location
  properties: {
    databaseAccountOfferType: 'Standard'
    capabilities: [
      { name: 'EnableServerless' }
      { name: 'EnableNoSQLVectorSearch' }
      { name: 'EnableNoSQLFullTextSearch' }
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

resource cosmosDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-11-15' = {
  parent: cosmosDbAccount
  name: 'kaistdb'
  properties: {
    resource: {
      id: 'kaistdb'
    }
  }
}

// Container with vector search policy and full-text index for hybrid search
resource cosmosContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = {
  parent: cosmosDatabase
  name: 'knowledge'
  properties: {
    resource: {
      id: 'knowledge'
      partitionKey: {
        paths: [ '/documentId' ]
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        includedPaths: [
          { path: '/*' }
        ]
        excludedPaths: [
          { path: '/"_etag"/?' }
          { path: '/embedding/*' }
        ]
        vectorIndexes: [
          {
            path: '/embedding'
            type: 'flat'
          }
        ]
        // fullTextIndexes not yet in Bicep type library (preview property) — suppress BCP037
        #disable-next-line BCP037
        fullTextIndexes: [
          {
            path: '/content'
          }
        ]
      }
      vectorEmbeddingPolicy: {
        vectorEmbeddings: [
          {
            path: '/embedding'
            dataType: 'float32'
            dimensions: 1536
            distanceFunction: 'cosine'
          }
        ]
      }
      // fullTextPolicy not yet in Bicep type library (preview property) — suppress BCP037
      #disable-next-line BCP037
      fullTextPolicy: {
        defaultLanguage: 'en-us'
        fullTextPaths: [
          {
            path: '/content'
            language: 'en-us'
          }
        ]
      }
    }
  }
}

output cosmosAccountName string = cosmosDbAccount.name
output cosmosEndpoint string = cosmosDbAccount.properties.documentEndpoint
output cosmosDatabaseName string = cosmosDatabase.name
output cosmosContainerName string = cosmosContainer.name
