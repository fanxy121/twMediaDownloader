( function ( w, d ) {

w.chrome = ( ( typeof browser != 'undefined' ) && browser.runtime ) ? browser : chrome;


var IS_EDGE = ( 0 <= w.navigator.userAgent.toLowerCase().indexOf( 'edge' ) );


$().ready( function () {
    var RADIO_KV_LIST = [
            { key : 'IMAGE_DOWNLOAD_LINK', val : true }
        ,   { key : 'VIDEO_DOWNLOAD_LINK', val : true }
        ,   { key : 'ENABLE_FILTER', val : true }
        ],
        INT_KV_LIST = [
        ],
        STR_KV_LIST = [
        ];
    
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
    
    
    function set_radio_evt( kv ) {
        function check_svalue( kv, svalue ) {
            var bool_value = get_bool( svalue );
            
            if ( bool_value === null ) {
                return check_svalue( kv, kv.val );
            }
            return ( bool_value ) ? '1' : '0';
        }
        
        var key = kv.key,
            svalue = check_svalue( kv, localStorage[ key ] ),
            jq_target = $( '#' + key ),
            jq_inputs = jq_target.find( 'input:radio' );
        
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
        } ).change( function () {
            var jq_input = $( this );
            
            localStorage[ key ] = check_svalue( kv, jq_input.val() );
            
        } );
    } // end of set_radio_evt()
    
    
    function set_int_evt( kv ) {
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
            svalue = check_svalue( kv, localStorage[ key ] ),
            jq_target = $( '#' + key ),
            jq_input = jq_target.find( 'input:text:first' ),
            jq_current = jq_target.find( 'span.current:first' );
        
        jq_current.text( svalue );
        jq_input.val( svalue );
        
        jq_target.find( 'input:button' ).unbind( 'click' ).click( function () {
            var svalue = check_svalue( kv, jq_input.val() );
            
            localStorage[ key ] = svalue;
            jq_current.text( svalue );
            jq_input.val( svalue );
        } );
    } // end of set_int_evt()
    
    
    function set_str_evt( kv ) {
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
            svalue = check_svalue( kv, localStorage[ key ] ),
            jq_target = $( '#' + key ),
            jq_input = jq_target.find( 'input:text:first' ),
            jq_current = jq_target.find( 'span.current:first' );
        
        jq_current.text( svalue );
        jq_input.val( svalue );
        
        jq_target.find( 'input:button' ).unbind( 'click' ).click( function () {
            var svalue = check_svalue( kv, jq_input.val() );
            
            localStorage[ key ] = svalue;
            jq_current.text( svalue );
            jq_input.val( svalue );
        } );
    } // end of set_str_evt()
    
    
    function set_operation_evt() {
        var jq_operation = $( 'input[name="OPERATION"]' ),
            operation = get_bool( localStorage[ 'OPERATION' ] ),
            operation = ( operation === null ) ? true : operation; // デフォルトは true (動作中)
        
        function set_operation( next_operation ) {
            var button_text = ( next_operation ) ? ( chrome.i18n.getMessage( 'STOP' ) ) : ( chrome.i18n.getMessage( 'START' ) ),
                path_to_img = ( IS_EDGE ) ? 'img' : '../img',
                icon_path = ( next_operation ) ? ( path_to_img + '/icon_16.png' ) : ( path_to_img + '/icon_16-gray.png' );
            
            jq_operation.val( button_text );
            chrome.browserAction.setIcon( { path : icon_path } );
            
            localStorage[ 'OPERATION' ] = next_operation;
            operation = next_operation;
        }
        
        jq_operation.unbind( 'click' ).click( function( event ) {
            set_operation( ! operation );
        } );
        
        set_operation( operation );
    } // end of set_operation_evt()
    
    
    function set_all_evt() {
        RADIO_KV_LIST.forEach( function( radio_kv ) {
            set_radio_evt( radio_kv );
        } );
        
        INT_KV_LIST.forEach( function( int_kv ) {
            set_int_evt( int_kv );
        } );
        
        STR_KV_LIST.forEach( function( str_kv ) {
            set_str_evt( str_kv );
        } );
        
        set_operation_evt();
        
    }   //  end of set_all_evt()
    
    
    set_all_evt();
    
    
    $( 'input[name="DEFAULT"]' ).click( function () {
        localStorage.clear();
        set_all_evt();
        //location.reload();
    } );

} );

} )( window, document );

// ■ end of file
