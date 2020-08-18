( function ( w, d ) {

'use strict';

w.chrome = ( ( typeof browser != 'undefined' ) && browser.runtime ) ? browser : chrome;


var USER_AGENT = w.navigator.userAgent.toLowerCase(),
    IS_EDGE = ( 0 <= USER_AGENT.indexOf( 'edge' ) ),
    IS_FIREFOX = ( 0 <= USER_AGENT.indexOf( 'firefox' ) ),
    IS_VIVALDI = ( 0 <= USER_AGENT.indexOf( 'vivaldi' ) ),
    
    value_updated = false,
    background_window = chrome.extension.getBackgroundPage();

background_window.log_debug( '***** options ******' );


$( w ).on( ( IS_VIVALDI ) ? 'blur' : 'unload', function ( event ) {
    // ※ Vivaldi 2.5.1525.48 では、popup を閉じても unload イベントは発生せず、次に popup を開いたときに発生してしまう
    //    → 暫定的に blur イベントで対処
    
    background_window.log_debug( '< unloaded > value_updated:', value_updated );
    
    if ( ! value_updated ) {
        return;
    }
    
    value_updated = false;
    
    background_window.reload_tabs();
    // オプションを変更した場合にタブをリロード
    // ※TODO: 一度でも変更すると、値が同じであってもリロードされる
    
    background_window.log_debug( '< reload_tabs() done >' );
} );


$( async function () {
    var RADIO_KV_LIST = [
            { key : 'IMAGE_DOWNLOAD_LINK', val : true }
        ,   { key : 'VIDEO_DOWNLOAD_LINK', val : true }
        ,   { key : 'OPEN_MEDIA_LINK_BY_DEFAULT', val : false }
        ,   { key : 'ENABLE_ZIPREQUEST', val : true }
        ,   { key : 'ENABLE_FILTER', val : true }
        ,   { key : 'ENABLE_VIDEO_DOWNLOAD', val : true }
        ,   { key : 'ENABLED_ON_TWEETDECK', val : true }
        ,   { key : 'TAB_SORTING', val : true }
        ,   { key : 'AUTO_CONTINUE', val : true }
        ],
        
        INT_KV_LIST = [
            { key : 'DOWNLOAD_SIZE_LIMIT_MB', val : 500, min : 100, max : 10000 }
        ],
        
        STR_KV_LIST = [
        ],
        
        OPTION_KEY_LIST = ( function () {
                var option_keys = [];
                
                RADIO_KV_LIST.forEach( function( radio_kv ) {
                    option_keys.push( radio_kv.key );
                } );
                
                INT_KV_LIST.forEach( function( int_kv ) {
                    option_keys.push( int_kv.key );
                } );
                
                STR_KV_LIST.forEach( function( str_kv ) {
                    option_keys.push( str_kv.key );
                } );
                
                option_keys.push( 'OPERATION' );
                
                return option_keys;
            } )();
    
    STR_KV_LIST.forEach( function( str_kv ) {
        str_kv.val = chrome.i18n.getMessage( str_kv.key );
    } );
    
    $( '.i18n' ).each( function () {
        var jq_elm = $( this ),
            value = ( jq_elm.val() ) || ( jq_elm.html() ),
            text = chrome.i18n.getMessage( value );
        
        if ( ! text ) {
            return;
        }
        if ( ( value == 'OPTIONS' ) && ( jq_elm.parent().prop( 'tagName' ) == 'H1' ) ) {
            text += ' ( version ' + chrome.runtime.getManifest().version + ' )';
        }
        if ( jq_elm.val() ) {
            jq_elm.val( text );
        }
        else {
            jq_elm.html( text );
        }
    } );
    
    $( 'form' ).submit( function () {
        return false;
    } );
    
    
    function get_value( key ) {
        
        return new Promise( function ( resolve, reject ) {
            chrome.storage.local.get( key, function ( items ) {
                resolve( items[ key ] );
            } );
        } );
        
    } // end of get_value()
    
    
    function set_value( key, value ) {
        
        return new Promise( function ( resolve, reject ) {
            chrome.storage.local.set( {
                [ key ] : value
            }, function () {
                resolve();
            } );
        } );
        
    } // end of get_value()
    
    
    function remove_values( key_list ) {
        
        return new Promise( function ( resolve, reject ) {
            chrome.storage.local.remove( key_list, function () {
                resolve();
            } );
        } );
        
    } // end of remove_values()
    
    
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
    
    
    async function set_radio_evt( kv ) {
        function check_svalue( kv, svalue ) {
            var bool_value = get_bool( svalue );
            
            if ( bool_value === null ) {
                return check_svalue( kv, kv.val );
            }
            return ( bool_value ) ? '1' : '0';
        }
        
        var key = kv.key,
            svalue = check_svalue( kv, await get_value( key ) ),
            jq_target = $( '#' + key ),
            //jq_inputs = jq_target.find( 'input:radio' );
            jq_inputs = jq_target.find( 'input:radio[name="' + key + '"]' );
        
        jq_inputs.unbind( 'change' ).each( function () {
            var jq_input = $( this ),
                val = jq_input.val();
            
            if ( val === svalue ) {
                //jq_input.attr( 'checked', 'checked' );
                jq_input.prop( 'checked', 'checked' );
            }
            else {
                //jq_input.attr( 'checked', false );
                jq_input.prop( 'checked', false );
            }
            // ※ .attr() で変更した場合、ラジオボタンが書き換わらない場合がある(手動変更後に[デフォルトに戻す]を行った場合等)ので、.prop() を使用すること。
            //   参考：[jQueryでチェックボックスの全チェック／外しをしようとしてハマッたこと、attr()とprop()の違いは罠レベル | Ultraひみちゅぶろぐ](http://ultrah.zura.org/?p=4450)
        } ).change( async function () {
            var jq_input = $( this );
            
            await set_value( key, check_svalue( kv, jq_input.val() ) );
            value_updated = true;
        } );
    } // end of set_radio_evt()
    
    
    async function set_int_evt( kv ) {
        function check_svalue( kv, svalue ) {
            if ( isNaN( svalue ) ) {
                svalue = kv.val;
            }
            else {
                svalue = parseInt( svalue );
                if ( ( ( kv.min !== null ) && ( svalue < kv.min ) ) || ( ( kv.max !== null ) && ( kv.max < svalue ) ) ) {
                    svalue = kv.val;
                }
            }
            svalue = String( svalue );
            return svalue;
        }
        
        var key = kv.key,
            svalue = check_svalue( kv, await get_value( key ) ),
            jq_target = $( '#' + key ),
            jq_input = jq_target.find( 'input:text:first' ),
            jq_current = jq_target.find( 'span.current:first' );
        
        jq_current.text( svalue );
        jq_input.val( svalue );
        
        jq_target.find( 'input:button' ).unbind( 'click' ).click( async function () {
            var svalue = check_svalue( kv, jq_input.val() );
            
            await set_value( key, svalue );
            value_updated = true;
            
            jq_current.text( svalue );
            jq_input.val( svalue );
        } );
    } // end of set_int_evt()
    
    
    async function set_str_evt( kv ) {
        function check_svalue( kv, svalue ) {
            if ( ! svalue ) {
                svalue = kv.val;
            }
            else {
                svalue = String( svalue ).replace( /(?:^\s+|\s+$)/g, '' );
                if ( ! svalue ) {
                    svalue = kv.val;
                }
            }
            return svalue;
        }
        
        var key = kv.key,
            svalue = check_svalue( kv, await get_value( key ) ),
            jq_target = $( '#' + key ),
            jq_input = jq_target.find( 'input:text:first' ),
            jq_current = jq_target.find( 'span.current:first' );
        
        jq_current.text( svalue );
        jq_input.val( svalue );
        
        jq_target.find( 'input:button' ).unbind( 'click' ).click( async function () {
            var svalue = check_svalue( kv, jq_input.val() );
            
            await set_value( key, svalue );
            value_updated = true;
            
            jq_current.text( svalue );
            jq_input.val( svalue );
        } );
    } // end of set_str_evt()
    
    
    async function set_operation_evt() {
        var jq_operation = $( 'input[name="OPERATION"]' ),
            operation_key = 'OPERATION',
            operation = get_bool( await get_value( operation_key ) );
        
        if ( operation === null ) {
            operation = true; // デフォルトは true (動作中)
        }
        
        async function set_operation( next_operation ) {
            var button_text = ( next_operation ) ? ( chrome.i18n.getMessage( 'STOP' ) ) : ( chrome.i18n.getMessage( 'START' ) ),
                path_to_img = ( IS_EDGE ) ? 'img' : '../img',
                icon_path = ( next_operation ) ? ( path_to_img + '/icon_16.png' ) : ( path_to_img + '/icon_16-gray.png' );
            
            jq_operation.val( button_text );
            chrome.browserAction.setIcon( { path : icon_path } );
            
            await set_value( operation_key, next_operation );
            operation = next_operation;
        }
        
        jq_operation.unbind( 'click' ).click( async function( event ) {
            await set_operation( ! operation );
            value_updated = true;
        } );
        
        await set_operation( operation );
    } // end of set_operation_evt()
    
    
    async function set_all_evt() {
        RADIO_KV_LIST.forEach( async function( radio_kv ) {
            await set_radio_evt( radio_kv );
        } );
        
        INT_KV_LIST.forEach( async function( int_kv ) {
            await set_int_evt( int_kv );
        } );
        
        STR_KV_LIST.forEach( async function( str_kv ) {
            await set_str_evt( str_kv );
        } );
        
        await set_operation_evt();
        
    }   //  end of set_all_evt()
    
    
    await set_all_evt();
    
    
    $( 'input[name="DEFAULT"]' ).click( async function () {
        await remove_values( OPTION_KEY_LIST );
        value_updated = true;
        
        await set_all_evt();
        //location.reload();
    } );

} );

} )( window, document );

// ■ end of file
