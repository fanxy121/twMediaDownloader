// ==UserScript==
// @name            twMediaDownloader
// @namespace       http://furyu.hatenablog.com/
// @author          furyu
// @version         0.1.1.1
// @include         https://twitter.com/*
// @require         https://ajax.googleapis.com/ajax/libs/jquery/2.2.4/jquery.min.js
// @require         https://cdnjs.cloudflare.com/ajax/libs/jszip/3.0.0/jszip.min.js
// @grant           GM_xmlhttpRequest
// @grant           GM_setValue
// @grant           GM_getValue
// @connect         twitter.com
// @connect         api.twitter.com
// @connect         pbs.twimg.com
// @connect         video.twimg.com
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
    VIDEO_DOWNLOAD_LINK : true // true: 個別ツイートに動画ダウンロードリンクを追加
    
,   OPERATION : true // true: 動作中、false: 停止中

,   DEFAULT_LIMIT_TWEET_NUMBER : 100 // ダウンロードできる画像付きツイート数制限のデフォルト値
,   DEFAULT_SUPPORT_IMAGE : true // true: 画像をダウンロード対象にする
,   DEFAULT_SUPPORT_GIF : true // true: アニメーションGIF（から変換された動画）をダウンロード対象にする
,   DEFAULT_SUPPORT_VIDEO : true // true: 動画をダウンロード対象にする（未サポート）
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
    } )(),
    IS_CHROME_EXTENSION = !! ( w.is_chrome_extension ),
    
    OAUTH2_TOKEN_API_URL = 'https://api.twitter.com/oauth2/token',
    ENCODED_TOKEN_CREDENTIAL = 'VGdITk1hN1daRTdDeGkxSmJrQU1ROlNIeTltQk1CUE5qM1kxN2V0OUJGNGc1WGVxUzR5M3ZrZVcyNFB0dERjWQ==',
    API_VIDEO_CONFIG_BASE = 'https://api.twitter.com/1.1/videos/tweet/config/#TWEETID#.json',
    API_TWEET_SHOW_BASE = 'https://api.twitter.com/1.1/statuses/show.json?include_profile_interstitial_type=1&include_blocking=1&include_blocked_by=1&include_followed_by=1&include_want_retweets=1&skip_status=1&cards_platform=Web-12&include_cards=1&include_ext_alt_text=true&include_reply_count=1&tweet_mode=extended&trim_user=false&include_ext_media_color=true&id=#TWEETID#',
    
    oauth2_access_token = null,
    limit_tweet_number = OPTIONS.DEFAULT_LIMIT_TWEET_NUMBER,
    support_image = false,
    support_gif = false,
    support_video = false;


switch ( LANGUAGE ) {
    case 'ja' :
        OPTIONS.DOWNLOAD_BUTTON_TEXT = '⇩';
        OPTIONS.DOWNLOAD_BUTTUN_TEXT_SEARCHTIMELINE = 'メディア ⇩';
        OPTIONS.DOWNLOAD_BUTTON_HELP_TEXT = 'メディアタイムラインの画像を保存';
        OPTIONS.DIALOG_TWEET_ID_RANGE_HEADER = '保存対象 Tweet ID 範囲';
        OPTIONS.DIALOG_TWEET_ID_RANGE_MARK = '＜ ID ＜';
        OPTIONS.DIALOG_LIMIT_TWEET_NUMBER_TEXT = '制限数';
        OPTIONS.DIALOG_BUTTON_START_TEXT = '開始';
        OPTIONS.DIALOG_BUTTON_STOP_TEXT = '停止';
        OPTIONS.DIALOG_BUTTON_CLOSE_TEXT = '閉じる';
        OPTIONS.CHECKBOX_IMAGE_TEXT = '画像';
        OPTIONS.CHECKBOX_GIF_TEXT = '動画(GIF)';
        OPTIONS.CHECKBOX_VIDEO_TEXT = '動画';
        OPTIONS.CHECKBOX_ALERT = '最低でも一つはチェックを入れて下さい';
        break;
    default:
        OPTIONS.DOWNLOAD_BUTTON_TEXT = '⇩';
        OPTIONS.DOWNLOAD_BUTTUN_TEXT_SEARCHTIMELINE = 'Media ⇩';
        OPTIONS.DOWNLOAD_BUTTON_HELP_TEXT = 'Download images from media timeline';
        OPTIONS.DIALOG_TWEET_ID_RANGE_HEADER = 'Download Tweet ID range';
        OPTIONS.DIALOG_TWEET_ID_RANGE_MARK = '< ID <';
        OPTIONS.DIALOG_LIMIT_TWEET_NUMBER_TEXT = 'Limit';
        OPTIONS.DIALOG_BUTTON_START_TEXT = 'Start';
        OPTIONS.DIALOG_BUTTON_STOP_TEXT = 'Stop';
        OPTIONS.DIALOG_BUTTON_CLOSE_TEXT = 'Close';
        OPTIONS.CHECKBOX_IMAGE_TEXT = 'Images';
        OPTIONS.CHECKBOX_GIF_TEXT = 'Videos(GIF)';
        OPTIONS.CHECKBOX_VIDEO_TEXT = 'Videos';
        OPTIONS.CHECKBOX_ALERT = 'Please select at least one checkbox !';
        break;
}


// }


// ■ 関数 {

// 参考: [複数のクラス名の存在を確認（判定） | jQuery逆引き | Webサイト制作支援 | ShanaBrian Website](http://shanabrian.com/web/jquery/has-classes.php)
$.fn.hasClasses = function( selector, or_flag ) {
    var self = this,
        class_names,
        counter = 0;
    
    if ( typeof selector === 'string' ) {
        selector = selector.trim();
        class_names = ( selector.match( /^\./ ) ) ? selector.replace( /^\./, '' ).split( '.' ) : selector.split( ' ' )
    }
    else {
        class_names = selector;
    }
    class_names.forEach( function( class_name ) {
        if ( self.hasClass( class_name ) ) {
            counter ++;
        }
    } );
    
    if ( or_flag && 0 < counter ) {
        return true;
    }
    if ( counter === class_names.length ) {
        return true;
    }
    return false;
}; // end of $.fn.hasClasses()


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
    
    if ( ! url.trim().match( /^https?:\/\/[^\/]+\/([^\/?#]+)/ ) ) {
        return null;
    }
    
    var screen_name = RegExp.$1;
    
    if ( screen_name == 'search' ) {
        return null;
    }
    return screen_name;
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


function datetime_to_timestamp( datetime ) {
    return datetime.replace( /[\/:]/g, '' ).replace( / /g, '_' )
} // end of datetime_to_timestamp()


function save_blob( filename, blob ) {
    var blobURL = URL.createObjectURL( blob ),
        download_button = d.createElement( 'a' );
    
    download_button.href = blobURL;
    download_button.download = filename;
    
    d.documentElement.appendChild( download_button );
    
    download_button.click();
    
    download_button.parentNode.removeChild( download_button );
} // end of save_blob()


var fetch_url = ( function () {
    if ( IS_CHROME_EXTENSION || ( typeof GM_xmlhttpRequest != 'function' ) ) {
        return function ( url, options ) {
            var xhr = new XMLHttpRequest();
            
            xhr.open( 'GET', url, true );
            xhr.responseType = ( options.responseType ) ? ( options.responseType ) : 'arraybuffer';
            xhr.onload = function () {
                if ( xhr.readyState != 4 ) {
                    return;
                }
                if ( typeof options.onload == 'function' ) {
                    options.onload( xhr );
                }
            };
            xhr.onerror = function () {
                if ( typeof options.onerror == 'function' ) {
                    options.onerror( xhr );
                }
            };
            xhr.send();
        };
    }
    return function ( url, options ) {
        GM_xmlhttpRequest( {
            method : 'GET'
        ,   url : url
        ,   responseType : ( options.responseType ) ? ( options.responseType ) : 'arraybuffer'
        ,   onload : function ( response ) {
                if ( typeof options.onload == 'function' ) {
                    options.onload( response );
                }
            }
        ,   onerror : function ( response ) {
                if ( typeof options.onerror == 'function' ) {
                    options.onerror( response );
                }
            }
        } );
    };
} )();


var set_value = ( function () {
    if ( typeof GM_setValue != 'undefined' ) {
        return function ( name, value ) {
            return GM_setValue( name, value );
        };
    }
    return function ( name, value ) {
        return localStorage.setItem( name, value );
    };
} )(); // end of set_value()


var get_value = ( function () {
    if ( typeof GM_getValue != 'undefined' ) {
        return function ( name ) {
            return GM_getValue( name );
        };
    }
    return function ( name ) {
        return localStorage.getItem( name );
    };
} )(); // end of get_value()


var download_media_timeline = ( function () {
    var TemplateMediaTimeline = {
//          DEFAULT_UNTIL_ID : '9223372036854775807' // 0x7fffffffffffffff = 2^63-1
            DEFAULT_UNTIL_ID : '999999999999999999'
              // [2017/10/25] 最新の画像がダウンロードできなくなったので修正
              //   922337203685477580を超えたからだと思われる→比較する際に上位から18桁分しか評価されていない？
              //   ただし、9223372036854775808(=2^63)を指定すると一つもダウンロードできなくなるので、範囲チェックはされている模様
        
        ,   timeline_status : null // 'media' / 'search' / 'end' / 'error'
        ,   screen_name : null
        ,   search_query : null
        ,   until_id : null
        ,   since_id : null
        ,   current_min_id : null
        ,   current_max_position : null
        ,   tweet_info_list : null
        
        ,   media_timeline_parameters : null
        ,   search_timeline_parameters : null
        
        ,   init : function ( screen_name, until_id, since_id, filter_info ) {
                var self = this,
                    is_search_timeline = self.is_search_timeline = /\/search/.test( w.location.href );
                
                self.filter_info = filter_info;
                self.timeline_status = ( is_search_timeline ) ? 'search' : 'media';
                //self.timeline_status = 'search'; // ※テスト用
                self.screen_name = screen_name;
                self.search_query = ( is_search_timeline ) ?
                    $( '#search-query' ).val().replace( /-?(?:filter:(?:images|videos|native_video|media|vine|periscope)|card_name:animated_gif)(?:\s+OR\s+)?/g, ' ' ).replace( /\s+/g, ' ' ).trim() :
                    // 本スクリプトと競合するフィルタの類は削除しておく
                    null;
                
                if ( is_search_timeline && ( ! self.search_query ) ) {
                    self.search_query = 'twitter'; // ダミー
                }
                self.since_id = ( since_id ) ? since_id : null;
                self.current_max_position = self.current_min_id = self.until_id = ( until_id ) ? until_id : self.DEFAULT_UNTIL_ID;
                self.tweet_info_list = [];
                
                self.media_timeline_parameters = {
                    api_endpoint : {
                        url : 'https://twitter.com/i/profiles/show/' + ( ( self.screen_name ) ? self.screen_name : 'twitter' ) + '/media_timeline'
                    ,   data : {
                            include_available_features : 1
                        ,   include_entities : 1
                        ,   reset_error_state : false
                        ,   last_note_ts : null
                        ,   max_position : null
                        }
                    }
                };
                
                self.search_timeline_parameters = {
                    is_first : true
                ,   html_endpoint : {
                        url : 'https://twitter.com/search'
                    ,   data : {
                            f : 'tweets'
                        ,   vertical : 'default'
                        ,   src : 'typd'
                        ,   q : null
                        }
                    }
                ,   api_endpoint : {
                        url : 'https://twitter.com/i/search/timeline'
                    ,   data : {
                            f : 'tweets'
                        ,   vertical : 'default'
                        ,   src : 'typd'
                        ,   include_available_features : '1'
                        ,   include_entities : '1'
                        ,   reset_error_state : 'false'
                        ,   q : null
                        ,   last_note_ts : null
                        ,   max_position : null
                        }
                    }
                };
                
                return self;
            } // end of init()
        
        ,   fetch_tweet_info : function ( callback ) {
                var self = this,
                    tweet_info = self.tweet_info_list.shift();
                
                if ( tweet_info ) {
                    if ( ( self.since_id ) && ( tweet_info.tweet_id <= self.since_id ) ) {
                        self.timeline_status = 'end';
                        
                        callback( {
                            tweet_info : null
                        ,   timeline_status : self.timeline_status
                        } );
                        return self;
                    }
                    if ( self.current_min_id <= tweet_info.tweet_id ) {
                        return self.fetch_tweet_info( callback );
                    }
                    
                    self.current_min_id = tweet_info.tweet_id;
                    
                    callback( {
                        tweet_info : tweet_info
                    ,   timeline_status : self.timeline_status
                    } );
                    
                    return self;
                }
                
                switch ( self.timeline_status ) {
                    case 'media' :
                        self._get_next_media_timeline( function () {
                            return self.fetch_tweet_info( callback );
                        } );
                        break;
                    
                    case 'search' :
                        self._get_next_search_timeline( function () {
                            return self.fetch_tweet_info( callback );
                        } );
                        break;
                    
                    default :
                        callback( {
                            tweet_info : tweet_info
                        ,   timeline_status : self.timeline_status
                        } );
                        break;
                }
                return self;
            } // end of fetch_tweet_info()
        
        ,   _get_last_note_ts : function () {
                var last_note_ts = null;
                try {
                    last_note_ts = localStorage( '__DM__:latestNotificationTimestamp' );
                }
                catch ( error ) {
                }
                last_note_ts = ( last_note_ts ) ? last_note_ts : new Date().getTime();
                
                return last_note_ts;
            } // end of _get_last_note_ts()
        
        ,   _get_tweet_info : function ( jq_tweet ) {
                var tweet_info = { media_type : null },
                    tweet_url,
                    timestamp_ms,
                    image_urls = [];
                
                tweet_url = jq_tweet.find( '.js-permalink' ).attr( 'href' );
                if ( tweet_url && tweet_url.charAt( 0 ) == '/' ) {
                    tweet_url = 'https://twitter.com' + tweet_url;
                }
                tweet_info.tweet_url = tweet_url;
                tweet_info.tweet_id = jq_tweet.find( '*[data-tweet-id]' ).attr( 'data-tweet-id' );
                tweet_info.tweet_screen_name = jq_tweet.find( 'a.js-user-profile-link:first' ).attr( 'href' ).replace( /^.*\//, '' );
                tweet_info.timestamp_ms = timestamp_ms = jq_tweet.find( '*[data-time-ms]' ).attr( 'data-time-ms' );
                tweet_info.datetime = ( timestamp_ms ) ? format_date( new Date( parseInt( timestamp_ms, 10 ) ), 'YYYY/MM/DD hh:mm:ss' ) : '';
                tweet_info.tweet_text = jq_tweet.find( '.js-tweet-text, .tweet-text' ).text();
                
                if ( support_image ) {
                    jq_tweet.find( '.AdaptiveMedia-photoContainer img' ).each( function () {
                        image_urls.push( get_img_url_orig( $( this ).attr( 'src' ) ) );
                    } );
                }
                if ( 0 < image_urls.length ) {
                    tweet_info.media_type = 'image';
                }
                else if ( oauth2_access_token ) {
                    jq_tweet.find( '.AdaptiveMedia-videoContainer .PlayableMedia' ).each( function () {
                        if ( $( this ).hasClass( 'PlayableMedia--gif' ) ) {
                            if ( ! support_gif ) {
                                return;
                            }
                            image_urls.push( API_VIDEO_CONFIG_BASE.replace( '#TWEETID#', tweet_info.tweet_id ) );
                            tweet_info.media_type = 'gif';
                        }
                        else {
                            if ( ! support_video ) {
                                return;
                            }
                            image_urls.push( API_TWEET_SHOW_BASE.replace( '#TWEETID#', tweet_info.tweet_id ) );
                            tweet_info.media_type = 'video';
                        }
                        return false; // video は現状では 1 つのみサポート
                    } );
                }
                tweet_info.image_urls = image_urls;
                
                return tweet_info;
            } // end of _get_tweet_info()
        
        ,   _get_next_media_timeline : function ( callback ) {
                var self = this,
                    api_endpoint = self.media_timeline_parameters.api_endpoint,
                    data = api_endpoint.data;
                
                data.last_note_ts = self._get_last_note_ts();
                data.max_position = self.current_max_position;
                
                $.getJSON( api_endpoint.url, data )
                .success( function ( json ) {
                    var tweet_info_list = self.tweet_info_list,
                        tweet_count = 0,
                        min_id = self.DEFAULT_UNTIL_ID;
                    
                    $( '<div/>' ).html( json.items_html ).find( '.js-stream-item' ).each( function () {
                        var tweet_info = self._get_tweet_info( $( this ) );
                        
                        if ( ( ! tweet_info ) || ( ! tweet_info.tweet_id  ) || ( ! tweet_info.media_type ) ) {
                            return;
                        }
                        tweet_info_list.push( tweet_info );
                        
                        if ( tweet_info.tweet_id < min_id ) {
                            min_id = tweet_info.tweet_id;
                        }
                        tweet_count ++;
                    } );
                    
                    if ( json.min_position ) {
                        self.current_max_position = json.min_position;
                    }
                    else if ( min_id < self.current_max_position ) {
                        self.current_max_position = min_id;
                    }
                    else {
                        self.timeline_status = 'search';
                    }
                    
                    if ( ! json.has_more_items ) {
                        self.timeline_status = 'search';
                    }
                } )
                .error( function ( jqXHR, textStatus, errorThrown ) {
                    console.error( api_endpoint.url, textStatus );
                    self.timeline_status = 'error';
                } )
                .complete( function () {
                    callback();
                } );
            } // end of _get_next_media_timeline()
        
        ,   _get_next_search_timeline : function ( callback ) {
                var self = this,
                    html_endpoint = self.search_timeline_parameters.html_endpoint,
                    html_data = html_endpoint.data,
                    api_endpoint = self.search_timeline_parameters.api_endpoint,
                    api_data = api_endpoint.data,
                    filters = [];
                
                if ( self.search_timeline_parameters.is_first ) {
                    if ( self.is_search_timeline ) {
                        html_data.q = self.search_query;
                    }
                    else {
                        html_data.q = 'exclude:retweets from:' + self.screen_name + ' max_id:' + self.current_max_position;
                        if ( self.since_id ) {
                            html_data.q += ' since_id:'+ self.since_id;
                        }
                    }
                    
                    if ( self.filter_info.image ) {
                        filters.push( 'filter:images' );
                    }
                    if ( self.filter_info.gif ) {
                        filters.push( 'card_name:animated_gif' );
                    }
                    if ( self.filter_info.video ) {
                        //filters.push( 'filter:videos' ); // TODO: 外部サイトの動画(YouTube等)は未サポート← 'filter:videos' だとそれらも含む
                        filters.push( 'filter:native_video' );
                    }
                    
                    html_data.q += ' ' + filters.join( ' OR ' )
                    html_data.q += ' -filter:vine -filter:periscope'; // TODO: Vine, Periscope は未サポート
                    
                    if ( self.is_search_timeline ) {
                        w.location.href.replace( /^.*\?/, '' ).split( '&' ).forEach( function ( param ) {
                            var parts = param.split( '=' );
                            
                            if ( parts.length != 2 ) {
                                return;
                            }
                            parts[ 1 ] = decodeURIComponent( parts[ 1 ] );
                            
                            switch ( parts[ 0 ] ) {
                                case 's' : // follows: フォローしているユーザーのみ
                                case 'near' : // me: 近くの場所
                                case 'l': // 言語
                                    html_data[ parts[ 0 ] ] = parts[ 1 ];
                                    break;
                            }
                        } );
                    }
                    
                    $.ajax( {
                        type : 'GET'
                    ,   url : html_endpoint.url
                    ,   data : html_data
                    ,   dataType : 'html'
                    } )
                    .success( function ( html ) {
                        var jq_result = $( '<div />' ).html( html ),
                            tweet_info_list = self.tweet_info_list,
                            tweet_count = 0;
                        
                        self.current_max_position = jq_result.find( '*[data-min-position]' ).attr( 'data-min-position' );
                        
                        if ( self.current_max_position ) {
                            jq_result.find( '.js-stream-item' ).each( function () {
                                var tweet_info = self._get_tweet_info( $( this ) );
                                
                                if ( ( ! tweet_info ) || ( ! tweet_info.tweet_id  ) || ( ! tweet_info.media_type ) ) {
                                    return;
                                }
                                tweet_info_list.push( tweet_info );
                                tweet_count ++;
                            } );
                        }
                        else {
                            console.error( '"data-min-position" not found' );
                            self.timeline_status = 'error';
                        }
                    } )
                    .error( function ( jqXHR, textStatus, errorThrown ) {
                        console.error( html_endpoint.url, textStatus );
                        self.timeline_status = 'error';
                    } )
                    .complete( function () {
                        callback();
                    } );
                    
                    api_data.q = html_data.q; // クエリは最初に設定したもので共通
                    self.search_timeline_parameters.is_first = false;
                    
                    return self;
                }
                
                api_data.last_note_ts = self._get_last_note_ts();
                api_data.max_position = self.current_max_position;
                
                $.getJSON( api_endpoint.url, api_data )
                .success( function ( json ) {
                    var tweet_info_list = self.tweet_info_list,
                        tweet_count = 0;
                    
                    if ( ! json.inner ) {
                        console.error( '"json.inner" not found' );
                        self.timeline_status = 'end';
                        return;
                    }
                    
                    $( '<div/>' ).html( json.inner.items_html ).find( '.js-stream-item' ).each( function () {
                        var tweet_info = self._get_tweet_info( $( this ) );
                        
                        if ( ( ! tweet_info ) || ( ! tweet_info.tweet_id  ) || ( ! tweet_info.media_type ) ) {
                            return;
                        }
                        tweet_info_list.push( tweet_info );
                        tweet_count ++;
                    } );
                    
                    if ( json.inner.min_position ) {
                        if ( json.inner.min_position != self.current_max_position ) {
                            self.current_max_position = json.inner.min_position;
                        }
                        else {
                            // min_position に変化がなければ終了とみなす
                            self.timeline_status = 'end';
                        }
                    }
                    else {
                        self.timeline_status = 'end';
                    }
                    /*
                    // has_more_items が false でも、実際に検索したらまだツイートがある場合がある模様
                    //if ( ! json.inner.has_more_items ) {
                    //    self.timeline_status = 'end';
                    //}
                    */
                } )
                .error( function ( jqXHR, textStatus, errorThrown ) {
                    console.error( api_endpoint.url, textStatus );
                    self.timeline_status = 'error';
                } )
                .complete( function () {
                    callback();
                } );
                
                return self;
            } // end of _get_next_search_timeline()
        
        }, // end of TemplateMediaTimeline
        
        TemplateMediaDownload = {
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
                    jq_checkbox_container,
                    jq_checkbox_image,
                    jq_checkbox_gif,
                    jq_checkbox_video,
                    jq_log;
                
                $( '#' + container_id ).remove();
                
                self.jq_checkbox_image = jq_checkbox_image = $( '<label><input type="checkbox" name="image">' + OPTIONS.CHECKBOX_IMAGE_TEXT + '</label>' )
                    .addClass( SCRIPT_NAME + '_checkbox_image' )
                jq_checkbox_image
                    .find( 'input' )
                    .prop( 'checked', support_image )
                    .change( function ( event ) {
                        var jq_input = $( this );
                        
                        event.stopPropagation();
                        event.preventDefault();
                        
                        support_image = jq_input.is( ':checked' );
                        set_value( SCRIPT_NAME + '_support_image', ( support_image ) ? '1' : '0' );
                    } );
                
                self.jq_checkbox_gif = jq_checkbox_gif = $( '<label><input type="checkbox" name="gif">' + OPTIONS.CHECKBOX_GIF_TEXT + '</label>' )
                    .addClass( SCRIPT_NAME + '_checkbox_gif' );
                jq_checkbox_gif
                    .find( 'input' )
                    .prop( 'checked', support_gif )
                    .change( function ( event ) {
                        var jq_input = $( this );
                        
                        event.stopPropagation();
                        event.preventDefault();
                        
                        support_gif = jq_input.is( ':checked' );
                        set_value( SCRIPT_NAME + '_support_gif', ( support_gif ) ? '1' : '0' );
                    } );
                
                self.jq_checkbox_video = jq_checkbox_video = $( '<label><input type="checkbox" name="video">' + OPTIONS.CHECKBOX_VIDEO_TEXT + '</label>' )
                    .addClass( SCRIPT_NAME + '_checkbox_video' );
                jq_checkbox_video
                    .find( 'input' )
                    .prop( 'checked', support_video )
                    .change( function ( event ) {
                        var jq_input = $( this );
                        
                        event.stopPropagation();
                        event.preventDefault();
                        
                        support_video = jq_input.is( ':checked' );
                        set_value( SCRIPT_NAME + '_support_video', ( support_video ) ? '1' : '0' );
                    } );
                
                self.jq_button_start = jq_button_start = $( '<button />' )
                    .text( OPTIONS.DIALOG_BUTTON_START_TEXT )
                    .addClass( SCRIPT_NAME + '_button_start' )
                    .click( function ( event ) {
                        event.stopPropagation();
                        event.preventDefault();
                        
                        if ( jq_checkbox_container.find( 'input[type=checkbox]:checked' ).length <= 0 ) {
                            alert( OPTIONS.CHECKBOX_ALERT );
                            return;
                        }
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
                        'width' : '48px'
                    } );
                
                self.jq_since_id = jq_since_id = jq_range_container.find( 'input[name="since_id"]' );
                self.jq_until_id = jq_until_id = jq_range_container.find( 'input[name="until_id"]' );
                self.jq_limit_tweet_number = jq_limit_tweet_number = jq_range_container.find( 'input[name="limit"]' );
                
                jq_limit_tweet_number.val( limit_tweet_number );
                
                self.jq_checkbox_container = jq_checkbox_container = $( '<div />' )
                    .addClass( SCRIPT_NAME + '_checkbox_container' )
                    .attr( {
                    } )
                    .css( {
                        'position' : 'relative'
                    ,   'left' : '-50%'
                    ,   'float' : 'left'
                    ,   'margin' : '16px 0 0 0'
                    } );
                
                self.jq_botton_container = jq_botton_container = $( '<div />' )
                    .addClass( SCRIPT_NAME + '_button_container' )
                    .attr( {
                    } )
                    .css( {
                        'position' : 'relative'
                    ,   'left' : ( oauth2_access_token ) ? '60%' : '50%'
                    ,   'float' : 'left'
                    ,   'margin' : '16px 0 0 0'
                    } );
                
                self.jq_status_container = jq_status_container = $( '<div />' )
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
                
                jq_checkbox_container.append( jq_checkbox_image ).append( jq_checkbox_gif ).append( jq_checkbox_video ).find( 'label' )
                    .css( {
                        'display' : 'inline-block'
                    ,   'width' : '100px'
                    ,   'margin-right' : '8px'
                    ,   'vertical-align' : 'top'
                    ,   'color' : '#14171a'
                    ,   'font-size' : '12px'
                    } );
                jq_checkbox_container.find( 'input' )
                    .css( {
                        'margin-right' : '4px'
                    } );
                
                if ( oauth2_access_token ) {
                    jq_botton_container.append( jq_checkbox_container );
                }
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
                    html = text.replace( /[&'`"<>]/g, function( match ) {
                        return {
                            '&' : '&amp;'
                        ,   "'" : '&#x27;'
                        ,   '`' : '&#x60;'
                        ,   '"' : '&quot;'
                        ,   '<' : '&lt;'
                        ,   '>' : '&gt;'
                        }[ match ]
                    } ).replace( /(https?:\/\/[\w\/:%#$&?\(\)~.=+\-;]+)/g, '<a href="$1" target="blank" style="color: #657786;">$1</a>' ),
                    jq_paragraph;
                
                if ( ! jq_log ) {
                    return self;
                }
                
                jq_paragraph = $( '<pre />' )
                    .html( html )
                    .css( {
                        'font-size' : '12px'
                    ,   'line-height' : '16px'
                    ,   'overflow': 'visible'
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
                
                self.jq_button_start.prop( 'disabled', false );
                self.jq_button_stop.prop( 'disabled', true );
                self.jq_button_close.prop( 'disabled', false );
                self.jq_checkbox_container.find( 'input[type=checkbox]' ).prop( 'disabled', false );
                
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
                    is_search_timeline = self.is_search_timeline = /\/search/.test( w.location.href ),
                    screen_name = get_screen_name(),
                    since_id = get_tweet_id( self.jq_since_id.val() ),
                    until_id = get_tweet_id( self.jq_until_id.val() ),
                    max_id = '',
                    min_id = '',
                    max_datetime = '',
                    min_datetime = '',
                    total_tweet_counter = 0,
                    total_image_counter = 0,
                    MediaTimeline = object_extender( TemplateMediaTimeline ).init( screen_name, until_id, since_id, {
                        image : support_image
                    ,   gif : support_gif
                    ,   video : support_video
                    } ),
                    zip;
                
                if ( MediaTimeline.search_query ) {
                    self.log( 'Search Query :', MediaTimeline.search_query );
                }
                self.log( 'Image : ' + ( support_image ? 'on' : 'off' ), ' / GIF : ' + ( support_gif ? 'on' : 'off' ), ' / Video : ' + ( support_video ? 'on' : 'off' ) );
                self.log_hr()
                
                limit_tweet_number = parseInt( self.jq_limit_tweet_number.val().trim(), 10 );
                if ( isNaN( limit_tweet_number ) ) {
                    limit_tweet_number = 0;
                }
                set_value( SCRIPT_NAME + '_limit_tweet_number', String( limit_tweet_number ) );
                
                if ( self.downloading ) {
                    return self;
                }
                
                self.jq_since_id.val( ( since_id ) ? since_id : '' );
                self.jq_until_id.val( ( until_id ) ? until_id : '' );
                
                if ( since_id && until_id && ( until_id <= since_id ) ) {
                    self.log( '[Error]', 'Wrong range' );
                    
                    finish();
                    
                    return self;
                }
                
                self.downloading = true;
                self.stopping = false;
                self.closing = false;
                
                zip = new JSZip();
                
                
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
                
                
                function close() {
                    zip = null;
                    MediaTimeline = null;
                    
                    self.hide_container();
                } // end of close()
                
                
                function stop() {
                    self.log_hr();
                    self.log( '[Stop]', min_id, '-', max_id, ' ( Tweet:', total_tweet_counter, '/ Media:', total_image_counter, ')' );
                    
                    save();
                    
                    if ( min_id ) {
                        self.jq_until_id.val( min_id );
                    }
                } // end of stop()
                
                
                function complete() {
                    self.log_hr();
                    
                    var is_limited = !! ( limit_tweet_number && ( limit_tweet_number <= total_tweet_counter ) );
                    
                    self.log( '[Complete' + ( is_limited  ? '(limited)' : '' ) + ']', min_id, '-', max_id, ' ( Tweet:', total_tweet_counter, '/ Media:', total_image_counter, ')' );
                    
                    save();
                    
                    if ( is_limited && min_id ) {
                        self.jq_until_id.val( min_id );
                    }
                } // end of complete()
                
                
                function save() {
                    if ( ( ! min_id ) || ( ! max_id ) || ( total_tweet_counter <= 0 ) || ( total_image_counter <= 0 ) ) {
                        return;
                    }
                    
                    var filename_head = ( self.is_search_timeline ) ? ( 'search(' + format_date( new Date(), 'YYYYMMDD_hhmmss' ) + ')' ) : screen_name,
                        filename_prefix = [ filename_head, ( min_id + '(' + datetime_to_timestamp( min_datetime ) + ')' ), ( max_id + '(' + datetime_to_timestamp( max_datetime ) + ')' ), 'media' ].join( '-' );
                    
                    zip.file( filename_prefix + '.log', self.jq_log.text() );
                    
                    zip.generateAsync( { type : 'blob' } ).then( function ( zip_content ) {
                        var zip_filename = filename_prefix + '.zip';
                        
                        save_blob( zip_filename, zip_content );
                        
                        zip = null;
                    } );
                    
                } // end of save()
                
                
                function finish() {
                    zip = null;
                    MediaTimeline = null;
                    
                    self.reset_flags();
                    self.reset_buttons();
                } // end of finish()
                
                
                function check_tweet_info( result ) {
                    if ( is_close() || is_stop() ) {
                        return;
                    }
                    
                    if ( 
                        ( ! result ) ||
                        ( ! result.tweet_info ) ||
                        ( limit_tweet_number && ( limit_tweet_number <= total_tweet_counter ) )
                    ) {
                        complete();
                        finish();
                        return;
                    }
                    
                    var current_tweet_info = result.tweet_info,
                        current_image_result_map = {},
                        current_image_download_counter = 0;
                    
                    self.log( ( 1 + total_tweet_counter ) + '.', current_tweet_info.datetime, current_tweet_info.tweet_url );
                    
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
                        
                        var current_tweet_id = current_tweet_info.tweet_id,
                            report_index = 0;
                        
                        if ( ( ! max_id ) || ( max_id < current_tweet_id ) ) {
                            max_id = current_tweet_id;
                            max_datetime = current_tweet_info.datetime;
                        }
                        
                        if ( ( ! min_id ) || ( current_tweet_id < min_id ) ) {
                            min_id = current_tweet_id;
                            min_datetime = current_tweet_info.datetime;
                        }
                        
                        total_tweet_counter ++;
                        total_image_counter += current_image_download_counter;
                        
                        $.each( current_tweet_info.image_urls, function ( index, image_url ) {
                            var image_result = current_image_result_map[ image_url ],
                                media_type = current_tweet_info.media_type,
                                img_extension = ( media_type == 'image' ) ? get_img_extension( image_url ) : image_url.match( /[^\.]*$/ )[0],
                                media_prefix = ( media_type == 'gif' ) ? 'gif' : ( ( media_type == 'image' ) ? 'img' : 'vid' );
                            
                            if ( image_result.arraybuffer ) {
                                report_index ++;
                                
                                var timestamp = datetime_to_timestamp( current_tweet_info.datetime ),
                                    image_filename = [ current_tweet_info.tweet_screen_name, current_tweet_id, timestamp, media_prefix + report_index ].join( '-' ) + '.' + img_extension;
                                
                                self.log( '  ' + media_prefix + report_index + ')', image_url );
                                
                                zip.file( image_filename, image_result.arraybuffer );
                                
                                delete image_result.arraybuffer;
                                image_result.arraybuffer = null;
                            }
                            else {
                                report_index ++;
                                self.log( '  ' + media_prefix + report_index + ')', image_url, '=>', image_result.error_message );
                            }
                        } );
                        
                        MediaTimeline.fetch_tweet_info( check_tweet_info );
                    
                    } // end of push_image_result()
                    
                    
                    function load_image( image_url_index, first_image_url, current_image_url ) {
                        var extension_list = [ 'png', 'jpg', 'gif' ],
                            next_extension_map = {
                                'png' : 'gif'
                            ,   'gif' : 'jpg'
                            ,   'jpg' : 'png'
                            },
                            current_image_url = ( current_image_url ) ? current_image_url : first_image_url,
                            first_extension = get_img_extension( first_image_url, extension_list ),
                            current_extension = get_img_extension( current_image_url, extension_list );
                        
                        current_tweet_info.image_urls[ image_url_index ] = current_image_url;
                        
                        fetch_url( current_image_url, {
                            responseType : 'arraybuffer'
                        ,   onload : function ( response ) {
                                if ( response.status < 200 || 300 <= response.status ) {
                                    // 元の拡張子が png でも、png:orig が取得できない場合がある
                                    // → gif:orig なら取得できるケース有り・ステータスチェックし、エラー時にはリトライする
                                    var next_extension = next_extension_map[ current_extension ];
                                    
                                    if ( next_extension == first_extension ) {
                                        current_tweet_info.image_urls[ image_url_index ] = first_image_url;
                                        push_image_result( first_image_url, null, response.status + ' ' + response.statusText );
                                        return;
                                    }
                                    load_image( image_url_index, first_image_url, current_image_url.replace( '.' + current_extension, '.' + next_extension ) );
                                    return;
                                }
                                push_image_result( current_image_url, response.response );
                            } // end of onload()
                        ,   onerror : function ( response ) {
                                push_image_result( current_image_url, null, response.status + ' ' + response.statusText );
                            } // end of onerror()
                        } );
                        
                    } // end of load_image()
                    
                    
                    if ( current_tweet_info.media_type == 'image' ) {
                        $.each( current_tweet_info.image_urls, function ( index, image_url ) {
                            load_image( index, image_url );
                        } );
                    }
                    else if ( current_tweet_info.media_type == 'gif' ) {
                        $.each( current_tweet_info.image_urls, function ( index, video_info_url ) {
                            $.ajax( {
                                type : 'GET'
                            ,   url : video_info_url
                            ,   dataType : 'json'
                            ,   headers : {
                                    'Authorization' : 'Bearer ' + oauth2_access_token
                                }
                            } )
                            .success( function ( json ) {
                                var video_url = json.track.playbackUrl;
                                
                                current_tweet_info.image_urls[ index ] = video_url;
                                current_tweet_info.video_info = json.track;
                                
                                if ( /\.mp4$/.test( video_url ) ) {
                                    load_image( index, video_url );
                                }
                                else {
                                    push_image_result( video_url, null, 'not supported' );
                                }
                            } )
                            .error( function ( jqXHR, textStatus, errorThrown ) {
                                console.error( video_info_url, textStatus );
                                push_image_result( video_info_url, null, textStatus );
                            } )
                            .complete( function () {
                            } );
                        } );
                    }
                    else {
                        $.each( current_tweet_info.image_urls, function ( index, tweet_info_url ) {
                            $.ajax( {
                                type : 'GET'
                            ,   url : tweet_info_url
                            ,   dataType : 'json'
                            ,   headers : {
                                    'Authorization' : 'Bearer ' + oauth2_access_token
                                }
                            } )
                            .success( function ( json ) {
                                var video_info = null,
                                    video_url = null,
                                    variants = [],
                                    max_bitrate = -1;
                                
                                try {
                                    video_info = json.extended_entities.media[ 0 ].video_info;
                                    variants = video_info.variants;
                                    
                                    variants.forEach( function ( variant ) {
                                        if ( ( variant.content_type == 'video/mp4' ) && ( variant.bitrate ) && ( max_bitrate < variant.bitrate ) ) {
                                            video_url = variant.url;
                                            max_bitrate = variant.bitrate;
                                        }
                                    } );
                                }
                                catch ( error ) {
                                    console.error( tweet_info_url, error );
                                    // TODO: Vine 等は未サポート
                                }
                                
                                current_tweet_info.video_info = video_info;
                                
                                if ( video_url ) {
                                    current_tweet_info.image_urls[ index ] = video_url;
                                    load_image( index, video_url );
                                }
                                else {
                                    push_image_result( tweet_info_url, null, 'not supported' );
                                }
                            } )
                            .error( function ( jqXHR, textStatus, errorThrown ) {
                                console.error( tweet_info_url, textStatus );
                                push_image_result( tweet_info_url, null, textStatus );
                            } )
                            .complete( function () {
                            } );
                        } );
                    }
                } // end of check_tweet_info()
                
                MediaTimeline.fetch_tweet_info( check_tweet_info );
                
                return self;
            } // end of start_download()
        
        ,   on_start : function ( event ) {
                var self = this;
                
                self.clear_log();
                
                self.jq_button_start.prop( 'disabled', true );
                self.jq_button_stop.prop( 'disabled', false );
                self.jq_checkbox_container.find( 'input[type=checkbox]' ).prop( 'disabled', true );
                
                self.start_download();
                
                return self;
            } // end of on_start()
        
        ,   on_stop : function ( event ) {
                var self = this;
                
                self.jq_button_stop.prop( 'disabled', true );
                self.jq_checkbox_container.find( 'input[type=checkbox]' ).prop( 'disabled', false );
                
                self.stopping = true;
                
                return self;
            } // end of on_stop()
        
        ,   on_close : function ( event ) {
                var self = this;
                
                self.jq_button_start.prop( 'disabled', true );
                self.jq_button_stop.prop( 'disabled', true );
                self.jq_checkbox_container.find( 'input[type=checkbox]' ).prop( 'disabled', true );
                
                if ( self.downloading ) {
                    self.closing = true;
                    return self;
                }
                
                self.hide_container();
                
                return self;
            } // end of on_close()
        
        },
        MediaDownload = object_extender( TemplateMediaDownload ).init();
    
    
    function download_media_timeline() {
        MediaDownload.show_container();
    } // end of download_media_timeline()
    
    
    return download_media_timeline;
} )(); // end of download_media_timeline()



function insert_download_button( jq_target_container ) {
    var is_search_timeline = /\/search/.test( w.location.href );
    
    if ( ! jq_target_container ) {
        if ( is_search_timeline ) {
            jq_target_container = $( '.SearchNavigation ul.AdaptiveFiltersBar-nav' );
        }
        else {
            jq_target_container = $( 'li[data-element-term="photos_and_videos_toggle"]' );
        }
    }
    if ( jq_target_container.length <= 0 ) {
        return;
    }
    
    var button_id = SCRIPT_NAME + '_download_button',
        jq_button = $( '<a />' )
            .text( ( is_search_timeline ) ? OPTIONS.DOWNLOAD_BUTTUN_TEXT_SEARCHTIMELINE : OPTIONS.DOWNLOAD_BUTTON_TEXT )
            .attr( {
                id : button_id
            ,   href : '#'
            ,   title : OPTIONS.DOWNLOAD_BUTTON_HELP_TEXT
            } )
            .css( {
                'font-size' : '16px'
            ,   'vertical-align' : 'middle'
            ,   'text-decoration' : 'underline'
            } )
            .click( function ( event ) {
                event.stopPropagation();
                event.preventDefault();
                
                jq_button.blur();
                
                download_media_timeline();
                
                return false;
            } );
    
    if ( is_search_timeline ) {
        $( '#' + button_id ).parents( '.' + SCRIPT_NAME + '_download_button_container' ).remove();
        
        var jq_button_container = $( '<li class="AdaptiveFiltersBar-item u-borderUserColor" />' ).addClass( SCRIPT_NAME + '_download_button_container' );
        
        jq_button.css( {
            'font-size' : '14px'
        ,   'font-weight' : 'bold'
        ,   'line-height' : '20px'
        ,   'color' : '#657786'
        ,   'display' : 'block'
        ,   'padding' : '16px'
        } );
        jq_button_container.append( jq_button );
        jq_target_container.append( jq_button_container );
    }
    else {
        $( '#' + button_id ).remove();
        jq_target_container.append( jq_button );
    }
    
} // end of insert_download_button()


function add_media_link_to_tweet( jq_tweet ) {
    var tweet_id = jq_tweet.attr( 'data-tweet-id' ),
        jq_action_list = jq_tweet.find( '.ProfileTweet-actionList, footer' ),
        jq_playable_media = jq_tweet.find( '.PlayableMedia' ),
        media_link_class_name = SCRIPT_NAME + '_media_link',
        jq_media_link_container = $( '<div><a target="_blank">MP4⇩</a></div>' )
            .addClass( 'ProfileTweet-action ' + media_link_class_name )
            .css( {
                'display' : 'none'
            } ),
        jq_media_link = jq_media_link_container.find( 'a:first' )
            .css( {
                'font-size' : '12px'
            } );
    
    if ( ( ! tweet_id ) || ( jq_playable_media.length <= 0 ) ) {
        return;
    }
    jq_action_list.find( '.' + media_link_class_name ).remove();
    jq_action_list.append( jq_media_link_container );
    
    function activate_media_link( video_url, media_prefix ) {
        var screen_name = jq_tweet.find( 'a.js-user-profile-link:first' ).attr( 'href' ).replace( /^.*\//, '' ),
            timestamp_ms = jq_tweet.find( '*[data-time-ms]' ).attr( 'data-time-ms' ),
            timestamp = ( timestamp_ms ) ? format_date( new Date( parseInt( timestamp_ms, 10 ) ), 'YYYYMMDD_hhmmss' ) : '',
            filename = [ screen_name, tweet_id, timestamp, media_prefix + '1' ].join( '-' ) + '.mp4';
        
        jq_media_link
            .prop( 'href', video_url )
            .click( function ( event ) {
                event.stopPropagation();
                event.preventDefault();
                
                fetch_url( video_url, {
                    responseType : 'blob'
                ,   onload : function ( response ) {
                        save_blob( filename, response.response );
                    }
                ,   onerror : function ( response ) {
                        console.error( video_url, 'fetch failure' );
                    }
                } );
            } );
        
        jq_media_link_container.css( 'display', 'inline-block' );
    }
    
    if ( jq_playable_media.hasClass( 'PlayableMedia--gif' ) ) {
        var video_info_url = API_VIDEO_CONFIG_BASE.replace( '#TWEETID', tweet_id );
        
        $.ajax( {
            type : 'GET'
        ,   url : video_info_url
        ,   dataType : 'json'
        ,   headers : {
                'Authorization' : 'Bearer ' + oauth2_access_token
            }
        } )
        .success( function ( json ) {
            var video_url = json.track.playbackUrl;
            
            if ( ! /\.mp4$/.test( video_url ) ) {
                return;
            }
            activate_media_link( video_url, 'gif' );
        } )
        .error( function ( jqXHR, textStatus, errorThrown ) {
            console.error( video_info_url, textStatus );
        } )
        .complete( function () {
        } );
    }
    else {
        var tweet_info_url = API_TWEET_SHOW_BASE.replace( '#TWEETID', tweet_id );
        
        $.ajax( {
            type : 'GET'
        ,   url : tweet_info_url
        ,   dataType : 'json'
        ,   headers : {
                'Authorization' : 'Bearer ' + oauth2_access_token
            }
        } )
        .success( function ( json ) {
            var video_info = null,
                video_url = null,
                variants = [],
                max_bitrate = -1;
            
            try {
                video_info = json.extended_entities.media[ 0 ].video_info;
                variants = video_info.variants;
                
                variants.forEach( function ( variant ) {
                    if ( ( variant.content_type == 'video/mp4' ) && ( variant.bitrate ) && ( max_bitrate < variant.bitrate ) ) {
                        video_url = variant.url;
                        max_bitrate = variant.bitrate;
                    }
                } );
            }
            catch ( error ) {
                console.error( tweet_info_url, error );
                // TODO: Vine 等は未サポート
            }
            
            if ( ! video_url ) {
                return;
            }
            activate_media_link( video_url, 'video' );
        } )
        .error( function ( jqXHR, textStatus, errorThrown ) {
            console.error( tweet_info_url, textStatus );
        } )
        .complete( function () {
        } );
    }
} // end of add_media_link_to_tweet()


function check_media_tweets( node ) {
    if ( ( ! node ) || ( node.nodeType != 1 ) ) {
        return false;
    }
    
    var jq_node = $( node ),
        tweet_class_names = [ 'js-stream-tweet', 'tweet', 'js-tweet' ],
        tweet_selector = $.map( tweet_class_names, function ( class_name ) {
            return 'div.' + class_name + ':has(.PlayableMedia)';
        } ).join( ',' ),
        jq_tweets = jq_node.find( tweet_selector );
    
    ( function () {
        if ( jq_node.hasClasses( tweet_class_names, true ) ) {
            jq_tweets = jq_tweets.add( jq_node );
            return;
        }
        if ( ! jq_node.hasClass( 'js-media-preview-container' ) ) {
            return;
        }
        jq_node.parents( '.js-modal-panel' ).each( function () {
            jq_tweets = jq_tweets.add( $( this ).find( tweet_selector ) );
        } );
    } )();
    
    jq_tweets.each( function () {
        var jq_tweet = $( this );
        
        add_media_link_to_tweet( jq_tweet );
    } );
    
    return ( 0 < jq_tweets.length );
} // end of check_media_tweets()


function insert_media_links() {
    if ( ! OPTIONS.VIDEO_DOWNLOAD_LINK ) {
        return;
    }
    if ( ! oauth2_access_token ) {
        return;
    }
    check_media_tweets( d.body );
} // end of insert_media_links()


function start_mutation_observer() {
    new MutationObserver( function ( records ) {
        var is_search_timeline = /\/search/.test( w.location.href );
        
        records.forEach( function ( record ) {
            var target = record.target;
                            
            to_array( record.addedNodes ).forEach( function ( addedNode ) {
                if ( addedNode.nodeType != 1 ) {
                    return;
                }
                
                if ( OPTIONS.VIDEO_DOWNLOAD_LINK ) {
                    if ( check_media_tweets( addedNode ) ) {
                        return;
                    }
                }
                
                var jq_node = $( addedNode ),
                    jq_target_container;
                
                if ( is_search_timeline ) {
                    jq_target_container = ( jq_node.hasClass( 'AdaptiveFiltersBar-nav' ) ) ? jq_node : jq_node.find( 'ul.AdaptiveFiltersBar-nav' );
                }
                else {
                    jq_target_container = ( jq_node.attr( 'data-element-term' ) == 'photos_and_videos_toggle' ) ? jq_node : jq_node.find( 'li[data-element-term="photos_and_videos_toggle"]' );
                }
                if ( 0 < jq_target_container.length ) {
                    insert_download_button( jq_target_container );
                }
            } );
        } );
    } ).observe( d.body, { childList : true, subtree : true } );
    
} // end of start_mutation_observer()


function initialize( user_options ) {
    if ( user_options ) {
        Object.keys( user_options ).forEach( function ( name ) {
            if ( user_options[ name ] === null ) {
                return;
            }
            OPTIONS[ name ] = user_options[ name ];
        } );
    }
    
    if ( ! OPTIONS.OPERATION ) {
        return;
    }
    
    if ( ( get_value( SCRIPT_NAME + '_limit_tweet_number' ) !== undefined ) && ( ! isNaN( get_value( SCRIPT_NAME + '_limit_tweet_number' ) ) ) ) {
        limit_tweet_number = parseInt( get_value( SCRIPT_NAME + '_limit_tweet_number' ), 10 );
    }
    else {
        limit_tweet_number = OPTIONS.DEFAULT_LIMIT_TWEET_NUMBER;
        set_value( SCRIPT_NAME + '_limit_tweet_number',  String( limit_tweet_number ) );
    }
    
    if ( get_value( SCRIPT_NAME + '_support_image' ) !== undefined ) {
        support_image = ( get_value( SCRIPT_NAME + '_support_image' ) !== '0' );
    }
    else {
        support_image = OPTIONS.DEFAULT_SUPPORT_IMAGE;
        set_value( SCRIPT_NAME + '_support_image', ( support_image ) ? '1' : '0' );
    }

    if ( get_value( SCRIPT_NAME + '_support_gif' ) !== undefined ) {
        support_gif = ( get_value( SCRIPT_NAME + '_support_gif' ) !== '0' );
    }
    else {
        support_gif = OPTIONS.DEFAULT_SUPPORT_GIF;
        set_value( SCRIPT_NAME + '_support_gif', ( support_gif ) ? '1' : '0' );
    }
    
    if ( get_value( SCRIPT_NAME + '_support_video' ) !== undefined ) {
        support_video = ( get_value( SCRIPT_NAME + '_support_video' ) !== '0' );
    }
    else {
        support_video = OPTIONS.DEFAULT_SUPPORT_VIDEO;
        set_value( SCRIPT_NAME + '_support_video', ( support_video ) ? '1' : '0' );
    }
    
    $.ajax( {
        type : 'POST'
    ,   url : OAUTH2_TOKEN_API_URL
    ,   headers : {
            'Authorization' : 'Basic '+ ENCODED_TOKEN_CREDENTIAL
        ,   'Content-Type' : 'application/x-www-form-urlencoded;charset=UTF-8'
        }
    ,   data : {
            'grant_type' : 'client_credentials'
        }
    ,   dataType : 'json'
    ,   xhrFields : {
            withCredentials : false // Cross-Origin Resource Sharing(CORS)用設定
            // TODO: Chrome 拡張機能だと false であっても Cookie が送信されてしまう
            // → webRequest を有効にして、background.js でリクエストヘッダから Cookie を取り除くようにして対応
        }
    } )
    .success( function ( json ) {
        oauth2_access_token = json.access_token;
    } )
    .error( function ( jqXHR, textStatus, errorThrown ) {
        console.error( OAUTH2_TOKEN_API_URL, textStatus );
        // TODO: Cookies 中に auth_token が含まれていると、403 (code:99)が返ってきてしまう
        // → auth_token は Twitter ログイン中保持されるため、Cookies を送らないようにする対策が取れない場合、対応は困難
        oauth2_access_token = null;
        support_image = true;
        support_gif = false;
        support_video = false;
    } )
    .complete( function () {
        insert_download_button();
        insert_media_links();
        start_mutation_observer();
    } );
    
} // end of initialize()

// }


// ■ エントリポイント
if ( typeof w.twMediaDownloader_chrome_init == 'function' ) {
    // Google Chorme 拡張機能から実行した場合、ユーザーオプションを読み込む
    w.twMediaDownloader_chrome_init( function ( user_options ) {
        initialize( user_options );
    } );
}
else {
    initialize();
}

} )( window, document );

// ■ end of file
