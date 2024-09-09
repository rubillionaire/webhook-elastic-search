const fs = require('node:fs')
require( 'dotenv' ).config()

var WebHookElasticSearch = require( '../index.js' )
var cmsData = require( './site-backup.json' )

var test = require( 'brittle' )

var elasticOptions = {
  node: process.env.ELASTIC_SEARCH_SERVER,
  auth: {
    username: process.env.ELASTIC_SEARCH_USER,
    password: process.env.ELASTIC_SEARCH_PASSWORD,
  },
  tls: {
    ca: fs.readFileSync(process.env.ELASTIC_TLS_CERT_PATH),
    rejectUnauthorized: false,
  },
}

const elastic = WebHookElasticSearch(elasticOptions)

const siteName = 'wh-elastic-test'

// tests occur against live elastic cluster that takes
// time to become consistent
const delayed = function (p) {
  const testDelay = 8_000
  return new Promise((resolve) => {
    setTimeout(resolve, testDelay)
  })
}

test('list-all-indicies', async (t) => {

  // await delayed()
  try {
    const results = await elastic.listIndicies()
    t.ok(true, 'successfully retrieved all indicies')
    // results = \n delimited string of 
    const names = results.split('\n')
      .filter(s => s.trim().length > 0)
      .map(s => {
        const parts = s.split(' ')
        return parts[2]
      })
    console.log({names})
  }
  catch (error) {
    t.fail(error, 'failed to retrive all indices')
  }
  finally {
    t.end()
  }
})

test('create-test-index', async (t) => {

  // await delayed()
  try {
    const results = await elastic.createIndex({ siteName })
    t.ok(results.acknowledged, 'successfully created test index')
  }
  catch (error) {
    t.fail(error, 'failed to create test index')
  }
  finally {
    t.end()
  }
})

test('create-test-index-already-exists', async (t) => {

  await delayed()
  try {
    const results = await elastic.createIndex({ siteName })
    t.fail(results, 'failed to fail creating the test index')
  }
  catch (error) {
    t.ok(error.message.indexOf('exists'), 'successfully failed to create test index a second time')
  }
  finally {
    t.end()
  }
})

test('index-site', async (t) => {

  // await delayed()
  try {
    const results = await elastic.indexCmsData({ siteName, cmsData })
    console.log({results})
    t.ok(results?.errors === false, 'successfully indexed site data')
  }
  catch (error) {
    console.log({error})
    t.ok(error, 'successfully indexed site data')
  }
  finally {
    t.end()
  }
})

test('query-index-first', async (t) => {

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
  finally {
    t.end()
  }
})


test('delete-document', async (t) => {

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
  finally {
    t.end()
  }
})

test('query-index-second', async (t) => {

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
  finally {
    t.end()
  }
})

test('delete-content-type', async (t) => {

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
  finally {
    t.end()
  }
})

test('query-index-third', async (t) => {

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
  finally {
    t.end()
  }
})

test.skip('index-document', async (t) => {

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
  finally {
    t.end()
  }
})

test('query-index-fourth', async (t) => {

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
  finally {
    t.end()
  }
})

test('delete-test-index', async (t) => {

  // await delayed()
  try {
    const results = await elastic.deleteIndex({ siteName })
    t.ok(results.acknowledged, 'successfully deleted test index')
  }
  catch (error) {
    t.fail(error, 'failed to delete test index')
  }
  finally {
    t.end()
  }
})
