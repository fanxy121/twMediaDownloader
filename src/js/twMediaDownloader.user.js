// ==UserScript==
// @name            twMediaDownloader
// @namespace       http://furyu.hatenablog.com/
// @author          furyu
// @version         0.1.0.1
// @include         https://twitter.com/*
// @require         https://ajax.googleapis.com/ajax/libs/jquery/2.2.4/jquery.min.js
// @require         https://cdnjs.cloudflare.com/ajax/libs/jszip/3.0.0/jszip.min.js
// @grant           GM_xmlhttpRequest
// @connect         twitter.com
// @connect         pbs.twimg.com
// @description     Download images of user's media-timeline on Twitter.
// ==/UserScript==

/*
■ 外部ライブラリ
- [jQuery](https://jquery.com/)
    The MIT License
    [License | jQuery Foundation](https://jquery.org/license/)

- [JSZip](https://stuk.github.io/jszip/)
    The MIT License
    Copyright (c) 2009-2014 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso
    [jszip/LICENSE.markdown](https://github.com/Stuk/jszip/blob/master/LICENSE.markdown)

■ 関連記事など

*/

/*
The MIT License (MIT)

Copyright (c) 2016 furyu <furyutei@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/


( function ( w, d ) {

'use strict';

// ■ パラメータ {
var OPTIONS = {
    DEFAULT_LIMIT_TWEET_NUMBER : 100 // ダウンロードできる画像付きツイート数制限のデフォルト値
};

// }


// ■ 共通変数 {
var SCRIPT_NAME = 'twMediaDownloader';

if ( w[ SCRIPT_NAME + '_touched' ] ) {
    return;
}
w[ SCRIPT_NAME + '_touched' ] = true;

if ( ( typeof jQuery != 'function' ) || ( typeof JSZip != 'function' ) ) {
    console.error( SCRIPT_NAME + ':', 'Library not found', typeof jQuery, typeof JSZip );
    return;
}

var $ = jQuery,
    LANGUAGE = ( function () {
        try{
            return ( w.navigator.browserLanguage || w.navigator.language || w.navigator.userLanguage ).substr( 0, 2 );
        }
        catch ( error ) {
            return 'en';
        }
    } )();

switch ( LANGUAGE ) {
    case 'ja' :
        OPTIONS.DOWNLOAD_BUTTON_TEXT = '⇩';
        OPTIONS.DOWNLOAD_BUTTON_HELP_TEXT = 'メディアタイムラインの画像を保存';
        OPTIONS.DIALOG_TWEET_ID_RANGE_HEADER = '保存対象 Tweet ID 範囲';
        OPTIONS.DIALOG_TWEET_ID_RANGE_MARK = '＜ ID ＜';
        OPTIONS.DIALOG_LIMIT_TWEET_NUMBER_TEXT = '制限数';
        OPTIONS.DIALOG_BUTTON_START_TEXT = '開始';
        OPTIONS.DIALOG_BUTTON_STOP_TEXT = '停止';
        OPTIONS.DIALOG_BUTTON_CLOSE_TEXT = '閉じる';
        break;
    default:
        OPTIONS.DOWNLOAD_BUTTON_TEXT = '⇩';
        OPTIONS.DOWNLOAD_BUTTON_HELP_TEXT = 'Download images from media timeline';
        OPTIONS.DIALOG_TWEET_ID_RANGE_HEADER = 'Download Tweet ID range';
        OPTIONS.DIALOG_TWEET_ID_RANGE_MARK = '< ID <';
        OPTIONS.DIALOG_LIMIT_TWEET_NUMBER_TEXT = 'Limit';
        OPTIONS.DIALOG_BUTTON_START_TEXT = 'Start';
        OPTIONS.DIALOG_BUTTON_STOP_TEXT = 'Stop';
        OPTIONS.DIALOG_BUTTON_CLOSE_TEXT = 'Close';
        break;
}


// }


// ■ 関数 {
function to_array( array_like_object ) {
    return Array.prototype.slice.call( array_like_object );
} // end of to_array()


var object_extender = ( function () {
    function object_extender( base_object ) {
        var template = object_extender.template,
            base_object = template.prototype = base_object,
            expanded_object = new template(),
            object_list = to_array( arguments );
        
        object_list.shift();
        object_list.forEach( function ( object ) {
            Object.keys( object ).forEach( function ( name ) {
                expanded_object[ name ] = object[ name ];
            } );
        } );
        
        return expanded_object;
    } // end of object_extender()
    
    
    object_extender.template = function () {};
    
    return object_extender;
} )(); // end of object_extender()


// 参考: [日付フォーマットなど 日付系処理 - Qiita](http://qiita.com/osakanafish/items/c64fe8a34e7221e811d0)
function format_date( date, format ) {
    if ( ! format ) {
        format = 'YYYY-MM-DD hh:mm:ss.SSS';
    }
    
    var msec = ( '00' + date.getMilliseconds() ).slice( -3 ),
        msec_index = 0;
    
    format = format
        .replace( /YYYY/g, date.getFullYear() )
        .replace( /MM/g, ( '0' + ( 1 + date.getMonth() ) ).slice( -2 ) )
        .replace( /DD/g, ( '0' + date.getDate() ).slice( -2 ) )
        .replace( /hh/g, ( '0' + date.getHours() ).slice( -2 ) )
        .replace( /mm/g, ( '0' + date.getMinutes() ).slice( -2 ) )
        .replace( /ss/g, ( '0' + date.getSeconds() ).slice( -2 ) )
        .replace( /S/g, function ( all ) { return msec.charAt( msec_index ++ ) } );
    
    return format;
} // end of format_date()


function get_img_url( img_url, kind ) {
    if ( ! kind ) {
        kind = '';
    }
    else {
        if ( kind.search( ':' ) != 0 ) {
            kind = ':' + kind;
        }
    }
    return img_url.replace( /:\w*$/, '' ) + kind;
} // end of get_img_url()


function get_img_url_orig( img_url ) {
    if ( /^https?:\/\/ton\.twitter\.com\//.test( img_url ) ) {
        // DM の画像は :orig が付かないものが最大
        return get_img_url( img_url );
    }
    return get_img_url( img_url, 'orig' );
} // end of get_img_url_orig()


function get_img_extension( img_url, extension_list ) {
    var extension = '',
        extension_list = ( extension_list ) ? extension_list : [ 'png', 'jpg', 'gif' ];
    
    if ( img_url.match( new RegExp( '\.(' + extension_list.join('|') + ')' ) ) ) {
        extension = RegExp.$1;
    }
    return extension;
} // end of get_img_extension()


function get_screen_name( url ) {
    if ( ! url ) {
        url = w.location.href;
    }
    
    if ( ! url.trim().match( /^https?:\/\/[^\/]+\/([^\/]+)/ ) ) {
        return null;
    }
    
    return RegExp.$1;
} // end of get_screen_name()


function get_tweet_id( url ) {
    if ( ! url ) {
        url = w.location.href;
    }
    
    if ( ! url.trim().match( /(?:^|\/)(\d+)(?:$|\/)/ ) ) {
        return null;
    }
    
    return RegExp.$1;
} // end of get_tweet_id()


function get_tweet_info( jq_tweet ) {
    var tweet_info = {},
        tweet_url,
        timestamp_ms,
        image_urls = [];
    
    tweet_url = jq_tweet.find( '.js-permalink' ).attr( 'href' );
    if ( tweet_url && tweet_url.charAt( 0 ) == '/' ) {
        tweet_url = 'https://twitter.com' + tweet_url;
    }
    tweet_info.tweet_url = tweet_url;
    tweet_info.tweet_id = jq_tweet.find( '*[data-tweet-id]' ).attr( 'data-tweet-id' );
    tweet_info.timestamp_ms = timestamp_ms = jq_tweet.find( '*[data-time-ms]' ).attr( 'data-time-ms' );
    //tweet_info.datetime = ( timestamp_ms ) ? new Date( parseInt( timestamp_ms, 10 ) ).toLocaleString() : '';
    tweet_info.datetime = ( timestamp_ms ) ? format_date( new Date( parseInt( timestamp_ms, 10 ) ), 'YYYY/MM/DD hh:mm:ss' ) : '';
    tweet_info.tweet_text = jq_tweet.find( '.js-tweet-text, .tweet-text' ).text();
    
    jq_tweet.find( '.AdaptiveMedia-photoContainer img' ).each( function () {
        image_urls.push( get_img_url_orig( $( this ).attr( 'src' ) ) );
    } );
    
    tweet_info.image_urls = image_urls;
    
    return tweet_info;
} // end of get_tweet_info()


function get_media_timeline( screen_name, max_position, callback ) {
    var url = 'https://twitter.com/i/profiles/show/' + screen_name + '/media_timeline',
        max_position = ( max_position ) ? max_position : '9223372036854775807', // 7fffffffffffffff = 2^63-1
        last_note_ts = localStorage[ '__DM__:latestNotificationTimestamp' ],
        last_note_ts = ( last_note_ts ) ? last_note_ts : new Date().getTime(),
        data = {
            include_available_features : 1
        ,   include_entities : 1
        ,   last_note_ts : last_note_ts
        ,   max_position : max_position
        ,   reset_error_state : false
        };
    
    $.getJSON( url, data )
    .success( function ( json ) {
        var tweet_infos = [];
        
        $( '<div/>' ).html( json.items_html ).find( '.js-stream-item' ).each( function () {
            tweet_infos.push( get_tweet_info( $( this ) ) );
        } );
        
        callback( {
            response_json : json // { "min_position" : "...", "has_more_items" : <boolean>, "items_html" : <html> }
        ,   tweet_infos : tweet_infos
        } );
    } )
    .error( function ( jqXHR, textStatus, errorThrown ) {
        callback( {
            response_json : null
        ,   tweet_infos : []
        ,   jqXHR : jqXHR
        ,   textStatus : textStatus
        } );
    } )
    .complete( function () {
    } );
        
} // end of get_media_timeline()


function save_blob( filename, blob ) {
    var blobURL = URL.createObjectURL( blob ),
        download_button = d.createElement( 'a' );
    
    download_button.href = blobURL;
    download_button.download = filename;
    
    d.documentElement.appendChild( download_button );
    
    download_button.click();
    
    download_button.parentNode.removeChild( download_button );
} // end of save_blob()


var download_media_timeline = ( function () {
    var MediaDownload = object_extender( {
        downloading : false
    ,   stopping : false
    ,   closing : false
    ,   jq_container : null
    ,   jq_log : null
    ,   jq_since_id : null
    ,   jq_until_id : null
    ,   jq_limit_tweet_number : null
    ,   jq_button_start : null
    ,   jq_button_stop : null
    ,   jq_button_close : null
    
    ,   init : function () {
            var self = this;
            
            return self;
        } // end of init()
    
    ,   init_container : function () {
            var self = this,
                container_id = SCRIPT_NAME + '_container',
                jq_container,
                jq_dialog,
                jq_toolbox,
                jq_range_container,
                jq_range_header,
                jq_since_id,
                jq_until_id,
                jq_limit_tweet_number,
                jq_botton_container,
                jq_button_start,
                jq_button_stop,
                jq_button_close,
                jq_status_container,
                jq_log;
            
            $( '#' + container_id ).remove();
            
            self.jq_button_start = jq_button_start = $( '<button />' )
                .text( OPTIONS.DIALOG_BUTTON_START_TEXT )
                .addClass( SCRIPT_NAME + '_button_start' )
                .click( function ( event ) {
                    event.stopPropagation();
                    event.preventDefault();
                    
                    self.on_start( event );
                } );
            
            self.jq_button_stop = jq_button_stop = $( '<button />' )
                .text( OPTIONS.DIALOG_BUTTON_STOP_TEXT )
                .addClass( SCRIPT_NAME + '_button_stop' )
                .click( function ( event ) {
                    event.stopPropagation();
                    event.preventDefault();
                    
                    self.on_stop( event );
                } );
            
            /*
            //self.jq_button_close = jq_button_close = $( '<button />' )
            //    .text( OPTIONS.DIALOG_BUTTON_CLOSE_TEXT )
            //    .addClass( SCRIPT_NAME + '_button_close' )
            //    .click( function ( event ) {
            //        event.stopPropagation();
            //        event.preventDefault();
            //        
            //        self.on_close( event );
            //    } );
            */
            
            self.jq_button_close = jq_button_close = $( '<span />' )
                .addClass( SCRIPT_NAME + '_button_close Icon Icon--close Icon--large' )
                .attr( {
                    title : OPTIONS.DIALOG_BUTTON_CLOSE_TEXT
                } )
                .css( {
                    'float' : 'right'
                ,   'cursor' : 'pointer'
                } )
                .click( function ( event ) {
                    event.stopPropagation();
                    event.preventDefault();
                    
                    self.on_close( event );
                } );
            
            self.jq_container = jq_container = $( '<div />' )
                .attr( {
                    id : container_id
                } )
                .css( {
                    'position' : 'fixed'
                ,   'top' : 0
                ,   'bottom' : 0
                ,   'left' : 0
                ,   'right' : 0
                ,   'overflow' : 'auto'
                ,   'zIndex' : 10000
                ,   'background' : 'rgba( 0, 0, 0, 0.8 )'
                } )
                .click( function ( event ) {
                    if ( ( ! event.target ) || ( $( event.target ).attr( 'id' ) != container_id ) ) {
                        return;
                    }
                    
                    event.stopPropagation();
                    event.preventDefault();
                    
                    self.on_close( event );
                } );
            
            jq_dialog = $( '<div />' )
                .addClass( SCRIPT_NAME + '_dialog' )
                .attr( {
                } )
                .css( {
                    'position' : 'absolute'
                ,   'top' : '50%'
                ,   'left' : '50%'
                ,   'background' : 'white'
                ,   'width' : '640px'
                ,   'height' : '480px'
                ,   'margin' : '-240px 0 0 -320px'
                ,   'border-radius' : '6px'
                ,   'overflow' : 'hidden'
                } );
            
            jq_toolbox = $( '<div />' )
                .addClass( SCRIPT_NAME + '_toolbox' )
                .attr( {
                } )
                .css( {
                    'overflow' : 'hidden'
                ,   'background' : 'lightblue'
                ,   'height' : '30%'
                } );
            
            jq_range_container = $( '<div><h3></h3><p><input type="text" name="since_id" value="" class="tweet_id" /><span class="range_text"></span><input type="text" name="until_id" class="tweet_id" /><label class="limit"></label><input type="text" name="limit" class="tweet_number" /></p></div>' )
                .attr( {
                } )
                .css( {
                } );
            
            jq_range_header = jq_range_container.find( 'h3' )
                .text( OPTIONS.DIALOG_TWEET_ID_RANGE_HEADER )
                .append( jq_button_close )
                .attr( {
                } )
                .css( {
                    'margin' : '16px'
                } );
            
            jq_range_container.find( 'p' )
                .attr( {
                } )
                .css( {
                    'text-align' : 'center'
                } );
            
            jq_range_container.find( 'span.range_text' )
                .text( OPTIONS.DIALOG_TWEET_ID_RANGE_MARK )
                .attr( {
                } )
                .css( {
                    'margin-left' : '8px'
                ,   'margin-right' : '8px'
                } );
            
            jq_range_container.find( 'input.tweet_id' )
                .attr( {
                } )
                .css( {
                    'width' : '160px'
                } );
            
            jq_range_container.find( 'label.limit' )
                .text( OPTIONS.DIALOG_LIMIT_TWEET_NUMBER_TEXT )
                .attr( {
                } )
                .css( {
                    'margin-left' : '8px'
                ,   'margin-right' : '8px'
                } );
            
            jq_range_container.find( 'input.tweet_number' )
                .attr( {
                } )
                .css( {
                    'width' : '32px'
                } );
            
            self.jq_since_id = jq_since_id = jq_range_container.find( 'input[name="since_id"]' );
            self.jq_until_id = jq_until_id = jq_range_container.find( 'input[name="until_id"]' );
            self.jq_limit_tweet_number = jq_limit_tweet_number = jq_range_container.find( 'input[name="limit"]' );
            
            if ( OPTIONS.DEFAULT_LIMIT_TWEET_NUMBER ) {
                jq_limit_tweet_number.val( OPTIONS.DEFAULT_LIMIT_TWEET_NUMBER );
            }
            
            jq_botton_container = $( '<ul />' )
                .addClass( SCRIPT_NAME + '_button_container' )
                .attr( {
                } )
                .css( {
                    'position' : 'relative'
                ,   'left' : '50%'
                ,   'float' : 'left'
                ,   'margin' : '16px 0 0 0'
                } );
            
            jq_status_container = $( '<div />' )
                .addClass( SCRIPT_NAME + '_status' )
                .attr( {
                } )
                .css( {
                    'position' : 'relative'
                ,   'width' : '100%'
                ,   'height' : '70%'
                ,   'background' : 'ghostwhite'
                } );
            
            self.jq_log = jq_log = $( '<div />' )
                .addClass( SCRIPT_NAME + '_log' )
                .attr( {
                    readonly : 'readonly'
                } )
                .css( {
                    'position' : 'absolute'
                ,   'top' : '50%'
                ,   'left' : '50%'
                ,   'transform' : 'translate(-50%, -50%)'
                ,   'width' : '95%'
                ,   'height' : '90%'
                ,   'overflow' : 'scroll'
                ,   'border' : 'inset ghostwhite 1px'
                ,   'padding' : '4px 4px 4px 4px'
                ,   'background' : 'snow'
                } );
            
            //jq_botton_container.append( jq_button_start ).append( jq_button_stop ).append( jq_button_close ).find( 'button' )
            jq_botton_container.append( jq_button_start ).append( jq_button_stop ).find( 'button' )
                .addClass( 'btn' )
                .css( {
                    'position' : 'relative'
                ,   'left' : '-50%'
                ,   'float' : 'left'
                ,   'margin' : '0 24px 0 24px'
                } );
            
            jq_toolbox.append( jq_range_container ).append( jq_botton_container );
            
            jq_status_container.append( jq_log );
            
            jq_dialog.append( jq_toolbox ).append( jq_status_container );
            
            jq_container.append( jq_dialog );
            
            jq_container.appendTo( $( d.body ) );
            
            return self;
        } // end of init_container()
    
    ,   clear_log : function ( log_string ) {
            var self = this,
                jq_log = self.jq_log;
            
            if ( ! jq_log ) {
                return self;
            }
            
            jq_log.html( '' );
            
            return self;
        } // end of clear_log()
        
    ,   log : function () {
            var self = this,
                jq_log = self.jq_log,
                text = to_array( arguments ).join( ' ' ) + '\n',
                html = text.replace( /(https?:\/\/[\w\-.:\/]+)/g, '<a href="$1" target="blank">$1</a>' ),
                jq_paragraph;
            
            if ( ! jq_log ) {
                return self;
            }
            
            jq_paragraph = $( '<pre />' )
                .html( html )
                .css( {
                    'font-size' : '12px'
                } );
            
            jq_log.append( jq_paragraph );
            jq_log.scrollTop( jq_log.prop( 'scrollHeight' ) );
            
            return self;
        } // end of log()
    
    ,   log_hr : function () {
            var self = this;
            
            self.log( '--------------------------------------------------------------------------------' ); 
            
            return self
        } // end of log_hr()
    
    ,   reset_flags : function () {
            var self = this;
            
            if ( ! self.jq_container ) {
                return self;
            }
            
            self.downloading = false;
            self.stopping = false;
            self.closing = false;
            
            return self;
        } // end of reset_flags()
    
    ,   reset_buttons : function () {
            var self = this;
            
            if ( ! self.jq_container ) {
                return self;
            }
            
            self.jq_button_start.removeAttr( 'disabled' );
            self.jq_button_stop.attr( 'disabled', 'disabled' );
            self.jq_button_close.removeAttr( 'disabled' );
            
            return self;
        } // end of reset_flags()
    
    ,   show_container : function () {
            var self = this,
                jq_container = self.jq_container;
            
            if ( ! jq_container ) {
                self.init_container();
                
                jq_container = self.jq_container;
            }
            
            self.reset_flags();
            self.reset_buttons();
            
            self.jq_since_id.val( '' );
            self.jq_until_id.val( '' );
            self.clear_log();
            
            jq_container.show();
            
            return self;
        } // end of show_container()
    
    ,   hide_container : function () {
            var self = this,
                jq_container = self.jq_container;
            
            if ( ! jq_container ) {
                return self;
            }
            
            jq_container.hide();
            
            return self;
        } // end of hide_container()
    
    ,   start_download : function () {
            var self = this,
                screen_name = get_screen_name(),
                since_id = get_tweet_id( self.jq_since_id.val() ),
                until_id = get_tweet_id( self.jq_until_id.val() ),
                limit_tweet_number = parseInt( self.jq_limit_tweet_number.val().trim(), 10 ),
                limit_tweet_number = isNaN( limit_tweet_number ) ? null : limit_tweet_number,
                max_id = '',
                min_id = '',
                is_limited = false,
                total_tweet_counter = 0,
                total_image_counter = 0,
                zip;
            
            if ( self.downloading ) {
                return self;
            }
            
            if ( since_id && until_id && ( until_id <= since_id ) ) {
                self.log( '[Error]', 'Wrong range' );
                
                finish();
                
                return self;
            }
            
            self.downloading = true;
            self.stopping = false;
            self.closing = false;
            
            self.jq_since_id.val( ( since_id ) ? since_id : '' );
            self.jq_until_id.val( ( until_id ) ? until_id : '' );
            
            zip = new JSZip();
            
            
            function is_error( timeline_result ) {
                if ( timeline_result.response_json ) {
                    return false;
                }
                var jqXHR = timeline_result.jqXHR;
                
                self.log_hr();
                self.log( '[Error]', jqXHR.status, jqXHR.statusText );
                
                finish();
                
                return true;
            } // end of is_error()
            
            
            function is_close() {
                if ( ! self.closing ) {
                    return false;
                }
                
                close();
                
                //finish();
                
                return true;
            } // end of is_close()
            
            
            function is_stop() {
                if ( ! self.stopping ) {
                    return false;
                }
                
                stop();
                
                finish();
                
                return true;
            } // end of is_stop()
            
            
            function is_complete( timeline_result ) {
                if (
                    ( ! timeline_result.response_json.has_more_items ) ||
                    ( timeline_result.tweet_infos.length <= 0 ) ||
                    ( since_id && ( timeline_result.response_json.min_position < since_id ) ) ||
                    ( ( function() { is_limited = !! ( limit_tweet_number && ( limit_tweet_number <= total_tweet_counter ) ); return is_limited; } )() )
                ) {
                    complete();
                    
                    finish();
                    
                    return true;
                }
                
                return false;
            } // end of is_complete()
            
            
            function close() {
                self.hide_container();
            } // end of close()
            
            
            function stop() {
                self.log_hr();
                self.log( '[Stop]', min_id, '-', max_id, '( Tweet:', total_tweet_counter, '/ Image:', total_image_counter, ')' );
                
                save();
            } // end of stop()
            
            
            function complete() {
                self.log_hr();
                self.log( '[Complete' + ( is_limited  ? '(limited)' : '' ) + ']', min_id, '-', max_id, '( Tweet:', total_tweet_counter, '/ Image:', total_image_counter, ')' );
                
                save();
            } // end of complete()
            
            
            function save() {
                if ( ( ! min_id ) || ( ! max_id ) || ( total_tweet_counter <= 0 ) || ( total_image_counter <= 0 ) ) {
                    return;
                }
                
                var filename_prefix = [ screen_name, min_id, max_id, 'images' ].join( '-' );
                
                zip.file( filename_prefix + '.log', self.jq_log.text() );
                
                zip.generateAsync( { type : 'blob' } ).then( function ( zip_content ) {
                    var zip_filename = filename_prefix + '.zip';
                    
                    save_blob( zip_filename, zip_content );
                } );
                
            } // end of save()
            
            
            function finish() {
                self.reset_flags();
                self.reset_buttons();
            } // end of finish()
            
            
            function get_next_media_timeline( max_position ) {
                if ( is_close() || is_stop() ) {
                    return;
                }
                
                get_media_timeline( screen_name, max_position, function ( timeline_result ) {
                    if ( is_error( timeline_result ) ) {
                        return;
                    }
                    
                    var current_tweet_infos = [];
                    
                    $.each( timeline_result.tweet_infos, function ( index, tweet_info ) {
                        var tweet_id = tweet_info.tweet_id;
                        
                        if ( until_id && ( until_id <= tweet_id ) ) {
                            return;
                        }
                        
                        if ( since_id && ( tweet_id <= since_id ) ) {
                            return;
                        }
                        
                        if ( tweet_info.image_urls.length <= 0 ) {
                            return;
                        }
                        
                        current_tweet_infos.push( tweet_info );
                    } );
                    
                    
                    function get_next_tweet_images() {
                        if ( is_close() || is_stop() || is_complete( timeline_result ) ) {
                            return;
                        }
                        
                        var current_tweet_info = current_tweet_infos.shift(),
                            current_image_result_map = {},
                            current_image_download_counter = 0;
                        
                        if ( ! current_tweet_info ) {
                            get_next_media_timeline( timeline_result.response_json.min_position );
                            return;
                        }
                        
                        self.log( ( 1 + total_tweet_counter ) + '.', current_tweet_info.datetime, current_tweet_info.tweet_url );
                        
                        $.each( current_tweet_info.image_urls, function ( index, image_url ) {
                            GM_xmlhttpRequest( {
                                method : 'GET'
                            ,   url : image_url
                            ,   responseType : 'arraybuffer'
                            ,   onload : function ( response ) {
                                    push_image_result( image_url, response.response );
                                }
                            ,   onerror : function ( response ) {
                                    push_image_result( image_url, null, response.status + ' ' + response.statusText );
                                }
                            } );
                        } );
                        
                        
                        function push_image_result( image_url, arraybuffer, error_message ) {
                            if ( current_image_result_map[ image_url ] ) {
                                return;
                            }
                            
                            current_image_result_map[ image_url ] = {
                                arraybuffer : arraybuffer
                            ,   error_message : error_message
                            };
                            
                            current_image_download_counter ++;
                            
                            if ( current_image_download_counter < current_tweet_info.image_urls.length ) {
                                return;
                            }
                            
                            var current_tweet_id = current_tweet_info.tweet_id;
                            
                            if ( ( ! max_id ) || ( max_id < current_tweet_id ) ) {
                                max_id = current_tweet_id;
                            }
                            
                            if ( ( ! min_id ) || ( current_tweet_id < min_id ) ) {
                                min_id = current_tweet_id;
                            }
                            
                            total_tweet_counter ++;
                            total_image_counter += current_image_download_counter;
                            
                            $.each( current_tweet_info.image_urls, function ( index, image_url ) {
                                var image_result = current_image_result_map[ image_url ];
                                
                                if ( image_result.arraybuffer ) {
                                    self.log( '  img' + ( 1 + index ) + ')', image_url );
                                    
                                    var image_filename = [ screen_name, current_tweet_id, 'img' + ( 1 + index ) ].join( '-' ) + '.' + get_img_extension( image_url );
                                    
                                    zip.file( image_filename, image_result.arraybuffer );
                                }
                                else {
                                    self.log( '  img' + ( 1 + index ) + ')', image_url, '=>', image_result.error_message );
                                }
                            } );
                            
                            get_next_tweet_images();
                        } // end of push_image_result()
                        
                    
                    } // end of get_next_tweet_images()
                    
                    
                    get_next_tweet_images();
                } );
            } // end of get_next_media_timeline()
            
            
            get_next_media_timeline( until_id );
            
            return self;
        } // end of start_download()
    
    ,   on_start : function ( event ) {
            var self = this;
            
            self.clear_log();
            
            self.jq_button_start.attr( 'disabled', 'disabled' );
            self.jq_button_stop.removeAttr( 'disabled' );
            
            self.start_download();
            
            return self;
        } // end of on_start()
    
    ,   on_stop : function ( event ) {
            var self = this;
            
            self.jq_button_stop.attr( 'disabled', 'disabled' );
            self.stopping = true;
            
            return self;
        } // end of on_stop()
    
    ,   on_close : function ( event ) {
            var self = this;
            
            self.jq_button_start.attr( 'disabled', 'disabled' );
            self.jq_button_stop.attr( 'disabled', 'disabled' );
            
            if ( self.downloading ) {
                self.closing = true;
                return self;
            }
            
            self.hide_container();
            
            return self;
        } // end of on_close()
    
    } );
    
    MediaDownload.init();
    
    
    function download_media_timeline() {
        MediaDownload.show_container();
    } // end of download_media_timeline()
    
    
    return download_media_timeline;
} )(); // end of download_media_timeline()



function insert_download_button( jq_media_container ) {
    var button_id = SCRIPT_NAME + '_download_button',
        jq_button = $( '<a />' )
            .text( OPTIONS.DOWNLOAD_BUTTON_TEXT )
            .attr( {
                id : button_id
            ,   href : '#'
            ,   title : OPTIONS.DOWNLOAD_BUTTON_HELP_TEXT
            } )
            .css( {
                'font-size' : '16px'
            ,   'vertical-align' : 'middle'
            ,   'text-decoration' : 'underline'
            } ),
        jq_media_container = ( jq_media_container ) ? jq_media_container : $( 'li[data-element-term="photos_and_videos_toggle"]' );
    
    if ( jq_media_container.size() <= 0 ) {
        return;
    }
    
    $( '#' + button_id ).remove();
    
    jq_button.click( function ( event ) {
        event.stopPropagation();
        event.preventDefault();
        
        jq_button.blur();
        
        download_media_timeline();
        
        return false;
    } );
    
    jq_media_container.append( jq_button );
    
} // end of insert_download_button()


function start_mutation_observer() {
    new MutationObserver( function ( records ) {
        records.forEach( function ( record ) {
            var target = record.target;
                            
            to_array( record.addedNodes ).forEach( function ( addedNode ) {
                if ( addedNode.nodeType != 1 ) {
                    return;
                }
                
                var jq_node = $ ( addedNode ),
                    jq_media_container = ( jq_node.attr( 'data-element-term' ) == 'photos_and_videos_toggle' ) ? jq_node : jq_node.find( 'li[data-element-term="photos_and_videos_toggle"]' );
                
                if ( 0 < jq_media_container.size() ) {
                    insert_download_button( jq_media_container );
                }
            } );
        } );
    } ).observe( d.body, { childList : true, subtree : true } );
    
} // end of start_mutation_observer()


function initialize() {
    insert_download_button();
    
    start_mutation_observer();
    
} // end of initialize()

// }

initialize(); // エントリポイント

} )( window, document );

// ■ end of file
