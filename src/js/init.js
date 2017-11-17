( function ( w, d ) {

'use strict';

w.chrome = ( ( typeof browser != 'undefined' ) && browser.runtime ) ? browser : chrome;


function get_bool( value ) {
    if ( value === undefined ) {
        return null;
    }
    if ( ( value === '0' ) || ( value === 0 ) || ( value === false ) || ( value === 'false' ) ) {
        return false;
    }
    if ( ( value === '1' ) || ( value === 1 ) || ( value === true ) || ( value === 'true' ) ) {
        return true;
    }
    return null;
}  // end of get_bool()


function get_int( value ) {
    if ( isNaN( value ) ) {
        return null;
    }
    return parseInt( value, 10 );
} // end of get_int()


function get_text( value ) {
    if ( value === undefined ) {
        return null;
    }
    return String( value );
} // end of get_text()


function get_init_function( message_type, option_name_to_function_map, namespace ) {
    var option_names = [];
    
    Object.keys( option_name_to_function_map ).forEach( function ( option_name ) {
        option_names.push( option_name );
    } );
    
    function analyze_response( response ) {
        var options = {};
        
        if ( ! response ) {
            response = {};
        }
        
        Object.keys( option_name_to_function_map ).forEach( function ( option_name ) {
            if ( ! ( response.hasOwnProperty( option_name ) ) ) {
                options[ option_name ] = null;
                return;
            }
            options[ option_name ] =  option_name_to_function_map[ option_name ]( response[ option_name ] );
        } );
        return options;
    }
    
    function init( callback ) {
        // https://developer.chrome.com/extensions/runtime#method-sendMessage
        chrome.runtime.sendMessage( {
            type : message_type
        ,   names : option_names
        ,   namespace :  ( namespace ) ? namespace : ''
        }, function ( response ) {
            var options = analyze_response( response );
            callback( options );
        } );
    }
    
    return init;
} // end of get_init_function()


var twMediaDownloader_chrome_init = ( function() {
    var option_name_to_function_map = {
            OPERATION : get_bool
        ,   IMAGE_DOWNLOAD_LINK : get_bool
        ,   VIDEO_DOWNLOAD_LINK : get_bool
        ,   ENABLE_FILTER : get_bool
        };
    
    return get_init_function( 'GET_OPTIONS', option_name_to_function_map );
} )(); // end of twMediaDownloader_chrome_init()

w.is_chrome_extension = true;
w.twMediaDownloader_chrome_init = twMediaDownloader_chrome_init;

} )( window, document );

// ■ end of file
