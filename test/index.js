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
const delayed = function (p) {
  const testDelay = 10_000
  return new Promise((resolve) => {
    setTimeout(resolve, testDelay)
  })
}

test.onFinish( function () { process.exit() } )

test('list-all-indicies', async (t) => {
  t.plan(1)

  await delayed()
  try {
    const results = await elastic.listIndicies()
    t.ok(true, 'successfully retrieved all indicies')
  }
  catch (error) {
    t.fail(error, 'failed to retrive all indices')
  }
})

test('create-test-index', async (t) => {
  t.plan(1)

  await delayed()
  try {
    const results = await elastic.createIndex({ siteName })
    t.ok(results.acknowledged, 'successfully created test index')
  }
  catch (error) {
    t.fail(error, 'failed to create test index')
  }
})

test('create-test-index-already-exists', async (t) => {
  t.plan(1)

  await delayed()
  try {
    const results = await elastic.createIndex({ siteName })
    t.fail(results, 'failed to fail creating the test index')
  }
  catch (error) {
    t.ok(error.message.indexOf('exists'), 'successfully failed to create test index a second time')
  }
})

test('index-site', async (t) => {
  t.plan(1)

  await delayed()
  try {
    const results = await elastic.indexSiteData({ siteName, siteData })
    t.ok(results, 'successfully indexed site data')
  }
  catch (error) {
    t.ok(results, 'successfully indexed site data')
  }
})

test('query-index-first', async (t) => {
  t.plan(1)

  await delayed()
  try {
    const results = await elastic.queryIndex({
      siteName,
      query: 'item',
      contentType: 'pages',
    })
    console.log({results})
    t.ok(results.length === 3, 'successfully queried site')
  }
  catch (error) {
    t.fail(error, 'failed to query site')
  }
})


test('delete-document', async (t) => {
  t.plan(1)

  await delayed()
  try {
    const results = await elastic.deleteDocument({
      siteName,
      id: '-Kh8b6MT7EJxal8GTQuR',
    })
    t.ok(results, 'successfully deleted document')
  }
  catch (error) {
    t.fail(error, 'failed to delete document')
  }
})

test('query-index-second', async (t) => {
  t.plan(1)

  await delayed()
  try {
    const results = await elastic.queryIndex({
      siteName,
      query: 'item',
      contentType: 'pages',
    })
    t.ok(results.length === 2, 'successfully queried site')
  }
  catch (error) {
    t.fail(error, 'failed to query site')
  }
})

test('delete-content-type', async (t) => {
  t.plan(1)

  await delayed()
  try {
    const results = await elastic.deleteContentType({
      siteName,
      contentType: 'pages',
    })
    t.ok(results, 'successfully deleted content type')
  }
  catch (error) {
    t.fail(error, 'failed to delete content type')
  }
})

test('query-index-third', async (t) => {
  t.plan(1)

  await delayed()
  try {
    const results = await elastic.queryIndex({
      siteName,
      query: 'item',
      contentType: 'pages',
    })
    t.ok(results.length === 0, 'successfully queried site')
  }
  catch (error) {
    t.fail(error, 'failed to query site')
  }
})

test('index-document', async (t) => {
  t.plan(1)

  const doc = {
    "name": "freshly indexed page",
  }

  await delayed()
  try {
    const results = await elastic.indexDocument({
      siteName,
      contentType: 'pages',
      doc,
      id: '-this-is-an-id',
      oneOff: false,
    })
    t.ok(results, 'successfully indexed document')
  }
  catch (error) {
    t.fail(error, 'failed to index document')
  }
})

test('query-index-fourth', async (t) => {
  t.plan(1)

  await delayed()
  try {
    const results = await elastic.queryIndex({
      siteName,
      query: 'freshly',
      contentType: 'pages',
    })
    t.ok(results.length === 1, 'successfully queried site')
  }
  catch (error) {
    t.fail(error, 'failed to query site')
  }
})

test('delete-test-index', async (t) => {
  t.plan(1)

  await delayed()
  try {
    const results = await elastic.deleteIndex({ siteName })
    t.ok(results.acknowledged, 'successfully deleted test index')
  }
  catch (error) {
    t.fail(error, 'failed to delete test index')
  }
})
