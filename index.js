var ElasticSearch = require( 'elasticsearch' )
var deepEqual = require( 'deep-equal' )
var objectAssign = require( 'object-assign' )

module.exports = WebHookElasticSearch;

/**
 * @param {object} opts
 * @param {string} opts.host
 * @param {string} opts.port
 * @param {string} opts.auth.username
 * @param {string} opts.auth.password
 */
function WebHookElasticSearch  ( opts ) {
  if ( ! ( this instanceof WebHookElasticSearch ) ) return new WebHookElasticSearch( opts )
  if ( !opts ) opts = {}

  var options = {
    host: opts.host,
    apiVersion: '6.6',
    httpAuth: `${ opts.auth.username }:${ opts.auth.password }`,
  }

  var globalTypeName = '_doc'

  var elastic = new ElasticSearch.Client( options )

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

    return elastic.bulk( { body: commands }, function ( error, results ) {
       if ( error ) return callback( error )
       if ( typeof results === 'string' ) {
         return callback( null, JSON.parse( results ) )
       }
       else {
         return callback( null, results )
       }
    } )

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
          return [{
            'delete': {
              '_index': indexedItem._index,
              '_type': indexedItem._type,
              '_id': indexedItem._id,
            }
          }]
        }
      }

      function UpdateForIndexedItem ( indexedItem ) {

        var updateObject = undefined;

        return {
          check: siteDataKeyComparison,
          action: bulkIndexAction,
        }

        function siteDataKeyComparison () {
          // update, or do nothing by default.
          // only update if you can successfully pull an item out of the site data
          // object using the keys of the indexed item, and if their underlying
          // data is the same. the item will update if the site data keys match
          // that of that indexedItem's _source.doc key is different.
          // If the indexedItem's keys ( ._id & ._source.contentType ) are not able
          // to get an item from the site data tree, that case will be handled by the
          // delete checking branch of for loop that called into this funciton.
          var needsUpdate = false;

          // indexedItem : { _id, _source: { doc: { name, ... }, contentType, oneOff } }
          // indexableSiteData : { name, ... }
          var indexableSiteDataItem = siteDataForIndexedItem( indexedItem )

          if ( deepEqual( indexedItem._source.doc, indexableSiteDataItem ) ) {
            needsUpdate = false;
          }
          else {
            needsUpdate = true;
            updateObject = {
              doc: indexableSiteDataItem,
              contentType: indexedItem._source.contentType,
              oneOff: indexedItem._source.oneOff,
            }
          }

          return needsUpdate;
        }


        function bulkIndexAction () {
          if ( typeof updateObject !== 'object' ) return [];

          var indexCommand = {
            'index': {
              '_index': indexedItem._index,
              '_type': globalTypeName,
              '_id': indexedItem._id,
            },
          }
          return [ indexCommand, updateObject ]
        }

      }

      function siteDataForIndexedItem ( indexedItem ) {
        try {
          if ( indexedItem._source.oneOff === true ) {
            return siteData.data[ indexedItem._source.contentType ]
          } else {
            return siteData.data[ indexedItem._source.contentType ][ indexedItem._id ]
          }
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

      // siteData & siteIndex as arrays of contentType!id strings
      var siteDataKeys = keysForSiteData( siteData )
      var siteIndexKeys = keysForSiteIndex( siteIndex )

      var actions = []
      for (var i = siteDataKeys.length - 1; i >= 0; i--) {
        // If the current site data key is not in the array of siteIndexKeys, push a create action
        if ( siteIndexKeys.indexOf( siteDataKeys[i] ) === -1 ) actions.push( createActionFor( siteDataKeys[ i ] ) )
      }

      return actions;

      function createActionFor ( siteDataKey ) {
        var splitKey = siteDataKey.split( keySeperator );
        var item_type = splitKey[ 0 ]
        var item_id = splitKey[ 1 ]
        var createCommand = {
          'index': {
            '_index': siteName,
            '_type': globalTypeName,
            '_id': item_id,
          }
        }
        var sourceObject = { contentType: item_type }
        if ( item_type === item_id ) {
          sourceObject.doc = siteData.data[ item_type ]
          sourceObject.oneOff = true;
        } else {
          sourceObject.doc = siteData.data[ item_type ][ item_id ]
          sourceObject.oneOff = false;
        }

        return [ createCommand, sourceObject ];
      }

      function keysForSiteData( siteData ) {
        var keys = []
        Object.keys( siteData.data ).forEach( function ( contentType ) {

          if ( siteData.contentType[ contentType ].oneOff ) {
            keys.push( keyForContentTypeItemId( contentType, contentType ) )
          } else {
            Object.keys( siteData.data[ contentType ] ).forEach( function ( itemId ) {
              keys.push( keyForContentTypeItemId( contentType, itemId ) )
            } )
          }

        } )

        return keys;
      }

      function keysForSiteIndex ( siteIndex ) {
        return siteIndex.map( keyForIndexedItem )
      }

      function keyForIndexedItem ( indexedItem ) {
        return keyForContentTypeItemId( indexedItem._source.contentType, indexedItem._id )
      }

      function keyForContentTypeItemId( contentType, itemId ) {
        return [ contentType, itemId ].join( keySeperator )
      }
    }
  }

  function siteEntries ( siteName, callback ) {
    var options = {
      index: siteName,
      body: {
        size: 10000,
        query: {
          match_all: {},
        },
      },
    }

    elastic.search( options, function onResults ( error, results ) {
      if ( error ) return callback( error );

      if ( !results.hits ) callback( null, [] )
      else callback( null, results.hits.hits )

    } )
  }
}
