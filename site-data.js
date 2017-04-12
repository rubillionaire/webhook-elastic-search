var Firebase = require( 'firebase' );
var objectAssign = require( 'object-assign' )

module.exports = SiteData;


/**
 * Get the data for a webhook site.
 * The Firebase path is /buckets/{site-name}/{site-key}/dev
 *
 * opts.firebase is required when intializing.
 * opts.siteName & opts.key are optional when intializing. These
 * values can be passed in as options to `get` and `set`.
 * 
 * @param {object}   opts
 * @param {object}   opts.firebase  Firebase credentials 
 * @param {object}   opts.firebase.name    Firebase name
 * @param {object}   opts.firebase.secret  Firebase secret
 * @param {string}   opts.siteName  The name of the webhook site
 * @param {string}   opts.key       The key of the webhook site
 * @param {Function} callback       Function called with the site data
 */
function SiteData ( opts ) {
  if ( ! ( this instanceof SiteData ) ) return new SiteData( opts )
  if ( !opts ) opts = {}

  try {
    var firebaseName = opts.firebase.name;
    var firebaseSecret = opts.firebase.secret;
    var bucketsRoot = new Firebase( 'https://' + firebaseName + '.firebaseio.com/buckets' )
  } catch ( error ) {
    error.message = 'SiteData opts expects `name` & `secret`. The Firebase name, and secret key.'
    return callback( error )
  }

  return {
    get: getFirebaseData,
    set: setFirebaseData,
  }

  function getFirebaseData ( getOpts, callback ) {
    if ( typeof getOpts === 'function' ) {
      callback = getOpts;
      getOpts = objectAssign( {}, opts );
    }

    bucketsRoot.auth( firebaseSecret, function ( error ) {
      if ( error ) return callback( error )

      var dataRef = bucketsRoot.child( escapeSiteName( getOpts.siteName ) )
        .child( getOpts.key )
        .child( 'dev' );

      dataRef.once( 'value', onValue, onError )

    } )

    function onValue ( snapshot ) { callback( null, snapshot.val() ) }
    function onError ( error ) { callback( error ) }

  }

  function setFirebaseData ( siteData, setOpts, callback ) {
    if ( typeof setOpts === 'function' ) {
      callback = setOpts;
      setOpts = objectAssign( {}, opts )
    }

    bucketsRoot.auth( firebaseSecret, function ( error ) {
      if ( error ) return callback( error )

      var dataRef = bucketsRoot.child( escapeSiteName( setOpts.siteName ) )
        .child( setOpts.key )
        .child( 'dev' );

      dataRef.set( siteData, callback )

    } )

  }

}

function escapeSiteName ( siteName ) {
  return siteName.replace( /\./g, ',1' )
}
