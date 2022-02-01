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

const index = 'wh-elastic-test'

test.onFinish( function () { process.exit() } )

// test( 'setup', function ( t ) {

//   t.plan( 1 )

//   var siteName = process.env.SITE_NAME;

//   elastic.siteEntries( siteName, function ( error, siteIndex ) {
//     // siteIndex.map(d=>d._source.doc).forEach(d=>console.log(typeof d))
//     siteIndex.forEach(d=>{
//       Object.keys(d._source.doc).forEach((k) => {
//         console.log(typeof d._source.doc[k])
//       })
//     })
//     t.ok(true)
//     // var updateIndexOptions = {
//     //   siteName: siteName,
//     //   siteData: { data: siteData.data, contentType: siteData.contentType },
//     //   siteIndex: siteIndex,
//     // }

//     // search.updateIndex( updateIndexOptions, function ( error, results ) {

//     //   if ( error ) console.log( error )
//     //   else console.log( JSON.stringify( results ) )

//     //   t.ok( true, 'done' )
//     // } )
//   } )

// } )

test('list-all-indicies', (t) => {
  t.plan(1)
  elastic.listIndicies()
    .then((results) => {
      t.ok(true, 'successfully retrieved all indicies')
    })
    .catch((error) => {
      t.fail(error, 'failed to retrive all indices')
    })
})

test('create-test-index', (t) => {
  t.plan(1)
  elastic.createIndex({ index })
    .then((results) => {
      t.ok(results.acknowledged, 'successfully created test index')
    })
    .catch((error) => {
      t.fail(error, 'failed to create test index')
    })
})

test('create-test-index-already-exists', (t) => [
  t.plan(1)
  elastic.createIndex({ index })
    .then((results) => {
      t.fail(results, 'failed to fail creating the test index')
    })
    .catch((error) => {
      t.ok(error.message.indexOf('exists'), 'successfully failed to create test index a second time')
    })
])

/* --- make these tests/interfaces --- */
/* index site using site-backup.json */
/* query for page results you know exist */
/* delete one of the results */
/* query again for smaller set of page results */
/* delete the page type */
/* query again and ensure you get nothing back */
/* index a single item? query for it?
    this is done on the server, could be nice to have
    everything elastic related on the server in one place
    intead of in two modules with separate tasks */
/* --- notes --- */
/* may have to add a testDelay to these to ensure results from the
    previous step propogate out */

test('delete-test-index', (t) => {
  t.plan(1)
  elastic.deleteIndex({ index })
    .then((results) => {
      t.ok(results.acknowledged, 'successfully deleted test index')
    })
    .catch((error) => {
      t.fail(error, 'failed to delete test index')
    })
})
