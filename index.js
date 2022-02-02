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
    siteIndex,
    updateIndex,
    indexSiteData,
    listIndicies,
    createIndex,
    deleteIndex,
    queryIndex,
    deleteDocument,
    deleteContentType,
    indexDocument,
  }

  /**
   * does the input conform to shape like "2017-04-07T14:10:00-04:00"
   * @param  {string}  str [description]
   * @return {Boolean}     [description]
   */
  function isDateString (str) {
    var ISO_8601 = /^\d{4}(-\d\d(-\d\d(T\d\d:\d\d(:\d\d)?(\.\d+)?(([+-]\d\d:\d\d)|Z)?)?)?)?$/i
    return ISO_8601.test(str)
  }

  function docFromObj (obj, prefix='') {
    let doc = {}
    Object.keys(obj).forEach((key) => {
      const doc_key = prefix ? `${prefix}_${key}` : key
      if (Array.isArray(obj[key])) {
        obj[key]
          .map((d, i) => {
            return docFromObj(d, `${doc_key}_${i}`)
          })
          .forEach((tmp) => {
            doc = Object.assign(doc, tmp)
          })
      }
      else if (typeof obj[key] === 'object' && obj[key] !== null) {
        // doc[key] = JSON.stringify(obj[key])
        const tmp = docFromObj(obj[key], doc_key)
        doc = Object.assign(doc, tmp)
      }
      else if (typeof obj[key] === 'number') {
        return
      }
      else if (isDateString(obj[key])) {
        return
      }
      else if (typeof obj[key] === 'boolean') {
        return
      }
      else {
        doc[doc_key] = obj[key]
      }
    })
    return doc
  }

  /**
   * @param  {object}   options
   * @param  {string}   options.siteName
   * @param  {object}   options.siteData
   * @param  {object}   options.siteIndex
   * @param  {Function} callback
   */
  function updateIndex (options) {

    var createActions = CreateActions(options)
    var updateOrDeleteActions = UpdateOrDeleteActions(options)

    var commands = createActions.concat(updateOrDeleteActions)
      .reduce(function (previous, current) {
        return previous.concat( current )
      },[])

    if (commands.length === 0) return Promise.resolve([])

    return new Promise((resolve, reject) => {
      elastic.bulk({ body: commands, requestTimeout: 120000 }, function (error, results) {
         if (error) return reject(error)
         return resolve(results)
      })
    })

    function UpdateOrDeleteActions ( options ) {
      var siteName = unescapeFirebaseStr(options.siteName)
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
          sourceObject.doc = docFromObj( siteData.data[ item_type ] )
          sourceObject.oneOff = true;
          sourceObject.name = siteData.data[ item_type ].name;
        } else {
          sourceObject.doc = docFromObj( siteData.data[ item_type ][ item_id ] )
          sourceObject.oneOff = false;
          sourceObject.name = siteData.data[ item_type ][ item_id ].name;
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

  function siteIndex (siteName) {
    var options = {
      index: siteName,
      body: {
        size: 10000,
        query: {
          match_all: {},
        },
      },
    }
    return new Promise((resolve, reject) => {
      elastic.search(options, function onResults (error, results) {
        if ( error ) return reject(error);

        if ( !results.hits ) resolve([])
        else resolve(results.hits.hits)
      })
    })
  }

  function indexSiteData ({ siteName, siteData }) {
    siteName = unescapeFirebaseStr(siteName)

    const ensureSiteIndexExists = () => {
      return new Promise((resolve, reject) => {
        elastic.indices.create({ index: siteName })
          .then(() => resolve())
          .catch((error) => {
            if (error.message.indexOf('exists') > -1) {
              return resolve()
            }
            reject()
          })
      })
    }

    return ensureSiteIndexExists()
      .then(() => {
        return siteIndex(siteName)    
      })
      .then((siteIndex) => {
        return updateIndex({ siteName, siteData, siteIndex })
      })
  }

  function listIndicies ({
    verbose = true,
    sort = 'docs.count:desc',
    index = '*'
  } = {}) {
    return elastic.cat.indices({
      v: verbose,
      s: sort,
      index,
    })
  }

  function createIndex ({ siteName }) {
    const index = unescapeFirebaseStr(siteName)
    return elastic.indices.create({ index }) 
  }

  function deleteIndex ({ siteName }) {
    const index = unescapeFirebaseStr(siteName)
    return elastic.indices.delete({ index })
  }

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
        fields: ["name^5", "doc.*"],
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

  function deleteDocument ({ siteName, id }) {
    const index = unescapeFirebaseStr(siteName)
    const options = {
      index,
      type: globalTypeName,
      id,
    }
    return elastic.delete(options)
  }

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

  function indexDocument ({
    siteName,
    contentType,
    doc,
    id,
    oneOff = false,
  }) {
    const index = unescapeFirebaseStr(siteName)
    if (typeof doc === 'string') doc = JSON.parse(doc)
    doc = docFromObj(doc)
    const options = {
      index,
      type: globalTypeName,
      id,
      body: {
        doc,
        oneOff,
        contentType,
        name: doc.name,
      },
    }
    return elastic.index(options)
  }
}

function unescapeFirebaseStr (str) {
  return str.replace(/,1/g, '.')
}
