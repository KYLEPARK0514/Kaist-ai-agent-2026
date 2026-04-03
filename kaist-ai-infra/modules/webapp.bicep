// Static Web App module: hosts the React client

param location string
param resourceToken string
param tags object = {}

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: 'kaist-swa-${resourceToken}'
  location: location
  tags: union(tags, { 'azd-service-name': 'web' })
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    buildProperties: {
      appLocation: '/'
      outputLocation: 'dist'
    }
  }
}

output name string = staticWebApp.name
output defaultHostName string = staticWebApp.properties.defaultHostname
