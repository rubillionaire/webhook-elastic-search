# webhook-elastc-search

Interface for interacting with the Elastic Search that backs a Webhook system.

To install: `npm install webhook-elastic-search`

Example:

```
var searchOptions = {
  host: elasticHost,
  username: elasticUsername,
  password: elasticPassword,
}

var search = WebHookElasticSearch( searchOptions )
search.siteEntries( siteName, function ( error, siteIndex ) {

  // siteIndex is an array of all Elastic Search
  // documents for the Webhook site
  
} )
```

### API

`siteEntries( siteName, callback )` returns all documents in Elastic Search for the site. Where `siteName` is the Webhook site name. The `callback` signature is `( error, siteIndex )` where `siteIndex` is an array of Elastic Search documents for the Webhook site.

`updateIndex( { siteName, siteData, siteIndex }, callback )` issues bulk commands that update the `siteIndex` to be in sync with the `siteData`. `siteData` is the current Firebase data node ( `/buckets/site-name/site-key/dev` ) for the Webhook site.


### CLI

The current `/bin/cli` is being used as a debugging utility. There is a hardcoded site name value captured under `npm run capture`, which will get all of the site's search index values.


### Test

To come.