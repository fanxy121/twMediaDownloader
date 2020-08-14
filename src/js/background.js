( function ( w, d ) {

'use strict';

w.chrome = ( ( typeof browser != 'undefined' ) && browser.runtime ) ? browser : chrome;


var SCRIPT_NAME = 'twMediaDownloader',
    DEBUG = false,
    CONTENT_TAB_INFOS = {};


function log_debug() {
    if ( ! DEBUG ) {
        return;
    }
    console.log.apply( console, arguments );
} // end of log_debug()

function log_error() {
    console.error.apply( console, arguments );
} // end of log_error()


w.log_debug = log_debug;
w.log_error = log_error;


function get_values( name_list ) {
    
    return new Promise( function ( resolve, reject ) {
        if ( typeof name_list == 'string' ) {
            name_list = [ name_list ];
        }
        
        chrome.storage.local.get( name_list, function ( items ) {
            resolve( items );
        } );
    } );
    
} // end of get_values()

/*
//function reload_tabs() {
//    chrome.tabs.query( {
//        url : '*://*.twitter.com/*' // TODO: url で query() を呼ぶためには tabs permission が必要になる
//    }, function ( result ) {
//        result.forEach( function ( tab ) {
//            if ( ! tab.url.match( /^https?:\/\/(?:(?:mobile)\.)?twitter\.com\// ) ) {
//                return;
//            }
//            chrome.tabs.reload( tab.id );
//        } );
//    });
//} // end of reload_tabs()
*/

var reload_tabs = ( () => {
    var reg_host = /([^.]+\.)?twitter\.com/,
        
        reload_tab = ( tab_info ) => {
            log_debug( 'reload_tab():', tab_info );
            var tab_id = tab_info.tab_id;
            
            chrome.tabs.sendMessage( tab_id, {
                type : 'RELOAD_REQUEST',
            }, {
            }, ( response ) => {
                log_debug( 'response', response );
                if ( chrome.runtime.lastError || ( ! response ) ) {
                    // タブが存在しないか、応答が無ければ chrome.runtime.lastError 発生→タブ情報を削除
                    // ※chrome.runtime.lastErrorをチェックしないときは Console に "Unchecked runtime.lastError: No tab with id: xxxx." 表示
                    delete CONTENT_TAB_INFOS[ tab_id ];
                    log_debug( 'tab or content_script does not exist: tab_id=', tab_id, '=> removed:', tab_info, '=> remained:', CONTENT_TAB_INFOS );
                }
            } );
        };
    
    return () => {
        log_debug( 'reload_tabs():', CONTENT_TAB_INFOS );
        Object.values( CONTENT_TAB_INFOS ).forEach( ( tab_info ) => {
            log_debug( tab_info );
            
            try {
                if ( ! reg_host.test( new URL( tab_info.url ).host ) ) {
                    return;
                }
            }
            catch ( error ) {
                return;
            }
            
            reload_tab( tab_info );
        } );
    };
} )();

w.reload_tabs = reload_tabs;


var request_tab_sorting = ( () => {
    var sort_index_to_tab_id_map_map = {},
        callback_map = {},
        
        get_tab_index = ( tab_id ) => {
            return new Promise( ( resolve, reject ) => {
                chrome.tabs.get( tab_id, ( tab ) => {
                    resolve( tab.index );
                } );
            } );
        },
        
        move_tab_to_index = ( tab_id, tab_index ) => {
            return new Promise( ( resolve, reject ) => {
                chrome.tabs.move( tab_id, {
                    index : tab_index,
                }, ( tab ) => {
                    resolve( tab );
                } );
            } );
        },
        
        start_tab_sorting = ( request_id, sorted_tab_id_list, sorted_tab_index_list ) => {
            Promise.all( sorted_tab_id_list.map( ( tab_id, index ) => {
                return move_tab_to_index( tab_id, sorted_tab_index_list[ index ] );
            } ) ).then( ( tab_list ) => {
                /*
                //chrome.tabs.update( sorted_tab_id_list[ 0 ], {
                //    active : true,
                //}, ( tab ) => {
                //    finish( request_id, sorted_tab_id_list );
                //    return;
                //} );
                //※能動的にはタブをアクティブにしない（ブラウザ設定依存とする）
                //  Firefox → browser.tabs.loadDivertedInBackground
                */
                
                finish( request_id, sorted_tab_id_list );
            } );
        },
        
        finish = ( request_id, sorted_tab_id_list ) => {
            sorted_tab_id_list.forEach( ( tab_id ) => {
                var callback = callback_map[ tab_id ];
                
                if ( typeof callback == 'function' ) {
                    callback();
                }
                delete callback_map[ tab_id ];
            } );
            
            delete sort_index_to_tab_id_map_map[ request_id ];
        };
        
    return ( tab_id, request_id, total, sort_index, callback ) => {
        var sort_index_to_tab_id_map = sort_index_to_tab_id_map_map[ request_id ] = sort_index_to_tab_id_map_map[ request_id ] || {};
        
        sort_index_to_tab_id_map[ sort_index ] = tab_id;
        callback_map[ tab_id ] = callback;
        
        if ( Object.keys( sort_index_to_tab_id_map ).length < total ) {
            return;
        }
        
        var sorted_tab_id_list = Object.keys( sort_index_to_tab_id_map ).sort().map( sort_index => sort_index_to_tab_id_map[ sort_index ] );
        
        Promise.all( sorted_tab_id_list.map( get_tab_index ) )
        .then( ( tab_index_list ) => {
            var sorted_tab_index_list = tab_index_list.slice( 0 ).sort();
            
            start_tab_sorting( request_id, sorted_tab_id_list, sorted_tab_index_list );
        } );
    };
} )(); // end of request_tab_sorting()


function on_message( message, sender, sendResponse ) {
    log_debug( '*** on_message():', message, sender );
    
    var type = message.type,
        response = {},
        tab_id = sender.tab && sender.tab.id;
    
    switch ( type ) {
        case 'GET_OPTIONS':
            var names = message.names,
                namespace = message.namespace;
            
            response = {};
            
            if ( typeof names == 'string' ) {
                names = [ names ];
            }
            
            get_values( names.map( function ( name ) {
                return ( ( namespace ) ? ( String( namespace ) + '_' ) : '' ) + name;
            }  ) )
                .then( options => {
                    // 対象タブがシークレットモードかどうか判別
                    // ※Firefoxの場合、シークレットモードで ZipRequest ライブラリを使おうとすると、generateエラーが発生してしまう
                    options.INCOGNITO_MODE = ( sender.tab && sender.tab.incognito ) ? '1' : '0';
                    
                    response = options;
                    
                    sendResponse( response );
                } );
            
            return true;
        
        case 'RELOAD_TABS':
            reload_tabs();
            sendResponse( response );
            return true;
        
        case 'NOTIFICATION_ONLOAD' :
            log_debug( 'NOTIFICATION_ONLOAD: tab_id', tab_id, message );
            if ( tab_id ) {
                CONTENT_TAB_INFOS[ tab_id ] = Object.assign( message.info, {
                    tab_id : tab_id,
                } );
            }
            log_debug( '=> CONTENT_TAB_INFOS', CONTENT_TAB_INFOS );
            
            sendResponse( response );
            return true;
        
        case 'NOTIFICATION_ONUNLOAD' :
            log_debug( 'NOTIFICATION_ONUNLOAD: tab_id', tab_id, message );
            if ( tab_id ) {
                delete CONTENT_TAB_INFOS[ tab_id ];
            }
            log_debug( '=> CONTENT_TAB_INFOS', CONTENT_TAB_INFOS );
            
            sendResponse( response );
            return true;
        
        case 'TAB_SORT_REQUEST' :
            log_debug( 'TAB_SORT_REQUEST: tab_id', tab_id, message );
            if ( tab_id ) {
                request_tab_sorting( tab_id, message.request_id, message.total, message.sort_index, () => {
                    sendResponse( {
                        result : 'OK',
                    } );
                } );
            }
            return true;
        
        case 'FETCH_JSON' :
            log_debug( 'FETCH_JSON', message );
            
            fetch( message.url, message.options )
            .then( response => response.json() )
            .then( ( json ) => {
                log_debug( 'FETCH_JSON => json', json );
                
                sendResponse( {
                    json : json,
                } );
            } )
            .catch( ( error ) => {
                log_error( 'FETCH_JSON => error', error );
                
                sendResponse( {
                    error : error,
                } );
            } );
            return true;
        
        default:
            var flag_async = zip_request_handler( message, sender, sendResponse );
            
            return flag_async;
    }
}  // end of on_message()


// ■ 各種イベント設定
// [chrome.runtime - Google Chrome](https://developer.chrome.com/extensions/runtime)
// [chrome.contextMenus - Google Chrome](https://developer.chrome.com/extensions/contextMenus)

// メッセージ受信
chrome.runtime.onMessage.addListener( on_message );

// WebRequest

//// ※ Firefox 61.0.1 で、content_scripts で $.ajax() を読んだ際、Referer が設定されない不具合に対応(0.2.6.1201)
// → jquery.js にパッチをあてることで対処(0.2.6.1202)
// 参照：[Content scripts - Mozilla | MDN](https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Content_scripts#XHR_and_Fetch)
//chrome.webRequest.onBeforeSendHeaders.addListener(
//    function ( details ) {
//        var requestHeaders = details.requestHeaders,
//            referer;
//        
//        if ( ! requestHeaders.some( ( element ) => ( element.name.toLowerCase() == 'referer' ) ) ) {
//            referer = details.documentUrl || 'https://twitter.com';
//            
//            requestHeaders.push( {
//                name : 'Referer',
//                value : referer,
//            } );
//        }
//        
//        return { requestHeaders: requestHeaders };
//    }
//,   { urls : [ '*://twitter.com/*' ] }
//,   [ 'blocking', 'requestHeaders' ]
//);


var reg_oauth2_token = /^https:\/\/api\.twitter\.com\/oauth2\/token/,
    reg_legacy_mark = /[?&]__tmdl=legacy(?:&|$)/;

chrome.webRequest.onBeforeSendHeaders.addListener(
    function ( details ) {
        var requestHeaders,
            url = details.url;
        
        if ( reg_oauth2_token.test( url ) ) {
            // ※ OAuth2 の token 取得時(api.twitter.com/oauth2/token)に Cookie を送信しないようにする
            requestHeaders = details.requestHeaders.filter( function ( element, index, array ) {
                return ( element.name.toLowerCase() != 'cookie' );
            } );
        }
        else if ( reg_legacy_mark.test( url ) ) {
            // ※ "__tmdl=legacy" が付いている場合、旧 Twitter の HTML / API をコールするために User-Agent を変更
            requestHeaders = details.requestHeaders.map( function ( element ) {
                if ( element.name.toLowerCase() == 'user-agent' ) {
                    //element.value = 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko';
                    element.value = 'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; AS; rv:11.0) Waterfox/56.2';
                    // 参考：[ZusorCode/GoodTwitter](https://github.com/ZusorCode/GoodTwitter)
                }
                return element;
            } );
        }
        
        //console.log( requestHeaders );
        
        return ( ( requestHeaders !== undefined ) ? { requestHeaders : requestHeaders } : {} );
    }
,   { urls : [ '*://*.twitter.com/*' ] }
,   [ 'blocking', 'requestHeaders' ]
);

} )( window, document );

// ■ end of file
