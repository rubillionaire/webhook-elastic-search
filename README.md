# webhook-elastic-search

Interface for interacting with the Elastic Search that backs a Webhook system.

To install: `npm install webhook-elastic-search`

Example:

```
var elasticOptions = {
  host: elasticHost,
  auth: {
    username: elasticUsername,
    password: elasticPassword,
  },
}

var elastic = WebHookElasticSearch(elasticOptions)

elastic.siteIndex(siteName)
  .then(siteIndex => console.log(siteIndex))
```

### API

`siteIndex(siteName) => Promise[siteIndex | error]` returns all documents in Elastic Search for the site. Where `siteName` is the Webhook site name. The promise returns `siteIndex`, an array of Elastic Search documents for the Webhook site.

`updateIndex({ siteName, siteData, siteIndex }) => Promise[results | error]` issues bulk commands that update the `siteIndex` to be in sync with the `siteData`. `siteData` is the current Firebase data node ( `/buckets/{site-name}/{site-key}/dev` ) for the Webhook site.

`indexSiteData({ siteName, siteData }) => Promise[results | error]` is a convenience method that runs `createIndex`, `siteIndex` & `updateIndex` for a given site. This will get you from nothing to complete usuable site index in one go.

`listIndicies({ verbose?, sort?, index? }) => Promise[indiciesTable | error]` returns `indicesTable`, a string that contains a table of indicies in the elastic cluster.

`createIndex({ siteName}) => Promise[results | error]` creates an index in the elastic cluster that can be used to store and query documents.

`deleteIndex({ siteName }) => Promise[results | error]` deletes an entire site index.

`queryIndex({ siteName, query, contentType?, page?, pageSize? }) => Promise[results | error]` returns the query results that match the query for the site index and optionally the specified content type.

`deleteDocument({ siteName, id }) => Promise[results | error]` deletes the document whose id matches for the given site.

`deleteContentType({ siteName, contentType }) => Promise[results | error]` delets all documents for the specified content type and site.

`indexDocument({ siteName, contentType, doc, id, oneOff? }) => Promise[results | error]` adds a document to the specified site index under the id and content type provided. Use the `oneOff` key to specify if the given content type is a one off.

### Test

Populate a `.env` file with the following environment variables:

```
ELASTIC_SEARCH_SERVER=
ELASTIC_SEARCH_USER=
ELASTIC_SEARCH_PASSWORD=
```

Run `npm test`
