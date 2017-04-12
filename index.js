var ElasticSearchClient = require( 'elasticsearchclient' )
var deepEqual = require( 'deep-equal' )
var objectAssign = require( 'object-assign' )

module.exports = WebHookElasticSearch;

/**
 * @param {object} opts
 * @param {string} opts.host
 * @param {string} opts.port
 * @param {string} opts.username
 * @param {string} opts.password
 */
function WebHookElasticSearch  ( opts ) {
  if ( ! ( this instanceof WebHookElasticSearch ) ) return new WebHookElasticSearch( opts )
  if ( !opts ) opts = {}

  var options = {
    host: stripPort( stripHost( opts.host ) ),
    port: opts.port || 9200,
    auth: {
      username: opts.username,
      password: opts.password,
    },
  }

  var elastic = new ElasticSearchClient( options )

  return {
    siteEntries: siteEntries,
    updateIndex: updateIndex,
  }

  /**
   * @param  {object}   options
   * @param  {string}   options.siteName
   * @param  {object}   options.siteData
   * @param  {object}   options.Index
   * @param  {Function} callback
   */
  function updateIndex ( options, callback ) {

    var createActions = CreateActions( options )
    var updateOrDeleteActions = UpdateOrDeleteActions( options )

    var commands = createActions.concat( updateOrDeleteActions )
      .reduce( function ( previous, current ) {
        return previous.concat( current )
      }, [] )

    if ( commands.length === 0 ) return callback( null, [] )

    return elastic.bulk(commands, callback)

    function UpdateOrDeleteActions ( options ) {
      var siteName = options.siteName;
      var siteData = options.siteData;
      var siteIndex = options.siteIndex;

      var bulkActions = []

      // Delete / Update from site index
      for (var i = siteIndex.length - 1; i >= 0; i--) {
        var deletor = DeletorForIndexedItem( siteIndex[ i ] )
        // If the item is in the siteIndex, but not the siteData
        if ( deletor.check() ) {
          // delete the indexed item if it is not in the site's data object
          bulkActions.push( deletor.action() )
          continue;
        }

        var updator = UpdateForIndexedItem( siteIndex[ i ] )
        if ( updator.check() ) {
          bulkActions.push( updator.action() )
          continue;
        }
      }

      return bulkActions;

      function DeletorForIndexedItem ( indexedItem ) {
        return {
          check: indexedItemNoLongerInSiteData,
          action: bulkDeleteAction,
        }

        function indexedItemNoLongerInSiteData () {
          try {
            return ( typeof siteDataForIndexedItem( indexedItem ) !== 'object' )
          } catch ( error ) {
            return true;
          }
        }

        function bulkDeleteAction () {
          return [{ 'delete': { '_index': indexedItem._index, '_type': indexedItem._type, '_id': indexedItem._id } }]
        }
      }

      function UpdateForIndexedItem ( indexedItem ) {

        var updateObject = undefined;

        return {
          check: siteDataKeyComparison,
          action: bulkIndexAction,
        }

        function siteDataKeyComparison () {
          var needsUpdate = false;
          // update, or do nothing by default
          siteDataItem = siteDataForIndexedItem( siteIndex[i] )

          var indexedDocument = objectAssign( {}, indexedItem._source )
          delete indexedDocument[ '__oneOff' ]

          if ( deepEqual( indexedDocument, siteDataItem  ) ) {
            needsUpdate = false;
          }
          else {
            needsUpdate = true;
            updateObject = objectAssign( {}, siteDataItem );
          }

          return needsUpdate;
        }


        function bulkIndexAction () {
          if ( typeof updateObject === 'undefined' ) return [];

          var indexCommand = { 'index': { '_index': indexedItem._index, '_type': indexedItem._type, '_id': indexedItem._id } }
          return [ indexCommand, updateObject ]
        }

      }

      function siteDataForIndexedItem ( indexedItem ) {
        try {
          return siteData[ indexedItem._type ][ indexedItem._id ]
        } catch ( error ) {
          return undefined;
        }
      }

    }

    function CreateActions ( options ) {
      var siteName = options.siteName;
      var siteData = options.siteData;
      var siteIndex = options.siteIndex;

      var keySeperator = '!';

      // siteData & siteIndex as arrays of _type!_id strings
      var siteDataKeys = keysForSiteData( siteData )
      var siteIndexKeys = keysForSiteIndex( siteIndex )

      var actions = []
      for (var i = siteDataKeys.length - 1; i >= 0; i--) {
        // If the current site data key is not in the array of siteIndexKeys, push a create action
        if ( siteIndexKeys.indexOf( siteDataKeys[i] ) === -1 ) actions.push( createActionFor( siteDataKeys[i] ) )
      }

      return actions;

      function createActionFor ( siteDataKey ) {
        var splitKey = siteDataKey.split( keySeperator );
        var item_type = splitKey[ 0 ]
        var item_id = splitKey[ 1 ]
        var createCommand = { 'create': { '_index': siteName, '_type': item_type, '_id': item_id  } }
        var documentObject = siteData[ item_type ][ item_id ];
        return [ createCommand, documentObject ];
      }

      function keysForSiteData( siteData ) {
        var key = []
        Object.keys( siteData ).forEach( function ( contentType ) {

          Object.keys( siteData[ contentType ] ).forEach( function ( itemId ) {

            key.push( keyForContentTypeItemId( contentType, itemId ) )

          } )

        } )

        return key;
      }

      function keysForSiteIndex ( siteIndex ) {
        return siteIndex.map( keyForIndexedItem )
      }

      function keyForIndexedItem ( indexedItem ) {
        return keyForContentTypeItemId( indexedItem._type, indexedItem._id )
      }

      function keyForContentTypeItemId( contentType, itemId ) {
        return [ contentType, itemId ].join( keySeperator )
      }
    }

  }

  function siteEntries ( siteName, callback ) {

    // elastic.search
    // all string arguments are passed in as the search path
    // all object arugments are turned into query strings for search
    // if the last argument is a function, its used as the callback
    return elastic.search( siteName, function onResults ( error, results ) {
      if ( error ) return callback( error );

      try {
        results = JSON.parse( results )
      } catch ( error ) {
        error.message = 'Could not JSON.parse search results.'
        return callback( error )
      }

      if ( !results.hits ) callback( null, [] )
      else callback( null, results.hits.hits )

    } )
  }

  function stripHost ( server ) {
    return server.replace( 'http://', '' ).replace( 'https://', '' )
  }

  function stripPort ( server ) {
    return server.split( ':' )[ 0 ]
  }

}
