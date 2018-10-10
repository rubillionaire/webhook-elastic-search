require( 'dotenv' ).config()

var WebHookElasticSearch = require( '../index.js' )
var siteData = require( './site-backup.json' )

var test = require( 'tape' )

test.onFinish( function () { process.exit() } )

test( 'setup', function ( t ) {

  t.plan( 1 )

  var siteName = process.env.SITE_NAME;

  var searchOptions = {
    host: process.env.ELASTIC_SEARCH_SERVER,
    username: process.env.ELASTIC_SEARCH_USER,
    password: process.env.ELASTIC_SEARCH_PASSWORD,
  }

  var search = WebHookElasticSearch( searchOptions )

  search.siteEntries( siteName, function ( error, siteIndex ) {
    var updateIndexOptions = {
      siteName: siteName,
      siteData: { data: siteData.data, contentType: siteData.contentType },
      siteIndex: siteIndex,
    }

    search.updateIndex( updateIndexOptions, function ( error, results ) {

      if ( error ) console.log( error )
      else console.log( JSON.stringify( results ) )

      t.ok( true, 'done' )
    } )
  } )

} )
