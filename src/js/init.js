( function ( w, d ) {

'use strict';

w.chrome = ( ( typeof browser != 'undefined' ) && browser.runtime ) ? browser : chrome;

if ( chrome.runtime.lastError ) {
    console.log( '* chrome.runtime.lastError.message:', chrome.runtime.lastError.message );
}

var SCRIPT_NAME = 'twMediaDownloader';


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
            if ( ! ( Object.prototype.hasOwnProperty.call( response, option_name ) ) ) {
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


function async_set_values( name_value_map ) {
    
    return new Promise( function ( resolve, reject ) {
        chrome.storage.local.set( name_value_map, function () {
            resolve( name_value_map );
        } );
    } );
    
} // end of async_set_values()


function async_get_values( name_list ) {
    
    return new Promise( function ( resolve, reject ) {
        if ( typeof name_list == 'string' ) {
            name_list = [ name_list ];
        }
        
        chrome.storage.local.get( name_list, function ( name_value_map ) {
            name_list.forEach( function ( name ) {
                if ( name_value_map[ name ] === undefined ) {
                    name_value_map[ name ] = null;
                }
            } );
            
            resolve( name_value_map );
        } );
    } );
    
} // end of async_get_values()


var twMediaDownloader_chrome_init = ( function() {
    var option_name_to_function_map = {
            OPERATION : get_bool
        ,   IMAGE_DOWNLOAD_LINK : get_bool
        ,   VIDEO_DOWNLOAD_LINK : get_bool
        ,   OPEN_MEDIA_LINK_BY_DEFAULT : get_bool
        ,   ENABLE_ZIPREQUEST : get_bool
        ,   ENABLE_FILTER : get_bool
        ,   DOWNLOAD_SIZE_LIMIT_MB : get_int
        ,   ENABLE_VIDEO_DOWNLOAD : get_bool
        ,   INCOGNITO_MODE : get_bool
        ,   ENABLED_ON_TWEETDECK : get_bool
        ,   TAB_SORTING : get_bool
        ,   AUTO_CONTINUE : get_bool
        };
    
    return get_init_function( 'GET_OPTIONS', option_name_to_function_map );
} )(); // end of twMediaDownloader_chrome_init()


var extension_functions = ( () => {
    var tab_sorting_is_valid = ( ( default_value ) => {
            chrome.runtime.sendMessage( {
                type : 'GET_OPTIONS',
                names : [
                    'TAB_SORTING',
                ],
            }, ( response ) => {
                // ※オプションは非同期取得となるが、ユーザーがアクションを起こすまでに余裕があるので気にしない
                var tab_sorting_option_value = get_bool( response[ 'TAB_SORTING' ] );
                
                if ( tab_sorting_option_value !== null ) {
                    tab_sorting_is_valid = tab_sorting_option_value;
                }
            } );
            return default_value;
        } )( true ),
        
        reg_sort_index = new RegExp( '^request=tab_sorting&script_name=' + SCRIPT_NAME + '&request_id=(\\d+)&total=(\\d+)&sort_index=(\\d+)' ),
        
        open_multi_tabs = ( urls ) => {
            var request_id = '' + new Date().getTime(),
                window_name_prefix = 'request=tab_sorting&script_name=' + SCRIPT_NAME + '&request_id=' + request_id + '&total=' + urls.length + '&sort_index=';
            
            urls.reverse().forEach( ( url, index ) => {
                var sort_index = urls.length - index,
                    window_name = ( tab_sorting_is_valid ) ? ( window_name_prefix + sort_index ) : '_blank';
                
                w.open( url, window_name );
            } );
        }, // end of open_multi_tabs()
        
        request_tab_sorting = () => {
            var reg_result = ( w.name || '' ).match( reg_sort_index );
            
            if ( ! reg_result ) {
                return;
            }
            
            var request_id = reg_result[ 1 ],
                total = reg_result[ 2 ],
                sort_index = reg_result[ 3 ];
            
            chrome.runtime.sendMessage( {
                type : 'TAB_SORT_REQUEST',
                request_id : request_id,
                total : total,
                sort_index : sort_index,
            }, ( response ) => {
                //console.log( 'request_tab_sorting() response:', response );
            } );
            
            try {
                w.name = '';
            }
            catch ( error ) {
            }
        }; // end of request_tab_sorting()
    
    return {
        open_multi_tabs : open_multi_tabs,
        request_tab_sorting : request_tab_sorting,
    };
} )(); // end of extension_functions


if ( ( typeof content != 'undefined' ) && ( typeof content.XMLHttpRequest == 'function' ) ) {
    jQuery.ajaxSetup( {
        xhr : function () {
            try {
                return new content.XMLHttpRequest();
            } catch ( e ) {}
        }
    } );
}

// content_scripts の情報を渡す
chrome.runtime.sendMessage( {
    type : 'NOTIFICATION_ONLOAD',
    info : {
        url : location.href,
    }
}, function ( response ) {
    /*
    //window.addEventListener( 'beforeunload', function ( event ) {
    //    // TODO: メッセージが送信できないケース有り ("Uncaught TypeError: Cannot read property 'sendMessage' of undefined")
    //    chrome.runtime.sendMessage( {
    //        type : 'NOTIFICATION_ONUNLOAD',
    //        info : {
    //            url : location.href,
    //            event : 'onbeforeunload',
    //        }
    //    }, function ( response ) {
    //    } );
    //} );
    */
} );

chrome.runtime.onMessage.addListener( function ( message, sender, sendResponse ) {
    switch ( message.type )  {
        case 'RELOAD_REQUEST' :
            sendResponse( {
                result : 'OK'
            } );
            
            setTimeout( () => {
                location.reload();
            }, 100 );
            break;
    }
    return true;
} );

if ( /^https?:\/\/pbs\.twimg\.com\/media\//.test( location.href ) ) {
    // 複数画像を一度に開いたときにタブを並び替え
    extension_functions.request_tab_sorting();
}

w.is_chrome_extension = true;
w.twMediaDownloader_chrome_init = twMediaDownloader_chrome_init;
w.async_get_values = async_get_values;
w.async_set_values = async_set_values;
w.extension_functions = extension_functions;

} )( window, document );

// ■ end of file
