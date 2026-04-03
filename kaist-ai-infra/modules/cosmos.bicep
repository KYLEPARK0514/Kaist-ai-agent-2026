// CosmosDB module — kaist-ai-infra/modules/cosmos.bicep
// Vector embedding dimensions: 768 (Google Gemini text-embedding-004)

@description('Location for all resources.')
param location string = resourceGroup().location

@description('Unique suffix appended to resource names to ensure global uniqueness.')
param uniqueSuffix string

@description('CosmosDB database name.')
param databaseName string = 'kaistdb'

@description('CosmosDB knowledge container name.')
param containerName string = 'knowledge'

// ---------------------------------------------------------------------------
// CosmosDB Account
// ---------------------------------------------------------------------------

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: 'kaistcosmos${uniqueSuffix}'
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
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
    databaseAccountOfferType: 'Standard'
    enableFreeTier: false
    capabilities: [
      {
        name: 'EnableNoSQLVectorSearch'
      }
    ]
  }
}

// ---------------------------------------------------------------------------
// CosmosDB Database
// ---------------------------------------------------------------------------

resource cosmosDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: cosmosAccount
  name: databaseName
  properties: {
    resource: {
      id: databaseName
    }
  }
}

// ---------------------------------------------------------------------------
// CosmosDB Container — knowledge
// Partition key : /documentId
// Vector index  : embedding (cosine, 768 dims — Gemini text-embedding-004)
// Full-text index: content  (BM25 for hybrid search)
// ---------------------------------------------------------------------------

resource knowledgeContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: cosmosDatabase
  name: containerName
  properties: {
    resource: {
      id: containerName
      partitionKey: {
        paths: [
          '/documentId'
        ]
        kind: 'Hash'
        version: 2
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: [
          {
            // Exclude the embedding array from standard index to save RU/s
            path: '/embedding/*'
          }
        ]
        #disable-next-line BCP037
        vectorIndexes: [
          {
            path: '/embedding'
            type: 'diskANN'
          }
        ]
        #disable-next-line BCP037
        fullTextIndexes: [
          {
            path: '/content'
          }
        ]
      }
      #disable-next-line BCP037
      vectorEmbeddingPolicy: {
        #disable-next-line BCP037
        vectorEmbeddings: [
          {
            path: '/embedding'
            dataType: 'float32'
            // TASK-001: Updated from 1536 → 768 to match Gemini text-embedding-004
            dimensions: 768
            distanceFunction: 'cosine'
          }
        ]
      }
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
    options: {
      autoscaleSettings: {
        maxThroughput: 4000
      }
    }
  }
}

// ---------------------------------------------------------------------------
// CosmosDB Container — conversations
// Partition key : /id
// ---------------------------------------------------------------------------

resource conversationsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: cosmosDatabase
  name: 'conversations'
  properties: {
    resource: {
      id: 'conversations'
      partitionKey: {
        paths: [
          '/id'
        ]
        kind: 'Hash'
        version: 2
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: []
      }
      defaultTtl: -1
    }
    options: {}
  }
}

// ---------------------------------------------------------------------------
// CosmosDB Container — messages
// Partition key : /conversationId
// ---------------------------------------------------------------------------

resource messagesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: cosmosDatabase
  name: 'messages'
  properties: {
    resource: {
      id: 'messages'
      partitionKey: {
        paths: [
          '/conversationId'
        ]
        kind: 'Hash'
        version: 2
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: []
      }
      defaultTtl: -1
    }
    options: {}
  }
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

output cosmosEndpoint string = cosmosAccount.properties.documentEndpoint
output cosmosDatabaseName string = databaseName
output cosmosContainerName string = containerName
output cosmosAccountName string = cosmosAccount.name
output cosmosConversationsContainerName string = conversationsContainer.name
output cosmosMessagesContainerName string = messagesContainer.name
