// Static Web Apps support a limited set of regions.
// eastasia is the closest supported region to koreacentral.
param location string = 'eastasia'
param uniqueSuffix string

resource staticWebApp 'Microsoft.Web/staticSites@2022-03-01' = {
  name: 'kaist-swa-${uniqueSuffix}'
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {}
}

output staticWebAppName string = staticWebApp.name
output staticWebAppUrl string = staticWebApp.properties.defaultHostname
