require( 'dotenv' ).config()

var WebHookElasticSearch = require( '../index.js' )
var siteData = require( './site-backup.json' )

var test = require( 'tape' )

var elasticOptions = {
  host: process.env.ELASTIC_SEARCH_SERVER,
  port: 9200,
  auth: {
    username: process.env.ELASTIC_SEARCH_USER,
    password: process.env.ELASTIC_SEARCH_PASSWORD,
  },
}

const elastic = WebHookElasticSearch(elasticOptions)

const siteName = 'wh-elastic-test'

// tests occur against live elastic cluster that takes
// time to become consistent
const testDelay = 5000

test.onFinish( function () { process.exit() } )

test('list-all-indicies', (t) => {
  t.plan(1)

  setTimeout(listIndicies, testDelay)

  function listIndicies () {
    elastic.listIndicies()
      .then((results) => {
        t.ok(true, 'successfully retrieved all indicies')
      })
      .catch((error) => {
        t.fail(error, 'failed to retrive all indices')
      })
  }
})

test('create-test-index', (t) => {
  t.plan(1)

  setTimeout(createIndex, testDelay)

  function createIndex () {
    elastic.createIndex({ siteName })
      .then((results) => {
        t.ok(results.acknowledged, 'successfully created test index')
      })
      .catch((error) => {
        t.fail(error, 'failed to create test index')
      })    
  }
})

test('create-test-index-already-exists', (t) => {
  t.plan(1)

  setTimeout(createIndex, testDelay)

  function createIndex() {
    elastic.createIndex({ siteName })
      .then((results) => {
        t.fail(results, 'failed to fail creating the test index')
      })
      .catch((error) => {
        t.ok(error.message.indexOf('exists'), 'successfully failed to create test index a second time')
      })    
  }
})

test('index-site', (t) => {
  t.plan(1)

  setTimeout(indexSiteData, testDelay)

  function indexSiteData () {
    elastic.indexSiteData({ siteName, siteData })
      .then((results) => {
        t.ok(results, 'successfully indexed site data')
      })
      .catch((error) => {
        t.fail(error, 'failed to index site data')
      })
  }
})

test('query-index-first', (t) => {
  t.plan(1)
  setTimeout(queryIndex, 0)
  function queryIndex () {
    elastic.queryIndex({
      siteName,
      query: 'item',
      contentType: 'pages',
    }).then((results) => {
        t.ok(results.length === 3, 'successfully queried site')
      })
      .catch((error) => {
        t.fail(error, 'failed to query site')
      })
  }
})


test('delete-document', (t) => {
  t.plan(1)

  setTimeout(deleteDocument, testDelay)

  function deleteDocument () {
    elastic.deleteDocument({
      siteName,
      id: '-Kh8b6MT7EJxal8GTQuR',
    }).then((results) => {
        t.ok(results, 'successfully deleted document')
      })
      .catch((error) => {
        t.fail(error, 'failed to delete document')
      })
  }
})

test('query-index-second', (t) => {
  t.plan(1)

  setTimeout(queryIndex, testDelay)

  function queryIndex () {
    elastic.queryIndex({
      siteName,
      query: 'item',
      contentType: 'pages',
    }).then((results) => {
        t.ok(results.length === 2, 'successfully queried site')
      })
      .catch((error) => {
        t.fail(error, 'failed to query site')
      })
  }
})

test('delete-content-type', (t) => {
  t.plan(1)

  setTimeout(deleteContentType, testDelay)

  function deleteContentType () {
    elastic.deleteContentType({
      siteName,
      contentType: 'pages',
    }).then((results) => {
        t.ok(results, 'successfully deleted content type')
      })
      .catch((error) => {
        t.fail(error, 'failed to delete content type')
      })
  }
})

test('query-index-third', (t) => {
  t.plan(1)

  setTimeout(queryIndex, testDelay)

  function queryIndex () {
    elastic.queryIndex({
      siteName,
      query: 'item',
      contentType: 'pages',
    }).then((results) => {
      console.log(results)
        t.ok(results.length === 0, 'successfully queried site')
      })
      .catch((error) => {
        t.fail(error, 'failed to query site')
      })
  }
})

test('index-document', (t) => {
  t.plan(1)

  const doc = {
    "name": "freshly indexed page",
  }

  setTimeout(indexDocument, testDelay)

  function indexDocument () {
    elastic.indexDocument({
      siteName,
      contentType: 'pages',
      doc,
      id: '-this-is-an-id',
      oneOff: false,
    }).then((results) => {
        t.ok(results, 'successfully indexed document')
      })
      .catch((error) => {
        t.fail(error, 'failed to index document')
      })
  }
})

test('query-index-fourth', (t) => {
  t.plan(1)
  setTimeout(queryIndex, testDelay)
  function queryIndex () {
    elastic.queryIndex({
      siteName,
      query: 'freshly',
      contentType: 'pages',
    }).then((results) => {
        t.ok(results.length === 1, 'successfully queried site')
      })
      .catch((error) => {
        t.fail(error, 'failed to query site')
      })
  }
})

test('delete-test-index', (t) => {
  t.plan(1)

  setTimeout(deleteIndex, testDelay)

  function deleteIndex () {
    elastic.deleteIndex({ siteName })
      .then((results) => {
        t.ok(results.acknowledged, 'successfully deleted test index')
      })
      .catch((error) => {
        t.fail(error, 'failed to delete test index')
      })
  }
})
