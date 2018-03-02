( function ( w, d ) {

'use strict';

w.chrome = ( ( typeof browser != 'undefined' ) && browser.runtime ) ? browser : chrome;


var DEBUG = false;


function log_debug() {
    if ( ! DEBUG ) {
        return;
    }
    console.log.apply( console, arguments );
} // end of log_debug()


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


function on_message( message, sender, sendResponse ) {
    log_debug( '*** on_message():', message, sender );
    
    var type = message.type,
        response = null;
    
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
// ※ OAuth2 の token 取得時に Cookie を送信しないようにする
chrome.webRequest.onBeforeSendHeaders.addListener(
    function ( details ) {
        var requestHeaders = details.requestHeaders.filter( function ( element, index, array ) {
                return ( element.name.toLowerCase() != 'cookie' );
            } );
        
        return { requestHeaders: requestHeaders };
    }
,   { urls : [ '*://api.twitter.com/oauth2/token' ] }
,   [ 'blocking', 'requestHeaders' ]
);

} )( window, document );

// ■ end of file
