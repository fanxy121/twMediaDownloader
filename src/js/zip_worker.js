( function () {

'use strict';

if ( typeof browser == 'undefined' ) { window.browser = chrome; }

let ZIP_TAB_INFO_MAP = {},
    USER_AGENT = navigator.userAgent.toLowerCase(),
    IS_EDGE = ( 0 <= USER_AGENT.indexOf( 'edge' ) ),
    IS_FIREFOX = ( 0 <= USER_AGENT.indexOf( 'firefox' ) ),
    IS_CHROME = ( ( ! IS_EDGE ) && ( 0 <= USER_AGENT.indexOf( 'chrome' ) ) ),
    SENDBACK_BLOB_FOR_FIREFOX = false; // Firefox で、Blob を直接（Blob URLに変換せずに）送信


function zip_open( tab_id ) {
    return new Promise( function ( resolve, reject ) {
        let tab_info, zip_info;
        
        tab_info = ZIP_TAB_INFO_MAP[ tab_id ];
        
        if ( ! tab_info ) {
            tab_info = ZIP_TAB_INFO_MAP[ tab_id ] = {
                last_zip_id : 0,
                zip_info_map : {}
            };
        }
        
        zip_info = tab_info.zip_info_map[ ++ tab_info.last_zip_id ] = {
            zip : new JSZip(),
        };
        
        resolve( {
            zip_id : tab_info.last_zip_id
        } );
    } );
} // end of zip_open()


function zip_file( tab_id, zip_id, file_info ) {
    return new Promise( function ( resolve, reject ) {
        let tab_info, zip_info, zip, zip_options;
        
        try {
            tab_info = ZIP_TAB_INFO_MAP[ tab_id ];
            zip_info = tab_info.zip_info_map[ zip_id ];
            zip = zip_info.zip;
            zip_options = file_info.zip_options;
        }
        catch ( error ) {
            reject( {
                error : 'zip_id "' + zip_id + '" : not found'
            } );
            return;
        }
        
        
        function on_load( file_content ) {
            zip.file( file_info.filename, file_content, zip_options );
            
            resolve( {
                result : 'OK',
                size : ( typeof file_content.byteLength != 'undefined' ) ? file_content.byteLength : file_content.length
            } );
        } // end of on_load()
        
        
        function on_error( error_message ) {
            reject( {
                error : 'fetch() error: ' + error_message
            } );
        } // end of on_error()
        
        
        if ( ! zip_options ) {
            zip_options = {};
        }
        
        if ( zip_options.date ) {
            zip_options.date = new Date( zip_options.date );
        }
        
        if ( file_info.data ) {
            on_load( file_info.data );
            return;
        }
        
        fetch( file_info.url, {
            //mode : 'cors',
            //credentials: 'include'
        } )
        .then( response => {
            if ( ! response.ok ) {
                throw Error( response.statusText );
            }
            return response.arrayBuffer();
        } )
        .then( file_content => {
            on_load( file_content );
        } )
        .catch( function ( error ) {
            on_error( error.message );
        } );
    
    } );
} // end of zip_file()


function zip_generate( tab_id, zip_id, zip_parameters ) {
    return new Promise( function ( resolve, reject ) {
        let tab_info, zip_info, zip, url_scheme, zip_type, zip_url;
        
        try {
            tab_info = ZIP_TAB_INFO_MAP[ tab_id ];
            zip_info = tab_info.zip_info_map[ zip_id ];
            zip = zip_info.zip;
        }
        catch ( error ) {
            reject( {
                error : 'zip_id "' + zip_id + '" : not found'
            } );
        }
        
        if ( ! zip_parameters ) {
            zip_parameters = {};
        }
        
        url_scheme = zip_parameters.url_scheme;
        zip_type = ( url_scheme == 'data' ) ? 'base64' : 'blob';
        
        zip.generateAsync( { type : zip_type } )
        .then( zip_content => {
            if ( ( IS_FIREFOX && SENDBACK_BLOB_FOR_FIREFOX ) && ( url_scheme == 'blob' ) ) {
                // Firefox では、Blob URL に変換したものを content_scripts 側に渡すと、そちらでダウンロードできない
                // ※ ただし、なぜか fetch() は可能、手動でアドレス欄にコピーしてもダウンロードできる）
                // → Firefox では Blob をそのまま sendResponse() で送信可能なため、content_scripts 側で Blob URL に変換することで対応
                resolve( {
                    zip_content : zip_content
                } );
            }
            else {
                // Chrome や Edge の場合、Blob オブジェクトをそのままでは送信できない（[object Blob]→[object Object]）
                // → Blob URL に変換してから送信
                
                // TODO: Edge の場合、Blob URL にすると content_scripts 側でダウンロードできない
                zip_url = ( url_scheme == 'data' ) ? ( 'data:application/octet-stream;base64,' + zip_content ) : URL.createObjectURL( zip_content );
                resolve( {
                    zip_url : zip_url
                } );
            }
        } )
        .catch( error => {
            reject( {
                error : error
            } );
        } );
    } );
} // end of zip_generate()


function zip_close( tab_id, zip_id ) {
    return new Promise( function ( resolve, reject ) {
        let tab_info, zip_info, zip;
        
        try {
            tab_info = ZIP_TAB_INFO_MAP[ tab_id ];
            zip_info = tab_info.zip_info_map[ zip_id ];
        }
        catch ( error ) {
            reject( {
                error : 'zip_id "' + zip_id + '" : not found'
            } );
            return;
        }
        
        delete zip_info.zip;
        delete tab_info.zip_info_map[ zip_id ];
        
        resolve( {
            result : 'OK'
        } );
    } );
} // end of zip_close()


function zip_request_handler( message, sender, sendResponse ) {
    let flag_async = false;
    
    // イベントハンドラが true を返しておかないと、非同期処理後の sendResponse が無効化されてしまう
    // ※ sender 側の response (コールバック引数) が undefined になってしまう
    
    // [chrome.runtime - Google Chrome](https://developer.chrome.com/extensions/runtime#event-onMessage)
    // | function sendResponse
    // |   ... This function becomes invalid when the event listener returns, unless you 
    // |   return true from the event listener to indicate you wish to send a response asynchronously 
    // |   (this will keep the message channel open to the other end until sendResponse is called). ...
    
    function on_complete( response ) {
        //console.log( message.type, response );
        sendResponse( response );
    } // end of on_complete()
    
    
    function on_error( response ) {
        console.error( message.type, response );
        sendResponse( response );
    } // end of complete()
    
    if ( ( sender.id != browser.runtime.id ) || ( ! sender.tab ) || ( ! sender.tab.id ) ) {
        on_error( { error : 'unknown sender' } );
        return flag_async;
    }
    
    flag_async = true;
    
    switch ( message.type ) {
        case 'ZIP_OPEN' :
            zip_open( sender.tab.id )
            .then( on_complete )
            .catch( on_error );
            break;
        
        case 'ZIP_FILE' :
            zip_file( sender.tab.id, message.zip_id, message.file_info )
            .then( on_complete )
            .catch( on_error );
            break;
        
        case 'ZIP_GENERATE' :
            zip_generate( sender.tab.id, message.zip_id, message.zip_parameters )
            .then( on_complete )
            .catch( on_error );
            break;
        
        case 'ZIP_CLOSE' :
            zip_close( sender.tab.id, message.zip_id )
            .then( on_complete )
            .catch( on_error );
            break;
        
        default:
            flag_async = false;
            on_error( { error : 'unknown message' } );
            break;
    }
    
    return flag_async;
}  // end of zip_request_handler()

window.zip_request_handler = zip_request_handler;

} )();
