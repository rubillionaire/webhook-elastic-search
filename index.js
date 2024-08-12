const { Client } = require('@elastic/elasticsearch')
var deepEqual = require('deep-equal')

module.exports = WebHookElasticSearch;

/**
 * All elastic interfaces for the webhook platform are
 * captured within this module.
 *
 * @param {object} opts
 * @param {string} opts.host
 * @param {string} opts.port
 * @param {string} opts.auth.username
 * @param {string} opts.auth.password
 */
function WebHookElasticSearch  ( opts ) {
  if (!(this instanceof WebHookElasticSearch)) return new WebHookElasticSearch(opts)
  if (!opts) opts = {}

  var elastic = new Client( opts )

  return {
    siteIndex,
    updateIndex,
    indexCmsData,
    listIndicies,
    createIndex,
    deleteIndex,
    queryIndex,
    deleteDocument,
    deleteContentType,
    indexDocument,
  }

  /**
   * Does the input conform to shape like "2017-04-07T14:10:00-04:00"
   * 
   * @param  {string}  str [description]
   * @return {Boolean}     [description]
   */
  function isDateString (str) {
    var ISO_8601 = /^\d{4}(-\d\d(-\d\d(T\d\d:\d\d(:\d\d)?(\.\d+)?(([+-]\d\d:\d\d)|Z)?)?)?)?$/i
    return ISO_8601.test(str)
  }

  /**
   * Prepare an object for storage in elastic by stringifying
   * the object. We were previously flattening all of the keys
   * into different fields, but on a CMS of sufficient size,
   * we were running into a max field limit of 1000 fields.
   * 
   * @param  {object | string} obj
   * @return {string} doc
   */
  function docFromObj (obj) {
    if (typeof obj === 'string') return obj
    if (typeof obj === 'object') return JSON.stringify(obj)
    return obj
  }

  /**
   * Use the siteData and siteIndex to determine which objects
   * need to be stored, updated or deleted.
   * 
   * @param  {object} options
   * @param  {string} options.siteName
   * @param  {object} options.cmsData
   * @param  {array} options.elasticData
   * @return {promise} results | error
   */
  function updateIndex (options) {
    var createActions = CreateActions(options)
    var updateOrDeleteActions = UpdateOrDeleteActions(options)

    var commands = createActions.concat(updateOrDeleteActions)
      .reduce(function (previous, current) {
        return previous.concat( current )
      },[])

    if (commands.length === 0) return []

    return elastic.bulk({ body: commands })

    function UpdateOrDeleteActions ( options ) {
      var siteName = unescapeFirebaseStr(options.siteName)
      var cmsData = options.cmsData;
      var elasticData = options.elasticData;

      var bulkActions = []

      // Delete / Update from site index
      for (var i = elasticData.length - 1; i >= 0; i--) {
        var deletor = DeletorForIndexedItem( elasticData[ i ] )
        // If the item is in the elasticData, but not the siteData
        if ( deletor.check() ) {
          // delete the indexed item if it is not in the site's data object
          bulkActions.push( deletor.action() )
          continue;
        }

        var updator = UpdateForIndexedItem( elasticData[ i ] )
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

          if ( deepEqual( indexedItem._source.doc, docFromObj(indexableSiteDataItem) ) ) {
            needsUpdate = false;
          }
          else {
            needsUpdate = true;
            updateObject = {
              doc: docFromObj( indexableSiteDataItem ),
              name: indexableSiteDataItem.name,
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
      var cmsData = options.cmsData;
      var elasticData = options.elasticData;

      var keySeperator = '!';

      // cmsData & elasticData as arrays of contentType!id strings
      var siteDataKeys = keysForCmsData( cmsData )
      var siteIndexKeys = keysForElasticData( elasticData )

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
            '_id': item_id,
          }
        }
        var sourceObject = { contentType: item_type }
        if ( item_type === item_id ) {
          sourceObject.doc = docFromObj( cmsData.data[ item_type ] )
          sourceObject.oneOff = true;
          sourceObject.name = cmsData.data[ item_type ].name;
        } else {
          sourceObject.doc = docFromObj( cmsData.data[ item_type ][ item_id ] )
          sourceObject.oneOff = false;
          sourceObject.name = cmsData.data[ item_type ][ item_id ].name;
        }

        return [ createCommand, sourceObject ];
      }

      function keysForCmsData( cmsData ) {
        var keys = []
        Object.keys( cmsData.data ).forEach( function ( contentType ) {

          if ( cmsData.contentType[ contentType ].oneOff ) {
            keys.push( keyForContentTypeItemId( contentType, contentType ) )
          } else {
            Object.keys( cmsData.data[ contentType ] ).forEach( function ( itemId ) {
              keys.push( keyForContentTypeItemId( contentType, itemId ) )
            } )
          }

        } )

        return keys;
      }

      function keysForElasticData ( elasticData ) {
        return elasticData.map( keyForIndexedItem )
      }

      function keyForIndexedItem ( indexedItem ) {
        return keyForContentTypeItemId( indexedItem._source.contentType, indexedItem._id )
      }

      function keyForContentTypeItemId( contentType, itemId ) {
        return [ contentType, itemId ].join( keySeperator )
      }
    }
  }

  /**
   * Given a siteName, return an array of all indexed objects.
   * 
   * @param  {string} siteName
   * @return {promise} results | error
   */
  async function siteIndex (siteName) {
    var options = {
      index: unescapeFirebaseStr(siteName),
      body: {
        size: 10000,
        query: {
          match_all: {},
        },
      },
    }
    try {
      const results = await elastic.search(options)
      return results.hits.hits
    }
    catch (error) {
      console.log({error})
      return []
    }
  }

  /**
   * Given a siteName and cmsData (a snapshot of all the site's data)
   * gather the site index entries (this.siteIndex) and execute the
   * update method (this.updateIndex).
   * 
   * @param  {object} options
   * @param  {string} options.siteName
   * @param  {object} options.cmsData
   * @return {promise} results | error
   */
  async function indexCmsData ({ siteName, cmsData }) {
    siteName = unescapeFirebaseStr(siteName)

    try {
      await createIndex({ siteName })
    }
    catch (error) {
      if (error.message.indexOf('exists') > -1) {
        // continue
      }
      else {
        throw error
      }
    }

    const elasticData = await siteIndex(siteName)
    return updateIndex({ siteName, cmsData, elasticData })
  }

  /**
   * List all indices in the elastic cluster. There should
   * be one for every webhook site instance on the platform.
   * 
   * @param  {object} options
   * @param  {Boolean} options.verbose
   * @param  {String} options.sort
   * @param  {String}  options.index
   * @return {Promise} rsults:string | error
   */
  function listIndicies ({
    index = '*'
  } = {}) {
    return elastic.cat.indices({
      index,
    })
  }

  /**
   * Creats an index for the given siteName. Must be run
   * in order to put documents into the index.
   * 
   * @param {object} options
   * @param {string} options.siteName
   * @return {promise} results | error
   */
  function createIndex ({ siteName }) {
    const index = unescapeFirebaseStr(siteName)
    return elastic.indices.create({ index }) 
  }

  /**
   * Deletes an index for the given siteName.
   * 
   * @param {string} options.siteName [description]
   * @return {promise} results | error
   */
  function deleteIndex ({ siteName }) {
    const index = unescapeFirebaseStr(siteName)
    return elastic.indices.delete({ index })
  }

  /**
   * Query an index and retult results.
   * 
   * @param {object} options
   * @param {string} options.siteName
   * @param {string} options.query
   * @param {string} options.contentType
   * @param {Number} options.page
   * @param {Number} options.pageSize
   * @return {promise} results | error
   */
  function queryIndex ({
    siteName,
    query,
    contentType,
    page = 1,
    pageSize = 10,
  }) {
    const index = unescapeFirebaseStr(siteName)
    page = page < 1 ? 1 : page
    query = query.startsWith('*') ? query : `*${query}`
    query = query.endsWith('*') ? query : `${query}*`

    const body = {
      from: (page - 1) * pageSize,
      size: pageSize,
      highlight: {
        fields: {
          '*' : {},
        },
        encoder: "html",
      }
    }

    const baseQuery = {
      "multi_match": {
        fields: ["name^5", "doc"],
        type: "phrase_prefix",
        query,
      }
    }
    if (contentType) {
      body.query = {
        bool: {
          must: baseQuery,
          filter: {
            term: {
              contentType,
            },
          },
        },
      }
    }
    else {
      body.query = baseQuery
    }

    return new Promise((resolve, reject) => {
      elastic.search({ index, body })
        .then((results) => {
          if (results.hits && results.hits.hits) {
            return resolve(results.hits.hits.map(prepForCMS))
          }
          resolve([])
        })
        .catch(reject)
    })

    function prepForCMS ( result ) {
      // map our custom type back to the CMS expected `_type` key
      result._type = result._source.contentType;
      // map our nested doc.name field to the CMS expected highlight name field
      result.highlight = {
        name: result.highlight && result.highlight[ 'name' ]
          ? result.highlight[ 'name' ]
          : [ result._source.name ],
      }
      result.fields = {
        name: result._source.name,
        __oneOff: result._source.oneOff,
      }
      return result;
    }
  }

  /**
   * Deletes a single document from an index
   * using its id.
   * @param {object} options
   * @param {string} options.siteName
   * @param {string} options.id
   * @return {promise} results | error
   */
  function deleteDocument ({ siteName, id }) {
    const index = unescapeFirebaseStr(siteName)
    const options = {
      index,
      id,
    }
    return elastic.delete(options)
  }

  /**
   * Delete all documents of a particular content type.
   * 
   * @param {object} options.siteName
   * @param {string} options.siteName
   * @param {string} options.contentType
   * @return {promise} results | error
   */
  function deleteContentType ({ siteName, contentType }) {
    const index = unescapeFirebaseStr(siteName)
    const options = {
      index,
      body: {
        query: {
          term: {
            contentType,
          },
        },
      },
    }
    return elastic.deleteByQuery(options)
  }

  /**
   * Index a single doucment.
   * 
   * @param {object}  options
   * @param {string}  options.siteName
   * @param {string}  options.contentType
   * @param {object}  options.doc
   * @param {string}  options.id
   * @param {Boolean} options.oneOff
   * @return {promise} results | error
   */
  function indexDocument ({
    siteName,
    contentType,
    doc,
    id,
    oneOff = false,
  }) {
    const index = unescapeFirebaseStr(siteName)
    let name
    if (typeof doc === 'object') {
      name = doc.name
      doc = JSON.stringify(doc)
    }
    if (typeof doc === 'string') {
      const _doc = JSON.parse(doc)
      name = _doc.name
    }
    const options = {
      index,
      id,
      body: {
        doc,
        oneOff,
        contentType,
        name,
      },
    }
    return elastic.index(options)
  }
}

function unescapeFirebaseStr (str) {
  return str.replace(/,1/g, '.')
}
