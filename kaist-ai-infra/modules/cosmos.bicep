param location string
param uniqueSuffix string

var databaseName = 'kaistdb'
var containerName = 'knowledge'

resource cosmosDbAccount 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' = {
  name: 'kaistcosmos${uniqueSuffix}'
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    // EnableServerless: serverless capacity mode (no provisioned throughput)
    // EnableNoSQLVectorSearch: required for vectorEmbeddingPolicy and vector indexes
    // EnableNoSQLFullTextSearch: required for fullTextPolicy and fullTextIndexes (preview)
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
        isZoneRedundant: false
      }
    ]
    // Disable public network access metadata write — best practice
    disableLocalAuth: false
  }
}

resource cosmosDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-11-15' = {
  parent: cosmosDbAccount
  name: databaseName
  properties: {
    resource: {
      id: databaseName
    }
  }
}

// Container for knowledge base chunks with hybrid search (vector + full-text)
// IMPORTANT: vectorEmbeddingPolicy and vectorIndexes are immutable after creation.
resource cosmosContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = {
  parent: cosmosDatabase
  name: containerName
  properties: {
    resource: {
      id: containerName
      // Partition by documentId so all chunks of a document are co-located
      partitionKey: {
        paths: [ '/documentId' ]
        kind: 'Hash'
        version: 2
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/*' }
        ]
        excludedPaths: [
          // Exclude _etag from indexing
          { path: '/"_etag"/?' }
          // Exclude the raw embedding array — it is indexed only via vectorIndexes below
          { path: '/embedding/*' }
        ]
        // DiskANN supports up to 4096 dimensions; required for 1536-dim embeddings
        // (flat index type is limited to 505 dimensions)
        vectorIndexes: [
          {
            path: '/embedding'
            type: 'diskANN'
          }
        ]
        // fullTextIndexes is a preview property — BCP037 suppressed
        #disable-next-line BCP037
        fullTextIndexes: [
          {
            path: '/content'
          }
        ]
      }
      // Vector embedding policy: 1536-dim float32 cosine (OpenAI ada-002 / text-embedding-3-small)
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
      // fullTextPolicy is a preview property — BCP037 suppressed
      #disable-next-line BCP037
      fullTextPolicy: {
        defaultLanguage: 'en-US'
        fullTextPaths: [
          {
            path: '/content'
            language: 'en-US'
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
