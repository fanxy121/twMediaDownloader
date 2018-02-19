// ==UserScript==
// @name            twMediaDownloader
// @namespace       http://furyu.hatenablog.com/
// @author          furyu
// @version         0.1.1.19
// @include         https://twitter.com/*
// @require         https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require         https://cdnjs.cloudflare.com/ajax/libs/jszip/3.1.4/jszip.min.js
// @require         https://cdnjs.cloudflare.com/ajax/libs/decimal.js/7.3.0/decimal.min.js
// @grant           GM_xmlhttpRequest
// @grant           GM_setValue
// @grant           GM_getValue
// @connect         twitter.com
// @connect         twimg.com
// @connect         cdn.vine.co
// @description     Download images of user's media-timeline on Twitter.
// ==/UserScript==

/*
■ 外部ライブラリ
- [jQuery](https://jquery.com/), [jquery/jquery: jQuery JavaScript Library](https://github.com/jquery/jquery)
    The MIT License
    [License | jQuery Foundation](https://jquery.org/license/)

- [JSZip](https://stuk.github.io/jszip/)
    Copyright (c) 2009-2014 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso
    The MIT License
    [jszip/LICENSE.markdown](https://github.com/Stuk/jszip/blob/master/LICENSE.markdown)

- [MikeMcl/decimal.js: An arbitrary-precision Decimal type for JavaScript](https://github.com/MikeMcl/decimal.js)
    Copyright (c) 2016, 2017 Michael Mclaughlin
    The MIT Licence
    [decimal.js/LICENCE.md](https://github.com/MikeMcl/decimal.js/blob/master/LICENCE.md)

■ 関連記事など
- [Twitter メディアダウンローダ：ユーザータイムラインの原寸画像や動画をまとめてダウンロードするユーザースクリプト(PC用Google Chrome・Firefox等対応) - 風柳メモ](http://furyu.hatenablog.com/entry/20160723/1469282864)
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
    IMAGE_DOWNLOAD_LINK : true // true: 個別ツイートに画像ダウンロードボタンを追加
,   VIDEO_DOWNLOAD_LINK : true // true: 個別ツイートに動画ダウンロードボタンを追加
,   OPEN_MEDIA_LINK_BY_DEFAULT : false // true: デフォルトでメディアリンクを開く（[Alt]＋Click時にダウンロード）
,   ENABLE_FILTER : true // true: 検索タイムライン使用時に filter: をかける
    // TODO: 検索タイムライン使用時、filter: をかけない場合にヒットする画像や動画が、filter: をかけるとヒットしないことがある
    
,   OPERATION : true // true: 動作中、false: 停止中

,   CACHE_OAUTH2_ACCESS_TOKEN : true // true: OAuth2 の Access Token を再利用する
,   QUICK_LOAD_GIF : true // true: アニメーションGIF（から変換された動画）の情報(URL)取得を簡略化

,   DOWNLOAD_SIZE_LIMIT_MB : 500 // ダウンロード時のサイズ制限(MB)

,   DEFAULT_LIMIT_TWEET_NUMBER : 100 // ダウンロードできる画像付きツイート数制限のデフォルト値
,   DEFAULT_SUPPORT_IMAGE : true // true: 画像をダウンロード対象にする
,   DEFAULT_SUPPORT_GIF : true // true: アニメーションGIF（から変換された動画）をダウンロード対象にする
,   DEFAULT_SUPPORT_VIDEO : true // true: 動画をダウンロード対象にする
,   DEFAULT_INCLUDE_RETWEETS : false // true: RTを含む
,   DEFAULT_DRY_RUN : false // true: 走査のみ

,   ENABLE_ZIPREQUEST : true // true: ZipRequest を使用してバックグラウンドでダウンロード＆アーカイブ(拡張機能の場合)
    // TODO: ENABLE_ZIPREQUEST : true 時、Chrome で、ダウンロードに失敗する場合がある
    // → 抜本的な対策が判明するまで、false に
};

// }


// ■ 共通変数 {
var SCRIPT_NAME = 'twMediaDownloader',
    DEBUG = false;

if ( w[ SCRIPT_NAME + '_touched' ] ) {
    return;
}
w[ SCRIPT_NAME + '_touched' ] = true;

if ( /^https:\/\/twitter\.com\/i\/cards/.test( w.location.href ) ) {
    // https://twitter.com/i/cards/～ では実行しない
    return;
}

if ( ( typeof jQuery != 'function' ) || ( ( typeof JSZip != 'function' ) && ( typeof ZipRequest != 'function' ) ) || ( typeof Decimal != 'function' ) ) {
    console.error( SCRIPT_NAME + ':', 'Library not found - ', 'jQuery:', typeof jQuery, 'JSZip:', typeof JSZip, 'ZipRequest:', typeof ZipRequest, 'Decimal:', typeof Decimal );
    return;
}

var $ = jQuery,
    LANGUAGE = ( function () {
        try {
            return $( 'html' ).attr( 'lang' );
        }
        catch ( error ) {
            try{
                return ( w.navigator.browserLanguage || w.navigator.language || w.navigator.userLanguage ).substr( 0, 2 );
            }
            catch ( error ) {
                return 'en';
            }
        }
    } )(),
    IS_CHROME_EXTENSION = !! ( w.is_chrome_extension ),
    IS_FIREFOX = ( 0 <= w.navigator.userAgent.toLowerCase().indexOf( 'firefox' ) ),
    //BASE64_BLOB_THRESHOLD = 30000000, // Data URL(base64) → Blob URL 切替の閾値(Byte) (Firefox用)(TODO: 値は要調整)
    BASE64_BLOB_THRESHOLD = 0, // Data URL(base64) → Blob URL 切替の閾値(Byte) (Firefox用)(TODO: 値は要調整)
    // TODO: Firefox の場合、Blob URL だと警告が出る場合がある・その一方、Data URL 形式だと大きいサイズはダウンロード不可
    // → Data URL 形式だとかなり重く、動作が不安定になるため、全て Blob URL に
    //   ※警告を出さないためには、「≡」→「オプション」→「プライバシーとセキュリティ」（about:preferences#privacy）にて、
    //     「セキュリティ」→「詐欺コンテンツと危険なソフトウェアからの防護」にある、
    //     「☑不要な危険ソフトウェアを警告する(C)」のチェックを外す
    
    OAUTH2_TOKEN_API_URL = 'https://api.twitter.com/oauth2/token',
    ENCODED_TOKEN_CREDENTIAL = 'a3l4WDdaTHMyRDNlZnFEYnBLOE1xbnBucjpEODV0WTg5alFvV1dWSDhvTmpJZzI4UEpmSzRTMmxvdXE1TlB4dzhWenZsS0J3U1IweA==',
    API_RATE_LIMIT_STATUS = 'https://api.twitter.com/1.1/application/rate_limit_status.json',
    API_VIDEO_CONFIG_BASE = 'https://api.twitter.com/1.1/videos/tweet/config/#TWEETID#.json',
    API_TWEET_SHOW_BASE = 'https://api.twitter.com/1.1/statuses/show.json?include_profile_interstitial_type=1&include_blocking=1&include_blocked_by=1&include_followed_by=1&include_want_retweets=1&skip_status=1&cards_platform=Web-12&include_cards=1&include_ext_alt_text=true&include_reply_count=1&tweet_mode=extended&trim_user=false&include_ext_media_color=true&id=#TWEETID#',
    GIF_VIDEO_URL_BASE = 'https://video.twimg.com/tweet_video/#VIDEO_ID#.mp4',
    
    oauth2_access_token = null,
    limit_tweet_number = OPTIONS.DEFAULT_LIMIT_TWEET_NUMBER,
    support_image = false,
    support_gif = false,
    support_video = false,
    include_retweets = false,  // true: ユーザータイムライン上の RT のメディアも対象とする
    dry_run = false; // true: 走査のみ


switch ( LANGUAGE ) {
    case 'ja' :
        OPTIONS.DOWNLOAD_BUTTON_TEXT = '⇩';
        OPTIONS.DOWNLOAD_BUTTON_TEXT_LONG = 'メディア ⇩';
        OPTIONS.DOWNLOAD_BUTTON_HELP_TEXT = 'タイムラインの画像/動画を保存';
        OPTIONS.DIALOG_TWEET_ID_RANGE_HEADER = '対象 Tweet ID 範囲';
        OPTIONS.DIALOG_TWEET_ID_RANGE_MARK = '＜ ID ＜';
        OPTIONS.DIALOG_LIMIT_TWEET_NUMBER_TEXT = '制限数';
        OPTIONS.DIALOG_BUTTON_START_TEXT = '開始';
        OPTIONS.DIALOG_BUTTON_STOP_TEXT = '停止';
        OPTIONS.DIALOG_BUTTON_CLOSE_TEXT = '閉じる';
        OPTIONS.CHECKBOX_IMAGE_TEXT = '画像';
        OPTIONS.CHECKBOX_GIF_TEXT = '動画(GIF)';
        OPTIONS.CHECKBOX_VIDEO_TEXT = '動画';
        OPTIONS.CHECKBOX_INCLUDE_RETWEETS = 'RTを含む';
        OPTIONS.CHECKBOX_DRY_RUN = '走査のみ';
        OPTIONS.CHECKBOX_ALERT = '最低でも一つはチェックを入れて下さい';
        OPTIONS.IMAGE_DOWNLOAD_LINK_TEXT = '画像⇩';
        OPTIONS.VIDEO_DOWNLOAD_LINK_TEXT = 'MP4⇩';
        OPTIONS.DOWNLOAD_MEDIA_TITLE = 'ダウンロード';
        OPTIONS.OPEN_MEDIA_LINK = 'メディアを開く';
        
        OPTIONS.LIKES_DOWNLOAD_BUTTON_TEXT_LONG = 'いいね ⇩';
        OPTIONS.LIKES_DOWNLOAD_BUTTON_HELP_TEXT = '『いいね』をしたツイートの画像/動画を保存';
        OPTIONS.LIKES_DIALOG_TWEET_ID_RANGE_HEADER = '対象『いいね』日時範囲';
        OPTIONS.LIKES_DIALOG_TWEET_ID_RANGE_MARK = '＜ 日時 ＜';
        break;
    default:
        OPTIONS.DOWNLOAD_BUTTON_TEXT = '⇩';
        OPTIONS.DOWNLOAD_BUTTON_TEXT_LONG = 'Media ⇩';
        OPTIONS.DOWNLOAD_BUTTON_HELP_TEXT = 'Download images/videos from timeline';
        OPTIONS.DIALOG_TWEET_ID_RANGE_HEADER = 'Download Tweet ID range';
        OPTIONS.DIALOG_TWEET_ID_RANGE_MARK = '< ID <';
        OPTIONS.DIALOG_LIMIT_TWEET_NUMBER_TEXT = 'Limit';
        OPTIONS.DIALOG_BUTTON_START_TEXT = 'Start';
        OPTIONS.DIALOG_BUTTON_STOP_TEXT = 'Stop';
        OPTIONS.DIALOG_BUTTON_CLOSE_TEXT = 'Close';
        OPTIONS.CHECKBOX_IMAGE_TEXT = 'Images';
        OPTIONS.CHECKBOX_GIF_TEXT = 'Videos(GIF)';
        OPTIONS.CHECKBOX_VIDEO_TEXT = 'Videos';
        OPTIONS.CHECKBOX_INCLUDE_RETWEETS = 'include RTs';
        OPTIONS.CHECKBOX_DRY_RUN = 'Dry run';
        OPTIONS.CHECKBOX_ALERT = 'Please select at least one checkbox !';
        OPTIONS.IMAGE_DOWNLOAD_LINK_TEXT = 'IMG⇩';
        OPTIONS.VIDEO_DOWNLOAD_LINK_TEXT = 'MP4⇩';
        OPTIONS.DOWNLOAD_MEDIA_TITLE = 'Download';
        OPTIONS.OPEN_MEDIA_LINK = 'Open media links';
        
        OPTIONS.LIKES_DOWNLOAD_BUTTON_TEXT_LONG = 'Likes ⇩';
        OPTIONS.LIKES_DOWNLOAD_BUTTON_HELP_TEXT = 'Download images/videos from Likes-timeline';
        OPTIONS.LIKES_DIALOG_TWEET_ID_RANGE_HEADER = 'Download "Likes" date-time range';
        OPTIONS.LIKES_DIALOG_TWEET_ID_RANGE_MARK = '< DATETIME <';
        break;
}


// }


// ■ 関数 {
function to_array( array_like_object ) {
    return Array.prototype.slice.call( array_like_object );
} // end of to_array()


if ( typeof console.log.apply == 'undefined' ) {
    // MS-Edge 拡張機能では console.log.apply 等が undefined
    // → apply できるようにパッチをあてる
    // ※参考：[javascript - console.log.apply not working in IE9 - Stack Overflow](https://stackoverflow.com/questions/5538972/console-log-apply-not-working-in-ie9)
    
    [ 'log', 'info', 'warn', 'error', 'assert', 'dir', 'clear', 'profile', 'profileEnd' ].forEach( function ( method ) {
        console[ method ] = this.bind( console[ method ], console );
    }, Function.prototype.call );
    
    console.log( 'note: console.log.apply is undefined => patched' );
}


function log_debug() {
    if ( ! DEBUG ) {
        return;
    }
    var arg_list = [ '[' + SCRIPT_NAME + ']', '(' + ( new Date().toISOString() ) + ')' ];
    
    console.log.apply( console, arg_list.concat( to_array( arguments ) ) );
} // end of log_debug()


function log_error() {
    var arg_list = [ '[' + SCRIPT_NAME + ']', '(' + ( new Date().toISOString() ) + ')' ];
    
    console.error.apply( console, arg_list.concat( to_array( arguments ) ) );
} // end of log_error()


var object_extender = ( function () {
    // 参考: [newを封印して、JavaScriptでオブジェクト指向する(1): Architect Note](http://blog.tojiru.net/article/199670885.html?seesaa_related=related_article)
    function object_extender( base_object ) {
        var template = object_extender.template,
            mixin_object_list = Array.prototype.slice.call( arguments, 1 ),
            expanded_object;
        
        template.prototype = base_object;
        
        expanded_object = new template();
        
        mixin_object_list.forEach( function ( object ) {
            Object.keys( object ).forEach( function ( name ) {
                expanded_object[ name ] = object[ name ];
            } );
        } );
        
        return expanded_object;
    } // end of object_extender()
    
    
    object_extender.template = function () {};
    
    return object_extender;
} )(); // end of object_extender()


// 参考: [複数のクラス名の存在を確認（判定） | jQuery逆引き | Webサイト制作支援 | ShanaBrian Website](http://shanabrian.com/web/jquery/has-classes.php)
$.fn.hasClasses = function( selector, or_flag ) {
    var self = this,
        class_names,
        counter = 0;
    
    if ( typeof selector === 'string' ) {
        selector = selector.trim();
        class_names = ( selector.match( /^\./ ) ) ? selector.replace( /^\./, '' ).split( '.' ) : selector.split( ' ' );
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


// 参考: [日付フォーマットなど 日付系処理 - Qiita](http://qiita.com/osakanafish/items/c64fe8a34e7221e811d0)
function format_date( date, format, flag_utc ) {
    if ( ! format ) {
        format = 'YYYY-MM-DD hh:mm:ss.SSS';
    }
    
    var msec = ( '00' + ( ( flag_utc ) ? date.getUTCMilliseconds() : date.getMilliseconds() ) ).slice( -3 ),
        msec_index = 0;
    
    if ( flag_utc ) {
        format = format
            .replace( /YYYY/g, date.getUTCFullYear() )
            .replace( /MM/g, ( '0' + ( 1 + date.getUTCMonth() ) ).slice( -2 ) )
            .replace( /DD/g, ( '0' + date.getUTCDate() ).slice( -2 ) )
            .replace( /hh/g, ( '0' + date.getUTCHours() ).slice( -2 ) )
            .replace( /mm/g, ( '0' + date.getUTCMinutes() ).slice( -2 ) )
            .replace( /ss/g, ( '0' + date.getUTCSeconds() ).slice( -2 ) )
            .replace( /S/g, function ( all ) {
                return msec.charAt( msec_index ++ );
            } );
    }
    else {
        format = format
            .replace( /YYYY/g, date.getFullYear() )
            .replace( /MM/g, ( '0' + ( 1 + date.getMonth() ) ).slice( -2 ) )
            .replace( /DD/g, ( '0' + date.getDate() ).slice( -2 ) )
            .replace( /hh/g, ( '0' + date.getHours() ).slice( -2 ) )
            .replace( /mm/g, ( '0' + date.getMinutes() ).slice( -2 ) )
            .replace( /ss/g, ( '0' + date.getSeconds() ).slice( -2 ) )
            .replace( /S/g, function ( all ) {
                return msec.charAt( msec_index ++ );
            } );
    }
    
    return format;
} // end of format_date()


// Twitter のツイートID は 64 ビットで、以下のような構成をとっている
//   [63:63]( 1) 0(固定)
//   [62:22](41) timestamp: 現在の Unix Time(ms) から、1288834974657(ms) (2011/11/04 01:42:54 UTC) を引いたもの
//   [21:12](10) machine id: 生成器に割り当てられたID。datacenter id + worker id
//   [11: 0](12) 生成器ごとに採番するsequence番号
//
// 参考:[Twitterのsnowflakeについて](https://www.slideshare.net/moaikids/20130901-snowflake)
//      [ツイートID生成とツイッターリアルタイム検索システムの話](https://www.slideshare.net/pfi/id-15755280)
function tweet_id_to_date( tweet_id ) {
    var bignum_tweet_id = new Decimal( tweet_id );
    
    if ( bignum_tweet_id.cmp( '300000000000000' ) < 0 ) {
        // ツイートID仕様の切替(2010/11/04 22時 UTC頃)以前のものは未サポート
        return null;
    }
    return new Date( parseInt( bignum_tweet_id.div( Decimal.pow( 2, 22 ) ).floor().add( 1288834974657 ), 10 ) );
} // end of tweet_id_to_date()


function datetime_to_tweet_id( datetime ) {
    try {
        var date = new Date( datetime ),
            utc_ms = date.getTime();
        
        if ( isNaN( utc_ms ) ) {
            return null;
        }
        
        var tweet_timestamp = Decimal.sub( utc_ms, 1288834974657 );
        
        if ( tweet_timestamp.cmp( 0 ) < 0 ) {
            return null;
        }
        
        var bignum_tweet_id = tweet_timestamp.mul( Decimal.pow( 2, 22 ) );
        
        if ( bignum_tweet_id.cmp( '300000000000000' ) < 0 ) {
            // ツイートID仕様の切替(2010/11/04 22時 UTC頃)以前のものは未サポート
            return null;
        }
        return bignum_tweet_id.toString();
    }
    catch ( error ) {
        return null;
    }
} // end of datetime_to_tweet_id()


function like_id_to_date( like_id ) {
    var bignum_like_id = new Decimal( like_id );
    return new Date( parseInt( bignum_like_id.div( Decimal.pow( 2, 20 ) ).floor(), 10 ) );
} // end of like_id_to_date()


function datetime_to_like_id( datetime ) {
    try {
        var date = new Date( datetime ),
            utc_ms = date.getTime();
        
        if ( isNaN( utc_ms ) ) {
            return null;
        }
        
        var bignum_like_id = Decimal.mul( utc_ms, Decimal.pow( 2, 20 ) );
        
        return bignum_like_id.toString();
    }
    catch ( error ) {
        return null;
    }
} // end of datetime_to_like_id()


function bignum_cmp( tweet_id1, tweet_id2 ) {
    return new Decimal( tweet_id1 ).cmp( tweet_id2 );
} // end of bignum_cmp()


var get_jq_html_fragment = ( function () {
    if ( ( ! d.implementation ) || ( typeof d.implementation.createHTMLDocument != 'function' ) ) {
        return function ( html ) {
            return $( '<div/>' ).html( html );
        };
    }
    
    // 解析段階での余分なネットワークアクセス（画像等の読み込み）抑制
    var html_document = d.implementation.createHTMLDocument(''),
        range = html_document.createRange();
    
    return function ( html ) {
        return $( range.createContextualFragment( html ) );
    };
} )(); // end of get_jq_html_fragment()


function get_url_info( url ) {
    var url_parts = url.split( '?' ),
        query_map = {},
        url_info = { base_url : url_parts[ 0 ], query_map : query_map };
    
    if ( url_parts.length < 2 ) {
        return url_info;
    }
    
    url_parts[ 1 ].split( '&' ).forEach( function ( query_part ) {
        var parts = query_part.split( '=' );
        
        query_map[ parts[ 0 ] ] = ( parts.length < 2 ) ? '' : parts[ 1 ];
    } );
    
    return url_info;
} // end of get_url_info()


function normalize_img_url( source_url ) {
    var url_info = get_url_info( source_url ),
        base_url = url_info.base_url,
        format = url_info.query_map.format,
        name = url_info.query_map.name;
    
    if ( ! format ) {
        return source_url;
    }
    
    return base_url + '.' + format + ( ( name ) ? ':' + name : '' );
} // end of normalize_img_url()


function get_img_url( img_url, kind ) {
    img_url = normalize_img_url( img_url );
    
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
    img_url = normalize_img_url( img_url );
    
    var extension = '';
    
    extension_list = ( extension_list ) ? extension_list : [ 'png', 'jpg', 'gif' ];
    
    if ( img_url.match( new RegExp( '\.(' + extension_list.join('|') + ')' ) ) ) {
        extension = RegExp.$1;
    }
    return extension;
} // end of get_img_extension()


function is_video_url( url ) {
    return /\.mp4(?:$|\?)/.test( url );
} // end of is_video_url()


function get_video_extension( video_url ) {
    if ( ! is_video_url( video_url ) ) {
        return 'mp4';
    }
    return video_url.match( /\.([^.?]*)(?:$|\?)/ )[ 1 ];
} // end of get_video_extension()


function get_gif_video_url_from_playable_media( jq_target ) {
    // 動画GIFの背景画像 URL から MP4 の URL を割り出す
    // background-image:url('https://pbs.twimg.com/tweet_video_thumb/#VIDEO_ID#.jpg') => https://video.twimg.com/tweet_video/#VIDEO_ID#.mp4
    return GIF_VIDEO_URL_BASE.replace( '#VIDEO_ID#', jq_target.find( '.PlayableMedia-player' ).attr( 'style' ).match( /tweet_video_thumb\/([^.]+)\./ )[ 1 ] );
} // end of get_gif_video_url_from_playable_media()


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
    
    if ( screen_name.length < 2 ) {
        // ログイン時に『いいね』タイムラインは https://twitter.com/i/likes になってしまう
        screen_name = $( 'h2.ProfileHeaderCard-screenname span.username b.u-linkComplex-target' ).text().trim();
    }
    
    return screen_name;
} // end of get_screen_name()


function get_profile_name() {
    return $( 'h1.ProfileHeaderCard-name a.ProfileHeaderCard-nameLink' ).text().trim();
} // end of get_profile_name()


function get_tweet_id( url ) {
    if ( ! url ) {
        url = w.location.href;
    }
    
    url = url.trim();
    if ( /^\d+$/.test( url ) ) {
        return url;
    }

    if ( ! url.trim().match( /^https?:\/\/twitter\.com\/[^\/]+\/[^\/]+\/(\d+)(?:$|\/)/ ) ) {
        return null;
    }
    
    return RegExp.$1;
} // end of get_tweet_id()


function judge_search_timeline( url ) {
    if ( ! url ) {
        url = w.location.href;
    }
    return /\/search/.test( url );
} // end of judge_search_timeline()


function datetime_to_timestamp( datetime ) {
    return datetime.replace( /[\/:]/g, '' ).replace( / /g, '_' );
} // end of datetime_to_timestamp()


// TODO: zip.file() で date オプションを指定した際、ZIP のタイムスタンプがずれてしまう
// → 標準では UTC で保存される模様（https://stuk.github.io/jszip/CHANGES.html#v300-2016-04-13）
// → タイムゾーンに合わせて調整することで対処
function adjust_date_for_zip( date ) {
    // TODO: なぜかタイムスタンプに1秒前後の誤差が出てしまう
    // → ZIP の仕様上、タイムスタンプは2秒単位で丸められてしまう（拡張フィールドを使用しない場合）
    // 参考：[ZIP (ファイルフォーマット) - Wikipedia](https://ja.wikipedia.org/wiki/ZIP_(%E3%83%95%E3%82%A1%E3%82%A4%E3%83%AB%E3%83%95%E3%82%A9%E3%83%BC%E3%83%9E%E3%83%83%E3%83%88))
    return new Date( date.getTime() - date.getTimezoneOffset() * 60000 );
} // end of adjust_date_for_zip()


function download_url( filename, url ) {
    var download_button = d.createElement( 'a' );
    
    download_button.href = url;
    download_button.download = filename;
    
    document.documentElement.appendChild( download_button );
    
    download_button.click();
    
    download_button.parentNode.removeChild( download_button );
} // end of download_url()


function download_blob( filename, blob ) {
    var blob_url = URL.createObjectURL( blob );
    
    download_url( filename, blob_url );
} // end of download_blob()


function download_base64( filename, base64, mimetype ) {
    if ( ! mimetype ) {
        mimetype = 'application/octet-stream';
    }
    
    var data_url = 'data:' + mimetype + ';base64,' + base64;
    
    download_url( filename, data_url );
} // end of download_base64()


function string_to_arraybuffer( source_string ) {
    var charcode_list = [].map.call( source_string, function ( ch ) {
            return ch.charCodeAt( 0 );
        } ),
        arraybuffer = ( new Uint16Array( charcode_list ) ).buffer;
    
    return arraybuffer;
} // end of string_to_arraybuffer()


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
                if ( typeof options.oncomplete == 'function' ) {
                    options.oncomplete( xhr );
                }
            };
            xhr.onerror = function () {
                if ( typeof options.onerror == 'function' ) {
                    options.onerror( xhr );
                }
                if ( typeof options.oncomplete == 'function' ) {
                    options.oncomplete( xhr );
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
                if ( typeof options.oncomplete == 'function' ) {
                    options.oncomplete( response );
                }
            }
        ,   onerror : function ( response ) {
                if ( typeof options.onerror == 'function' ) {
                    options.onerror( response );
                }
                if ( typeof options.oncomplete == 'function' ) {
                    options.oncomplete( response );
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
            var value = GM_getValue( name );
            
            // メモ： 値が存在しない場合、GM_getValue( name ) は undefined を返す
            return ( value === undefined ) ? null : value;
        };
    }
    return function ( name ) {
        // メモ： 値が存在しない場合、localStorage[ name ] は undefined を、localStorage.getItem( name ) は null を返す
        return localStorage.getItem( name );
    };
} )(); // end of get_value()


function is_night_mode() {
    return $( '#user-dropdown .js-nightmode-icon' ).hasClass( 'Icon--crescentFilled' );
} // end of is_night_mode()


var Csv = {
    init : function () {
        var self = this;
        
        self.csv_rows = [];
        self.csv_content = null;
        
        return self;
    }, // end of init()
    
    
    push_row : function ( column_item_list ) {
        var self = this,
            csv_columns = [];
        
        column_item_list.forEach( function ( column_item ) {
            column_item = ( '' + column_item ).trim();
            csv_columns.push( '"' + column_item.replace( /"/g, '""' ) + '"' );
        } );
        
        self.csv_rows.push( csv_columns.join( ',' ) );
        
        return self;
    }, // end of push_row()
    
    
    create_csv_content : function () {
        var self = this,
            //csv = self.csv_rows.join( '\r\n' ),
            //bom = new Uint8Array( [ 0xEF, 0xBB, 0xBF ] ),
            //csv_content = self.csv_content = new Blob( [ bom, csv ], { 'type' : 'text/csv' } );
            csv_content = self.csv_content = '\ufeff' + self.csv_rows.join( '\r\n' );
        
        return self;
    }, // end of create_csv_content()
    
    
    get_csv_content : function () {
        var self = this;
        
        return self.csv_content;
    } // end of get_csv_content()
}; // end of Csv


var download_media_timeline = ( function () {
    var TemplateMediaTimeline = {
        DEFAULT_UNTIL_ID : '9223372036854775807' // 0x7fffffffffffffff = 2^63-1
        // [2017/10/25] 最新の画像がダウンロードできなくなったので修正
        //   922337203685477580を超えたからだと思われる→比較する際に上位から18桁分しか評価されていない？
        //   ただし、9223372036854775808(=2^63)を指定すると一つもダウンロードできなくなるので、範囲チェックはされている模様
        //   →これでは（DEFAULT_UNTIL_ID : '999999999999999999' だと）、2018/05/25 22:05:53 までしか動作しないことになる……
        // 
        // [2017/10/31] そもそもの比較方法が誤っていたので、これを修正
        //   '922337203685477580' < '9223372036854775807' // => true
        //   '922337203685477581' < '9223372036854775807' // => false になってしまう
        //     ↓
        //   bignum_cmp( '922337203685477581', '9223372036854775807' ) < 0 // => true
        
        ,   timeline_status : null // 'media' / 'search' / 'end' / 'error' / 'stop'
        
        ,   api_limit_retry_number : 10 // API 最大リトライ回数(要調整)
        
        ,   init : function ( screen_name, until_id, since_id, filter_info ) {
                var self = this,
                    is_search_timeline = self.is_search_timeline = judge_search_timeline();
                
                self.api_retry_remaining_number = self.api_limit_retry_number;
                self.api_max_retry_number = 0;
                
                self.filter_info = filter_info;
                self.timeline_status = ( is_search_timeline ) ? 'search' : 'media';
                //self.timeline_status = 'search'; // ※テスト用
                self.screen_name = screen_name;
                
                if ( is_search_timeline ) {
                    var search_query = $( '#search-query' ).val();
                    
                    if ( OPTIONS.ENABLE_FILTER ) {
                        // 本スクリプトと競合するフィルタの類は削除しておく
                        search_query = search_query.replace( /-?filter:(?:media|periscope)(?:\s+OR\s+)?/g, ' ' );
                        
                        if ( ! filter_info.image ) {
                            search_query = search_query.replace( /-?filter:(?:images)(?:\s+OR\s+)?/g, ' ' );
                        }
                        if ( ! filter_info.gif ) {
                            search_query = search_query.replace( /-?card_name:animated_gif(?:\s+OR\s+)?/g, ' ' );
                        }
                        if ( ! filter_info.video ) {
                            search_query = search_query.replace( /-?filter:(?:videos|native_video|vine)(?:\s+OR\s+)?/g, ' ' );
                        }
                    }
                    self.search_query = search_query.replace( /\s+/g, ' ' ).trim();
                }
                else {
                    self.search_query = null;
                }
                
                if ( is_search_timeline && ( ! self.search_query ) ) {
                    self.search_query = 'twitter'; // ダミー
                }
                self.since_id = ( since_id ) ? since_id : null;
                self.fetched_min_id = self.until_id = ( until_id ) ? until_id : ( ( filter_info.is_for_likes_timeline ) ? datetime_to_like_id( format_date( new Date() ) ) : self.DEFAULT_UNTIL_ID );
                self.tweet_info_list = [];
                
                if ( filter_info.is_for_likes_timeline ) {
                    self.media_timeline_parameters = {
                        max_position : self.until_id
                        
                    ,   api_endpoint : {
                            url : 'https://twitter.com/' + ( ( self.screen_name ) ? self.screen_name : 'twitter' ) + '/likes/timeline'
                        ,   data : {
                                include_available_features : 1
                            ,   include_entities : 1
                            ,   reset_error_state : false
                            //,   last_note_ts : null
                            ,   max_position : null
                            ,   count : 1 // いいねタイムライン取得時は 1 件ずつにし、返された JSON の min_position（次回の max_position）より、いいね時刻情報を取得
                            }
                        }
                    };
                }
                else {
                    self.media_timeline_parameters = {
                        max_position : self.until_id
                        
                    ,   api_endpoint : {
                            url : 'https://twitter.com/i/profiles/show/' + ( ( self.screen_name ) ? self.screen_name : 'twitter' ) + ( ( filter_info.include_retweets ) ? '/timeline/with_replies' : '/media_timeline' )
                        ,   data : {
                                include_available_features : 1
                            ,   include_entities : 1
                            ,   reset_error_state : false
                            //,   last_note_ts : null
                            ,   max_position : null
                            }
                        }
                    };
                }
                
                self.search_timeline_parameters = {
                    api_max_position : null
                    // ※ API で指定する max_position は数値ではなく、"TWEET-(from tweet id)-(to tweet id)-(長い文字列)==-T-0" のような文字列であることに注意
                    //    最初はわからないため、HTML より data-min-position を読み取って使用する
                
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
                        //,   last_note_ts : null
                        ,   max_position : null
                        }
                    }
                };
                
                return self;
            } // end of init()
        
        ,   fetch_tweet_info : function ( callback ) {
                var self = this,
                    filter_info = self.filter_info,
                    media_timeline_parameters = self.media_timeline_parameters,
                    search_timeline_parameters = self.search_timeline_parameters,
                    tweet_info = self.tweet_info_list.shift(),
                    check_id;
                
                if ( tweet_info ) {
                    if ( self.timeline_status == 'stop' ) {
                        callback( {
                            tweet_info : null
                        ,   timeline_status : self.timeline_status
                        ,   media_timeline_parameters : media_timeline_parameters
                        ,   search_timeline_parameters : search_timeline_parameters
                        } );
                        return self;
                    }
                    
                    if ( filter_info.is_for_likes_timeline ) {
                        // いいね(Likes)タイムラインには、いいねした時刻に関する情報が含まれていない
                        // → いいねタイムライン取得時は count=1 を取得して 1 件ずつにし、返された JSON の min_position（次回の max_position）より、いいね時刻情報を取得
                        check_id = media_timeline_parameters.max_position;
                    }
                    else {
                        check_id = ( tweet_info.retweet_id || tweet_info.tweet_id );
                    }
                    
                    if ( ( self.since_id ) && ( bignum_cmp( check_id, self.since_id ) <= 0 ) ) {
                        self.timeline_status = 'end';
                        
                        callback( {
                            tweet_info : null
                        ,   timeline_status : self.timeline_status
                        ,   media_timeline_parameters : media_timeline_parameters
                        ,   search_timeline_parameters : search_timeline_parameters
                        } );
                        return self;
                    }
                    
                    if ( ! filter_info.is_for_likes_timeline ) {
                        if ( bignum_cmp( self.fetched_min_id, check_id ) <= 0 ) {
                            return self.fetch_tweet_info( callback );
                        }
                        self.fetched_min_id = check_id;
                    }
                    
                    callback( {
                        tweet_info : tweet_info
                    ,   timeline_status : self.timeline_status
                    ,   media_timeline_parameters : media_timeline_parameters
                    ,   search_timeline_parameters : search_timeline_parameters
                    } );
                    
                    return self;
                }
                
                switch ( self.timeline_status ) {
                    case 'media' :
                        self.__get_next_media_timeline( function () {
                            return self.fetch_tweet_info( callback );
                        } );
                        break;
                    
                    case 'search' :
                        self.__get_next_search_timeline( function () {
                            return self.fetch_tweet_info( callback );
                        } );
                        break;
                    
                    default : // 'stop' / 'error' etc.
                        callback( {
                            tweet_info : tweet_info
                        ,   timeline_status : self.timeline_status
                        ,   media_timeline_parameters : media_timeline_parameters
                        ,   search_timeline_parameters : search_timeline_parameters
                        } );
                        break;
                }
                return self;
            } // end of fetch_tweet_info()
        
        ,   stop : function () {
                var self = this;
                
                self.timeline_status = 'stop';
            } // end of stop()
        
        ,   __get_next_media_timeline : function ( callback ) {
                var self = this,
                    filter_info = self.filter_info,
                    media_timeline_parameters = self.media_timeline_parameters,
                    api_endpoint = media_timeline_parameters.api_endpoint,
                    data = api_endpoint.data,
                    is_delayed_callback = false;
                
                //data.last_note_ts = self.__get_last_note_ts();
                data.max_position = media_timeline_parameters.max_position;
                
                $.getJSON( api_endpoint.url, data )
                .done( function ( json ) {
                    var tweet_info_list = self.tweet_info_list,
                        tweet_count = 0,
                        min_tweet_id = self.DEFAULT_UNTIL_ID,
                        json_inner = ( json.inner ) ? json.inner : ( ( json.items_html && json.min_position ) ? json : null );
                        // items_html/min_position が json.inner ではなく、json 直下にある場合もある（未ログイン時など）
                    
                    if ( ( ! json_inner ) ||  ( ! json_inner.items_html ) || ( ! json_inner.min_position ) ) {
                        log_error( 'items not found' );
                        self.timeline_status = 'end';
                        return;
                    }
                    
                    var jq_html_fragment = get_jq_html_fragment( json_inner.items_html );
                    
                    jq_html_fragment.find( '.js-stream-item' ).each( function () {
                        var tweet_info = self.__get_tweet_info( $( this ) );
                        
                        if ( ( ! tweet_info ) || ( ! tweet_info.tweet_id  ) || ( ! tweet_info.media_type ) ) {
                            return;
                        }
                        tweet_info_list.push( tweet_info );
                        
                        if ( bignum_cmp( tweet_info.tweet_id, min_tweet_id ) < 0 ) {
                            min_tweet_id = tweet_info.tweet_id;
                        }
                        tweet_count ++;
                    } );
                    
                    if ( json_inner.min_position ) {
                        media_timeline_parameters.max_position = json_inner.min_position;
                    }
                    else {
                        if ( ! filter_info.is_for_likes_timeline ) {
                            if ( bignum_cmp( min_tweet_id, media_timeline_parameters.max_position ) < 0 ) {
                                media_timeline_parameters.max_position = min_tweet_id;
                            }
                            else {
                                self.timeline_status = 'search';
                            }
                        }
                    }
                    
                    if ( ( ! json_inner.has_more_items ) || ( json_inner.new_latent_count <= 0 ) ) {
                        if (
                            ( filter_info.is_for_likes_timeline ) && // 『いいね』タイムラインのみの措置（TODO: 他のタイムラインでも必要か？）
                            ( 0 < self.api_retry_remaining_number )
                        ) {
                            // ツイートが残っているにもかかわらず、new_latent_count : 0, has_more_items : false で返る場合有り
                            // →リトライで取得できることがある（何回リトライしてもだめで、後ほどやり直すと大丈夫なケースもある）
                            self.api_retry_remaining_number --;
                            if ( self.api_max_retry_number < ( self.api_limit_retry_number - self.api_retry_remaining_number ) ) {
                                self.api_max_retry_number = self.api_limit_retry_number - self.api_retry_remaining_number;
                            }
                            
                            log_debug( 'retry request in __get_next_media_timeline(): api_retry_remaining_number=', self.api_retry_remaining_number, 'api_max_retry_number=', self.api_max_retry_number );
                            
                            //is_delayed_callback = true;
                        }
                        else {
                            self.api_retry_remaining_number = self.api_limit_retry_number;
                            
                            if ( filter_info.is_for_likes_timeline ) {
                                self.timeline_status = 'end';
                            }
                            else {
                                self.timeline_status = 'search';
                            }
                        }
                    }
                    else {
                        self.api_retry_remaining_number = self.api_limit_retry_number;
                    }
                    
                    if ( is_delayed_callback ) {
                        // リトライをかけるのを遅らせる
                        setTimeout( function () {
                            callback();
                        }, 100 );
                    }
                } )
                .fail( function ( jqXHR, textStatus, errorThrown ) {
                    log_error( api_endpoint.url, textStatus, jqXHR.status + ' ' + jqXHR.statusText );
                    self.timeline_status = 'error';
                } )
                .always( function () {
                    if ( ! is_delayed_callback ) {
                        callback();
                    }
                } );
            } // end of __get_next_media_timeline()
        
        ,   __get_next_search_timeline : function ( callback ) {
                var self = this,
                    search_timeline_parameters = self.search_timeline_parameters,
                    api_endpoint = search_timeline_parameters.api_endpoint,
                    api_data = api_endpoint.data,
                    filters = [],
                    is_delayed_callback = false;
                
                if ( ! search_timeline_parameters.api_max_position ) {
                    // 初めに HTML から data-min-position を取得する必要あり
                    return self.__get_first_search_timeline( callback );
                }
                
                //api_data.last_note_ts = self.__get_last_note_ts();
                api_data.max_position = search_timeline_parameters.api_max_position;
                
                $.getJSON( api_endpoint.url, api_data )
                .done( function ( json ) {
                    var tweet_info_list = self.tweet_info_list,
                        tweet_count = 0,
                        json_inner = ( json.inner ) ? json.inner : ( ( json.items_html && json.min_position ) ? json : null );
                        // items_html/min_position が json.inner ではなく、json 直下にある場合もある（未ログイン時など）
                    
                    if ( ( ! json_inner ) ||  ( ! json_inner.items_html ) || ( ! json_inner.min_position ) ) {
                        log_error( 'items not found' );
                        self.timeline_status = 'end';
                        return;
                    }
                    
                    var jq_html_fragment = get_jq_html_fragment( json_inner.items_html );
                    
                    jq_html_fragment.find( '.js-stream-item' ).each( function () {
                        var tweet_info = self.__get_tweet_info( $( this ) );
                        
                        if ( ( ! tweet_info ) || ( ! tweet_info.tweet_id  ) || ( ! tweet_info.media_type ) ) {
                            return;
                        }
                        tweet_info_list.push( tweet_info );
                        tweet_count ++;
                    } );
                    
                    if ( json_inner.min_position ) {
                        if ( json_inner.min_position != search_timeline_parameters.api_max_position ) {
                            search_timeline_parameters.api_max_position = json_inner.min_position;
                            self.api_retry_remaining_number = self.api_limit_retry_number;
                        }
                        else {
                            // min_position に変化がなければ終了とみなす → 念のため、一定回数リトライ
                            if (  0 < self.api_retry_remaining_number ) {
                                self.api_retry_remaining_number --;
                                log_debug( 'retry request in ___get_next_search_timeline(): api_retry_remaining_number=', self.api_retry_remaining_number );
                                
                                //is_delayed_callback = true;
                            }
                            else {
                                self.api_retry_remaining_number = self.api_limit_retry_number;
                                self.timeline_status = 'end';
                            }
                        }
                    }
                    else {
                        self.timeline_status = 'end';
                    }
                    // 終了判定としては使えなかった（has_more_items が false でも、実際に検索したらまだツイートがある場合がある模様）
                    //{
                    //if ( ! json_inner.has_more_items ) {
                    //    self.timeline_status = 'end';
                    //}
                    //}
                    
                    if ( is_delayed_callback ) {
                        // リトライをかけるのを遅らせる
                        setTimeout( function () {
                            callback();
                        }, 100 );
                    }
                } )
                .fail( function ( jqXHR, textStatus, errorThrown ) {
                    log_error( api_endpoint.url, textStatus, jqXHR.status + ' ' + jqXHR.statusText );
                    self.timeline_status = 'error';
                } )
                .always( function () {
                    if ( ! is_delayed_callback ) {
                        callback();
                    }
                } );
                
                return self;
            } // end of ___get_next_search_timeline()
        
        ,   __get_first_search_timeline : function ( callback ) {
                var self = this,
                    html_endpoint = self.search_timeline_parameters.html_endpoint,
                    html_data = html_endpoint.data,
                    api_endpoint = self.search_timeline_parameters.api_endpoint,
                    api_data = api_endpoint.data,
                    filter_info = self.filter_info,
                    filters = [];
                
                if ( self.is_search_timeline ) {
                    html_data.q = self.search_query;
                }
                else {
                    html_data.q = 'from:' + self.screen_name;
                    
                    html_data.q += ' max_id:' + Decimal.sub( self.media_timeline_parameters.max_position, 1 ).toString();
                    
                    if ( self.since_id ) {
                        html_data.q += ' since_id:' + self.since_id;
                    }
                    
                    if ( filter_info.include_retweets ) {
                        html_data.q += ' include:nativeretweets';
                    }
                    else {
                        html_data.q += ' exclude:retweets';
                    }
                }
                
                if ( OPTIONS.ENABLE_FILTER ) {
                    if ( filter_info.image ) {
                        filters.push( 'filter:images' );
                    }
                    if ( filter_info.gif ) {
                        filters.push( 'card_name:animated_gif' );
                    }
                    if ( filter_info.video ) {
                        //filters.push( 'filter:videos' ); // TODO: 外部サイトの動画(YouTube等)は未サポート← 'filter:videos' だとそれらも含む
                        filters.push( 'filter:native_video' );
                        filters.push( 'filter:vine' );
                    }
                    
                    html_data.q += ' ' + filters.join( ' OR ' );
                    html_data.q += ' -filter:periscope'; // TODO: Periscope は未サポート
                }
                
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
                
                api_data.q = html_data.q; // クエリは最初に設定したもので共通
                
                $.ajax( {
                    type : 'GET'
                ,   url : html_endpoint.url
                ,   data : html_data
                ,   dataType : 'html'
                } )
                .done( function ( html ) {
                    var jq_html_fragment =  get_jq_html_fragment( html ),
                        tweet_info_list = self.tweet_info_list,
                        api_max_position = self.search_timeline_parameters.api_max_position = jq_html_fragment.find( '*[data-min-position]' ).attr( 'data-min-position' );
                        // ※ data-min-position は数値ではなく、"TWEET-(from tweet id)-(to tweet id)-(長い文字列)==-T-0" みたいになっていることに注意
                    
                    log_debug( '__get_first_search_timeline() : data-min-position = ', api_max_position );
                    
                    if ( ! api_max_position ) {
                        if ( jq_html_fragment.find( 'div.SearchEmptyTimeline' ).length <= 0 ) {
                            log_error( '"data-min-position" not found' );
                            self.timeline_status = 'error';
                            return;
                        }
                        
                        self.timeline_status = 'end';
                        return;
                    }
                    
                    jq_html_fragment.find( '.js-stream-item' ).each( function () {
                        var jq_stream_item = $( this ),
                            tweet_info = self.__get_tweet_info( jq_stream_item );
                        
                        if ( ( ! tweet_info ) || ( ! tweet_info.tweet_id  ) || ( ! tweet_info.media_type ) ) {
                            return;
                        }
                        tweet_info.jq_stream_item = jq_stream_item;
                        tweet_info.timeline_kind = 'search-timeline';
                        
                        tweet_info_list.push( tweet_info );
                    } );
                } )
                .fail( function ( jqXHR, textStatus, errorThrown ) {
                    log_error( html_endpoint.url, textStatus, jqXHR.status + ' ' + jqXHR.statusText );
                    self.timeline_status = 'error';
                } )
                .always( function () {
                    callback();
                } );
                
                return self;
            } // end of __get_first_search_timeline()
        
        ,   __get_last_note_ts : function () {
                var last_note_ts = null;
                try {
                    last_note_ts = localStorage.getItem( '__DM__:latestNotificationTimestamp' );
                }
                catch ( error ) {
                }
                last_note_ts = ( last_note_ts ) ? last_note_ts : new Date().getTime();
                
                return last_note_ts;
            } // end of __get_last_note_ts()
        
        ,   __get_tweet_info : function ( jq_tweet_container ) {
                var tweet_info = { media_type : null },
                    tweet_url,
                    date,
                    timestamp_ms,
                    image_urls = [],
                    jq_tweet = jq_tweet_container.find( '.js-stream-tweet' );
                
                if ( jq_tweet.length <= 0 ) {
                    return null;
                }
                
                tweet_url = jq_tweet_container.find( '.js-permalink' ).attr( 'href' );
                if ( ! tweet_url ) {
                    // '.js-stream-item' のうち、Tweet でないため、Permalink が取得できないものもある（「タグ付けされたユーザー」等）
                    return null;
                }
                if ( tweet_url.charAt( 0 ) == '/' ) {
                    tweet_url = 'https://twitter.com' + tweet_url;
                }
                
                try {
                    tweet_info.tweet_url = tweet_url;
                    tweet_info.tweet_id = jq_tweet.attr( 'data-tweet-id' );
                    tweet_info.tweet_screen_name = jq_tweet.attr( 'data-screen-name' );
                    tweet_info.tweet_profile_name = jq_tweet.attr( 'data-name' );
                    tweet_info.retweet_id = jq_tweet.attr( 'data-retweet-id' );
                    tweet_info.retweeter = jq_tweet.attr( 'data-retweeter' );
                    tweet_info.timestamp_ms = timestamp_ms = jq_tweet.find( '*[data-time-ms]' ).attr( 'data-time-ms' );
                    tweet_info.date = date = new Date( parseInt( timestamp_ms, 10 ) );
                    tweet_info.datetime = ( timestamp_ms ) ? format_date( date, 'YYYY/MM/DD hh:mm:ss' ) : '';
                    tweet_info.zipdate = adjust_date_for_zip( date );
                    tweet_info.tweet_text = jq_tweet.find( '.js-tweet-text, .tweet-text' ).text();
                }
                catch ( error ) {
                    // '.js-stream-item' のうち、Tweet でないため、screen_name 等が取得できないものもある（「タグ付けされたユーザー」等）
                    return null;
                }
                
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
                        var jq_playable_media = $( this );
                        
                        if ( jq_playable_media.hasClass( 'PlayableMedia--gif' ) ) {
                            if ( ! support_gif ) {
                                return;
                            }
                            
                            if ( OPTIONS.QUICK_LOAD_GIF ) {
                                try {
                                    image_urls.push( get_gif_video_url_from_playable_media( jq_playable_media ) );
                                    tweet_info.media_quick = true;
                                }
                                catch ( error ) {
                                    image_urls.push( API_VIDEO_CONFIG_BASE.replace( '#TWEETID#', tweet_info.tweet_id ) );
                                }
                            }
                            else {
                                image_urls.push( API_VIDEO_CONFIG_BASE.replace( '#TWEETID#', tweet_info.tweet_id ) );
                            }
                            tweet_info.media_type = 'gif';
                        }
                        else {
                            if ( ! support_video ) {
                                return;
                            }
                            if ( jq_playable_media.hasClass( 'PlayableMedia--vine' ) ) {
                                image_urls.push( API_VIDEO_CONFIG_BASE.replace( '#TWEETID#', tweet_info.tweet_id ) );
                                tweet_info.media_source = 'vine';
                            }
                            else {
                                image_urls.push( API_TWEET_SHOW_BASE.replace( '#TWEETID#', tweet_info.tweet_id ) );
                            }
                            tweet_info.media_type = 'video';
                        }
                        return false; // video は現状では 1 つのみサポート
                    } );
                }
                tweet_info.image_urls = image_urls;
                tweet_info.media_infos = image_urls.map( function ( value ) {
                        return {};
                    } );
                
                return tweet_info;
            } // end of __get_tweet_info()
        
        }, // end of TemplateMediaTimeline
        
        
        TemplateMediaDownload = {
            downloading : false
        ,   stopping : false
        ,   closing : false
        
        ,   is_for_likes_timeline : false
        
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
                
                self.media_url_cache = {};
                
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
                    jq_since_date,
                    jq_until_date,
                    jq_button_container,
                    jq_button_start,
                    jq_button_stop,
                    jq_button_close,
                    jq_status_container,
                    jq_checkbox_container,
                    jq_checkbox_image,
                    jq_checkbox_gif,
                    jq_checkbox_video,
                    jq_checkbox_include_retweets,
                    jq_checkbox_dry_run,
                    jq_log,
                    jq_log_mask;
                
                $( '#' + container_id ).remove();
                
                self.jq_checkbox_image = jq_checkbox_image = $( '<label><input type="checkbox" name="image">' + OPTIONS.CHECKBOX_IMAGE_TEXT + '</label>' )
                    .addClass( SCRIPT_NAME + '_checkbox_image' );
                
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
                
                self.jq_checkbox_include_retweets = jq_checkbox_include_retweets = $( '<label><input type="checkbox" name="include_retweets">' + OPTIONS.CHECKBOX_INCLUDE_RETWEETS + '</label>' )
                    .addClass( SCRIPT_NAME + '_checkbox_include_retweets' );
                jq_checkbox_include_retweets
                    .find( 'input' )
                    .prop( 'checked', include_retweets )
                    .change( function ( event ) {
                        var jq_input = $( this );
                        
                        event.stopPropagation();
                        event.preventDefault();
                        
                        include_retweets = jq_input.is( ':checked' );
                        set_value( SCRIPT_NAME + '_include_retweets', ( include_retweets ) ? '1' : '0' );
                    } );
                
                self.jq_checkbox_dry_run = jq_checkbox_dry_run = $( '<label><input type="checkbox" name="dry_run">' + OPTIONS.CHECKBOX_DRY_RUN + '</label>' )
                    .addClass( SCRIPT_NAME + '_checkbox_dry_run' );
                jq_checkbox_dry_run
                    .find( 'input' )
                    .prop( 'checked', dry_run )
                    .css( {
                        'margin-left' : '8px',
                        'margin-bottom' : '8px'
                    } )
                    .change( function ( event ) {
                        var jq_input = $( this );
                        
                        event.stopPropagation();
                        event.preventDefault();
                        
                        dry_run = jq_input.is( ':checked' );
                        set_value( SCRIPT_NAME + '_dry_run', ( dry_run ) ? '1' : '0' );
                    } );
                
                self.jq_button_start = jq_button_start = $( '<button />' )
                    .text( OPTIONS.DIALOG_BUTTON_START_TEXT )
                    .addClass( SCRIPT_NAME + '_button_start' )
                    .click( function ( event ) {
                        event.stopPropagation();
                        event.preventDefault();
                        
                        jq_button_start.blur();
                        
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
                        
                        jq_button_stop.blur();
                        
                        self.on_stop( event );
                    } );
                
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
                    //,   'background' : 'rgba( 0, 0, 0, 0.8 )'
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
                    //,   'background' : 'white'
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
                        'position' : 'relative'
                    ,   'overflow' : 'hidden'
                    //,   'background' : 'lightblue'
                    ,   'height' : '30%'
                    } );
                
                jq_range_container = self.jq_range_container = $( [
                        '<div class="range_container">'
                    ,   '  <h3><span class="range_header_text"></span></h3>'
                    ,   '  <table><tbody>'
                    ,   '    <tr>'
                    ,   '      <td><input type="text" name="since_id" value="" class="tweet_id" /></td>'
                    ,   '      <td><span class="range_text"></span></td>'
                    ,   '      <td><input type="text" name="until_id" class="tweet_id" /></td>'
                    ,   '      <td><label class="limit"></label><input type="text" name="limit" class="tweet_number" /></td>'
                    ,   '    </tr>'
                    ,   '    <tr class="date-range">'
                    ,   '      <td class="date since-date"></td>'
                    ,   '      <td></td>'
                    ,   '      <td class="date until-date"></td>'
                    ,   '      <td></td>'
                    ,   '    </tr>'
                    ,   '  </tbody></table>'
                    ,   '</div>'
                    ].join( '\n' ) )
                    .attr( {
                    } )
                    .css( {
                    } );
                
                jq_range_header = jq_range_container.find( 'h3' )
                    .append( jq_button_close )
                    .attr( {
                    } )
                    .css( {
                        'margin' : '12px 16px 6px 16px'
                    //,   'color' : '#66757f'
                    } );
                
                jq_range_header.find( 'span.range_header_text' )
                    .text( OPTIONS.DIALOG_TWEET_ID_RANGE_HEADER );
                
                jq_range_container.find( 'table' )
                    .attr( {
                    } )
                    .css( {
                        'width' : '560px'
                    ,   'margin' : '0 auto 0 auto'
                    ,   'text-align' : 'center'
                    //,   'color' : '#14171a'
                    } );
                
                jq_range_container.find( 'span.range_text' )
                    .text( OPTIONS.DIALOG_TWEET_ID_RANGE_MARK )
                    .attr( {
                    } )
                    .css( {
                        'margin-left' : '8px'
                    ,   'margin-right' : '8px'
                    ,   'white-space': 'nowrap'
                    } )
                    .parent()
                    .css( {
                        'min-width' : '80px'
                    } );
                
                jq_range_container.find( 'input.tweet_id' )
                    .attr( {
                    } )
                    .css( {
                        'width' : '160px'
                    //,   'color' : '#14171a'
                    //,   'background' : 'white'
                    //,   'border-color' : '#e6ecf0'
                    } )
                    .parent()
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
                    } )
                    .parent()
                    .css( {
                        'width' : '160px'
                    ,   'text-align' : 'right'
                    } );
                
                jq_range_container.find( 'input.tweet_number' )
                    .attr( {
                    } )
                    .css( {
                        'width' : '48px'
                    //,   'color' : '#14171a'
                    //,   'background' : 'white'
                    //,   'border-color' : '#e6ecf0'
                    } );
                
                jq_range_container.find( 'tr.date-range' )
                    .attr( {
                    } )
                    .css( {
                        'height' : '20px'
                    } );
                
                self.jq_since_id = jq_since_id = jq_range_container.find( 'input[name="since_id"]' );
                self.jq_until_id = jq_until_id = jq_range_container.find( 'input[name="until_id"]' );
                self.jq_since_date = jq_since_date = jq_range_container.find( 'tr.date-range td.since-date' );
                self.jq_until_date = jq_until_date = jq_range_container.find( 'tr.date-range td.until-date' );
                
                
                function set_change_event( jq_target_id, jq_target_date ) {
                    jq_target_id.change( function ( event ) {
                        var val = jq_target_id.val().trim(),
                            tweet_id = '',
                            date = null,
                            date_string = '';
                        
                        if ( self.is_for_likes_timeline ) {
                            if ( val.match( /^(\d{4})(\d{2})(\d{2})[_\-](\d{2})(\d{2})(\d{2})$/ ) ) {
                                val = RegExp.$1 + '/' + RegExp.$2 + '/' + RegExp.$3 + ' ' + RegExp.$4 + ':' + RegExp.$5 + ':' + RegExp.$6;
                            }
                            
                            date = new Date( val );
                            
                            if ( isNaN( date.getTime() ) ) {
                                jq_target_id.val( '' );
                                jq_target_date.text( '' );
                                return;
                            }
                            
                            date_string = format_date( date, 'YYYY/MM/DD hh:mm:ss' );
                            
                            jq_target_id.val( date_string );
                            jq_target_date.text( date_string ).hide();
                        }
                        else {
                            tweet_id = get_tweet_id( val );
                            
                            if ( ! tweet_id ) {
                                tweet_id = datetime_to_tweet_id( val );
                            }
                            if ( ! tweet_id ) {
                                jq_target_id.val( '' );
                                jq_target_date.text( '' );
                                return;
                            }
                            date = tweet_id_to_date( tweet_id );
                            jq_target_id.val( tweet_id );
                            jq_target_date.text( ( date ) ? format_date( date, 'YYYY/MM/DD hh:mm:ss' ) : '' ).show();
                        }
                    } );
                } // end of set_change_event()
                
                
                set_change_event( jq_since_id, jq_since_date );
                set_change_event( jq_until_id, jq_until_date );
                
                self.jq_limit_tweet_number = jq_limit_tweet_number = jq_range_container.find( 'input[name="limit"]' );
                jq_limit_tweet_number
                    .val( limit_tweet_number )
                    .change( function ( event ) {
                        var val = jq_limit_tweet_number.val().trim();
                        
                        if ( ! val ) {
                            val = 0;
                        }
                        else if ( isNaN( val ) ) {
                            val = OPTIONS.OPTIONS.DEFAULT_LIMIT_TWEET_NUMBER;
                        }
                        limit_tweet_number = parseInt( val, 10 );
                        set_value( SCRIPT_NAME + '_limit_tweet_number', String( limit_tweet_number ) );
                        jq_limit_tweet_number.val( limit_tweet_number );
                    } );
                
                self.jq_checkbox_container = jq_checkbox_container = $( '<div />' )
                    .addClass( SCRIPT_NAME + '_checkbox_container' )
                    .attr( {
                    } )
                    .css( {
                        'position' : 'absolute'
                    ,   'left' : '0'
                    ,   'bottom' : '16px'
                    ,   'width' : '480px'
                    ,   'text-align' : 'center'
                    } );
                
                self.jq_button_container = jq_button_container = $( '<div />' )
                    .addClass( SCRIPT_NAME + '_button_container' )
                    .attr( {
                    } )
                    .css( {
                        'position' : 'absolute'
                    ,   'right' : '8px'
                    ,   'bottom' : '8px'
                    } );
                
                self.jq_status_container = jq_status_container = $( '<div />' )
                    .addClass( SCRIPT_NAME + '_status' )
                    .attr( {
                    } )
                    .css( {
                        'position' : 'relative'
                    ,   'width' : '100%'
                    ,   'height' : '70%'
                    //,   'background' : 'ghostwhite'
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
                    //,   'border' : 'inset ghostwhite 1px'
                    ,   'padding' : '4px 4px 4px 4px'
                    //,   'color' : '#14171a'
                    //,   'background' : 'snow'
                    } );
                
                self.jq_log_mask = jq_log_mask = jq_log.clone()
                    .removeClass( SCRIPT_NAME + '_log' )
                    .addClass( SCRIPT_NAME + '_log_mask' )
                    .css( {
                        'display' : 'none'
                    ,   'z-index' : '10001'
                    //,   'background' : 'rgba( 0, 0, 0, 0.8 )'
                    } );
                jq_log_mask
                    .append( '<div class="loading"><span class="spinner-bigger"></span></div>' )
                    .find( '.loading' )
                    .css( {
                        'position' : 'absolute'
                    ,   'top' : '50%'
                    ,   'left' : '50%'
                    ,   'transform' : 'translate(-50%, -50%)'
                    } );
                
                jq_checkbox_container
                    .append( jq_checkbox_image )
                    .append( jq_checkbox_gif )
                    .append( jq_checkbox_video )
                    .append( jq_checkbox_include_retweets )
                    .append( jq_checkbox_dry_run ) // style 設定のため、一時的に append
                    .find( 'label' )
                    .css( {
                        'display' : 'inline-block'
                    ,   'width' : '100px'
                    ,   'margin-right' : '8px'
                    ,   'vertical-align' : 'middle'
                    ,   'text-align' : 'left'
                    //,   'color' : '#14171a'
                    ,   'font-size' : '12px'
                    } );
                jq_checkbox_container.find( 'input' )
                    .css( {
                        'margin-right' : '4px'
                    ,   'vertical-align' : 'middle'
                    } );
                
                jq_button_container
                    .append( jq_checkbox_dry_run )
                    .append( $( '<br />' ) )
                    .append( jq_button_start )
                    .append( jq_button_stop )
                    .find( 'button' )
                    .addClass( 'btn' )
                    .css( {
                        'margin' : '0 8px'
                    } );
                
                jq_toolbox.append( jq_range_container );
                
                if ( oauth2_access_token ) {
                    jq_toolbox.append( jq_checkbox_container );
                }
                
                jq_toolbox.append( jq_button_container );
                
                jq_status_container
                    .append( jq_log )
                    .append( jq_log_mask );
                
                jq_dialog.append( jq_toolbox ).append( jq_status_container );
                
                jq_container.append( jq_dialog );
                
                jq_container.appendTo( $( d.body ) );
                
                return self;
            } // end of init_container()
        
        ,   clear_log : function ( log_string ) {
                var self = this,
                    jq_log = self.jq_log,
                    added_logline_is_hidden = self.added_logline_is_hidden = false;
                
                if ( ! jq_log ) {
                    return self;
                }
                
                jq_log.html( '' );
                
                return self;
            } // end of clear_log()
            
        ,   log : ( function () {
                var reg_char_to_escape = /[&'`"<>]/g,
                    reg_url =  /(https?:\/\/[\w\/:%#$&?\(\)~.=+\-;]+)/g,
                    reg_tweet_url = /\/\/twitter\.com/;
                
                function escape_html( match ) {
                    return {
                        '&' : '&amp;'
                    ,   "'" : '&#x27;'
                    ,   '`' : '&#x60;'
                    ,   '"' : '&quot;'
                    ,   '<' : '&lt;'
                    ,   '>' : '&gt;'
                    }[ match ];
                } // end of escape_html()
                
                 function get_link_html( all, url ) {
                    var class_link_type = ( reg_tweet_url.test( url ) ) ? 'tweet-link' : 'media-link';
                    
                    return '<a href="' + url + '" target="_blank" class="' + class_link_type + '">' + url + '</a>';
                } // end of get_link_html()
                    
                return function () {
                    var self = this,
                        jq_log = self.jq_log,
                        text = to_array( arguments ).join( ' ' ) + '\n',
                        
                        html = text.replace( reg_char_to_escape, escape_html ).replace( reg_url, get_link_html ),
                        jq_paragraph;
                    
                    if ( ! jq_log ) {
                        return self;
                    }
                    
                    jq_paragraph = $( '<pre />' )
                        .addClass( 'log-item' )
                        .html( html )
                        .css( {
                            'font-size' : '12px'
                        ,   'line-height' : '16px'
                        ,   'overflow': 'visible'
                        //,   'text-shadow' : '1px 1px 1px #ccc'
                        } );
                    
                    if ( self.added_logline_is_hidden ) {
                        jq_paragraph.hide();
                    }
                    
                    jq_log.append( jq_paragraph );
                    jq_log.scrollTop( jq_log.prop( 'scrollHeight' ) );
                    
                    return self;
                };
            } )() // end of log()
        
        ,   set_to_hide_added_logline : function () {
                var self = this;
                
                self.added_logline_is_hidden = true;
                
                self.jq_log_mask.show();
                
                return self;
            } // end of set_to_hide_added_logline()
        
        ,   set_to_show_added_logline : function () {
                var self = this,
                    jq_log = self.jq_log;
                
                jq_log.find( 'pre.log-item:hidden' ).show();
                setTimeout( function () {
                    jq_log.scrollTop( jq_log.prop( 'scrollHeight' ) );
                }, 1 );
                self.added_logline_is_hidden = false;
                
                self.jq_log_mask.hide();
                
                return self;
            } // end of set_to_show_added_logline()
        
        ,   log_hr : function () {
                var self = this;
                
                self.log( '--------------------------------------------------------------------------------' ); 
                
                return self;
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
                self.jq_button_container.find( 'input[type=checkbox]' ).prop( 'disabled', false );
                self.jq_checkbox_container.find( 'input[type=checkbox]' ).prop( 'disabled', false );
                
                if ( self.is_for_likes_timeline || judge_search_timeline() ) {
                    self.jq_checkbox_include_retweets.hide();
                }
                else {
                    self.jq_checkbox_include_retweets.show();
                }
                
                return self;
            } // end of reset_buttons()
        
        ,   show_container : function ( is_for_likes_timeline ) {
                var self = this,
                    jq_container = self.jq_container,
                    jq_range_container,
                    jq_button_close;
                
                self.is_for_likes_timeline = !! is_for_likes_timeline;
                
                if ( ! jq_container ) {
                    self.init_container();
                    
                    jq_container = self.jq_container;
                }
                
                jq_range_container = self.jq_range_container;
                
                if ( is_for_likes_timeline ) {
                    jq_range_container.find( 'h3 > span.range_header_text' ).text( OPTIONS.LIKES_DIALOG_TWEET_ID_RANGE_HEADER );
                    jq_range_container.find( 'span.range_text' ).text( OPTIONS.LIKES_DIALOG_TWEET_ID_RANGE_MARK );
                }
                else {
                    jq_range_container.find( 'h3 > span.range_header_text' ).text( OPTIONS.DIALOG_TWEET_ID_RANGE_HEADER );
                    jq_range_container.find( 'span.range_text' ).text( OPTIONS.DIALOG_TWEET_ID_RANGE_MARK );
                }
                
                if ( is_night_mode() ) {
                    jq_container.addClass( 'night_mode' );
                }
                else {
                    jq_container.removeClass( 'night_mode' );
                }
                
                self.reset_flags();
                self.reset_buttons();
                
                self.jq_since_id.val( '' );
                self.jq_until_id.val( '' );
                self.jq_since_date.text( '' );
                self.jq_until_date.text( '' );
                self.clear_log();
                
                self.saved_body_overflow = $( d.body ).get( 0 ).style.overflow;
                self.saved_body_overflow_x = $( d.body ).get( 0 ).style.overflowX;
                self.saved_body_overflow_y = $( d.body ).get( 0 ).style.overflowY;
                // ※ $( 'body' ).css( 'overflow' ) だと getComputedStyle() による値が取れてしまうため、element.style.* を取得したい場合には適さない
                
                jq_container.show();
                
                $( d.body )
                .on( 'keydown.dialog', function ( event ) {
                    if ( event.shiftKey || event.altKey || event.ctrlKey ) {
                        // [Shift], [Alt], [Ctrl] と併用する場合は何もしない
                        return;
                    }
                    
                    var key_code = event.keyCode;
                    
                    switch ( key_code ) {
                        case 27 :
                            self.jq_button_close.click();
                            
                            event.stopPropagation();
                            event.preventDefault();
                            break;
                    }
                } )
                .css( {
                    // ダイアログを出している間は body のスクロールをさせない
                    'overflow-x' : 'hidden',
                    'overflow-y' : 'hidden'
                } );
                
                return self;
            } // end of show_container()
        
        ,   hide_container : function () {
                var self = this,
                    jq_container = self.jq_container;
                
                if ( ! jq_container ) {
                    return self;
                }
                
                $( d.body )
                .css( {
                    'overflow' : self.saved_body_overflow,
                    'overflow-x' : self.saved_body_overflow_x,
                    'overflow-y' : self.saved_body_overflow_y
                } )
                .off( 'keydown.dialog' );
                
                jq_container.hide();
                
                return self;
            } // end of hide_container()
        
        
        ,   csv_push_row : function ( column_map ) {
                var self = this;
                
                if ( ! column_map ) {
                    column_map = {};
                }
                
                var column_item_list = [ 'tweet_date', 'action_date', 'profile_name', 'screen_name', 'tweet_url', 'media_type', 'media_url', 'media_filename', 'remarks', 'tweet_content', 'reserve01', 'reserve02', 'reserve03' ].map( function ( column_name ) {
                        return ( column_map[ column_name ] ) ? column_map[ column_name ] : '';
                    } );
                
                self.csv.push_row( column_item_list );
                
                return self;
            } // end of csv_push_row()
        
        
        ,   start_download : function () {
                var self = this;
                
                if ( self.downloading ) {
                    return self;
                }
                
                self.jq_since_id.trigger( 'change', [ true ] );
                self.jq_until_id.trigger( 'change', [ true ] );
                self.jq_limit_tweet_number.trigger( 'change', [ true ] );
                
                var is_search_timeline = self.is_search_timeline = judge_search_timeline(),
                    screen_name = get_screen_name(),
                    profile_name = get_profile_name(),
                    since_id = self.jq_since_id.val().trim(),
                    until_id = self.jq_until_id.val().trim(),
                    since_date = self.jq_since_date.text().trim(),
                    until_date = self.jq_until_date.text().trim(),
                    max_id = '',
                    min_id = '',
                    max_datetime = '',
                    min_datetime = '',
                    total_tweet_counter = 0,
                    total_image_counter = 0,
                    total_file_size = 0,
                    filter_info = {
                        image : support_image
                    ,   gif : support_gif
                    ,   video : support_video
                    ,   include_retweets : include_retweets
                    ,   dry_run : dry_run
                    ,   is_for_likes_timeline : self.is_for_likes_timeline
                    },
                    MediaTimeline = self.MediaTimeline = object_extender( TemplateMediaTimeline ),
                    zip = null,
                    zip_request = null,
                    csv = self.csv = object_extender( Csv ).init(),
                    date_ms;
                
                if ( self.is_for_likes_timeline ) {
                    if ( since_id ) {
                        since_date = since_id;
                        since_id = datetime_to_like_id( since_id );
                    }
                    if ( ! since_id ) {
                        since_id = '';
                        since_date = '<unspecified>';
                    }
                    
                    if ( until_id ) {
                        until_date = until_id;
                        until_id = datetime_to_like_id( until_id );
                    }
                    if ( ! until_id ) {
                        until_id = '';
                        until_date = '<unspecified>';
                    }
                }
                else {
                    since_date = ( since_date ) ? '(' + since_date + ')' : '(unknown)';
                    until_date = ( until_date ) ? '(' + until_date + ')' : '(unknown)';
                }
                
                MediaTimeline.init( screen_name, until_id, since_id, filter_info );
                
                
                if ( ( OPTIONS.ENABLE_ZIPREQUEST ) && ( typeof ZipRequest == 'function' ) ) {
                    zip_request = new ZipRequest().open();
                }
                else {
                    zip = new JSZip();
                }
                
                if ( MediaTimeline.search_query ) {
                    self.log( 'Search Query :', MediaTimeline.search_query );
                    self.csv_push_row( {
                        tweet_date : 'Search Query:',
                        action_date : MediaTimeline.search_query
                    } );
                }
                
                var line_prefix = '';
                
                if ( ! is_search_timeline ) {
                    line_prefix = '[@' + screen_name + '] ';
                    self.csv_push_row( {
                        tweet_date : profile_name,
                        action_date : '@' + screen_name,
                    } );
                }
                
                if ( self.is_for_likes_timeline ) {
                    self.log( line_prefix + '"Likes" date-time range :', since_date, '-', until_date );
                    self.csv_push_row( {
                        tweet_date : '"Likes" range:',
                        action_date : since_date + ' ~ ' + until_date
                    } );
                }
                else {
                    self.log( line_prefix + 'Tweet range :', ( ( since_id ) ? since_id : '<unspecified>' ), since_date, '-', ( ( until_id ) ? until_id : '<unspecified>' ), until_date );
                    self.csv_push_row( {
                        tweet_date : 'Tweet range:',
                        action_date : ( ( since_id ) ? since_id : '<unspecified>' ) + ' ' + since_date + ' ~ ' + ( ( until_id ) ? until_id : '<unspecified>' ) + ' ' + until_date
                    } );
                }
                
                var flag_strings = [
                        'Image : ' + ( support_image ? 'on' : 'off' )
                    ,   'GIF : ' + ( support_gif ? 'on' : 'off' )
                    ,   'Video : ' + ( support_video ? 'on' : 'off' )
                    ],
                    flag_text = '';
                
                if ( is_search_timeline || self.is_for_likes_timeline ) {
                }
                else {
                    flag_strings.push( 'include RTs : ' + ( include_retweets ? 'on' : 'off' ) );
                }
                
                flag_text = flag_strings.join( '  /  ' ) + ( ( dry_run ) ? '   ** DRY RUN **' : '' );
                
                self.log( flag_text );
                
                self.csv_push_row( {
                    tweet_date : flag_text
                } );
                
                self.csv_push_row( {
                    tweet_date : 'Tweet date',
                    action_date : 'Action date',
                    profile_name : 'Display name',
                    screen_name : 'Username',
                    tweet_url : 'Tweet URL',
                    media_type : 'Media type',
                    media_url : 'Media URL',
                    media_filename : 'Saved filename',
                    remarks : 'Remarks',
                    tweet_content : 'Tweet content'
                } );
                
                self.log_hr();
                
                
                function close_dialog() {
                    if ( zip_request ) {
                        zip_request.close();
                        zip_request = null;
                    }
                    zip = null;
                    MediaTimeline = null;
                    
                    self.hide_container();
                } // end of close_dialog()
                
                
                function clean_up( callback ) {
                    if ( zip_request ) {
                        zip_request.close();
                        zip_request = null;
                    }
                    zip = null;
                    MediaTimeline = null;
                    
                    self.reset_flags();
                    self.reset_buttons();
                    
                    if ( typeof callback == 'function' ) {
                        callback();
                    }
                } // end of clean_up()
                
                
                function request_save( callback ) {
                    function _callback() {
                        if ( typeof callback == 'function' ) {
                            callback();
                        }
                    }  // end of _callback()
                    
                    if ( ( ! min_id ) || ( ! max_id ) || ( total_tweet_counter <= 0 ) || ( total_image_counter <= 0 ) ) {
                        _callback();
                        return;
                    }
                    
                    var filename_head = ( self.is_search_timeline ) ? ( 'search(' + format_date( new Date(), 'YYYYMMDD_hhmmss' ) + ')' ) : screen_name,
                        filename_prefix;
                    
                    if ( self.is_for_likes_timeline ) {
                         filename_prefix = [
                                filename_head
                            ,   'likes'
                            ,   datetime_to_timestamp( min_datetime )
                            ,   datetime_to_timestamp( max_datetime )
                            ,   ( ( dry_run ) ? 'dryrun' : 'media' )
                            ].join( '-' );
                    }
                    else {
                         filename_prefix = [
                                filename_head
                            ,   ( min_id + '(' + datetime_to_timestamp( min_datetime ) + ')' )
                            ,   ( max_id + '(' + datetime_to_timestamp( max_datetime ) + ')' )
                            ,   ( ( ( ! self.is_search_timeline ) && include_retweets ) ? 'include_rts-' : '' ) + ( ( dry_run ) ? 'dryrun' : 'media' )
                            ].join( '-' );
                    }
                    
                    var log_text = self.jq_log.text(),
                        csv_content = self.csv.create_csv_content().get_csv_content(),
                        log_filename = filename_prefix + '.log',
                        csv_filename = filename_prefix + '.csv',
                        zip_filename = filename_prefix + '.zip',
                        zip_content_type = 'blob',
                        url_scheme = 'blob';
                    
                    total_file_size += string_to_arraybuffer( log_text ).byteLength;
                    total_file_size += string_to_arraybuffer( csv_content ).byteLength;
                    
                    if ( IS_FIREFOX && ( total_file_size < BASE64_BLOB_THRESHOLD ) ) {
                        zip_content_type =  'base64';
                        url_scheme = 'data';
                    }
                    log_debug( 'Total: ', total_file_size, 'byte' );
                    
                    if ( zip_request ) {
                        zip_request.file( {
                            data : log_text,
                            filename : log_filename,
                            zip_options : {
                                date : adjust_date_for_zip( new Date() )
                            }
                        }, function ( response ) {
                            if ( response.error ) {
                                log_error( 'zip_request.file()', response.error );
                            }
                        } );
                        
                        zip_request.file( {
                            data : csv_content,
                            filename : csv_filename,
                            zip_options : {
                                date : adjust_date_for_zip( new Date() )
                            }
                        }, function ( response ) {
                            if ( response.error ) {
                                log_error( 'zip_request.file()', response.error );
                            }
                        } );
                        
                        zip_request.generate( url_scheme, function ( response ) {
                            if ( ! zip_request ) {
                                log_error( 'zip_request.generate(): zip_request was already removed'  );
                                _callback();
                                return;
                            }
                            zip_request.close();
                            zip_request = null;
                            
                            if ( response.error ) {
                                log_error( 'zip_request.generate()', response.error );
                                _callback();
                                return;
                            }
                            download_url( zip_filename, response.zip_url );
                            _callback();
                        } );
                    }
                    else if ( zip ) {
                        zip.file( log_filename, log_text, {
                            date : adjust_date_for_zip( new Date() )
                        } );
                        
                        zip.file( csv_filename, csv_content, {
                            date : adjust_date_for_zip( new Date() )
                        } );
                        
                        zip.generateAsync( { type : zip_content_type } )
                        .then( function ( zip_content ) {
                            // TODO: ZIP を保存しようとすると、Firefox でセキュリティ警告が出る場合がある（「このファイルを開くのは危険です」(This file is not commonly downloaded.)）
                            // → Firefox のみ、Blob URL ではなく、Data URL(Base64) で様子見
                            if ( zip_content_type == 'base64' ) {
                                log_debug( 'Base64: ', zip_content.length, 'byte' );
                                download_base64( zip_filename, zip_content );
                            }
                            else {
                                download_blob( zip_filename, zip_content );
                            }
                            zip = null;
                            _callback();
                        } )
                        .catch( function ( error ) {
                            log_error( 'Error in zip.generateAsync()', error );
                            _callback();
                        } );
                    }
                    else {
                        log_error( 'zip / zip_request was already removed' );
                        _callback();
                    }
                } // end of request_save()
                
                
                function stop_download( callback ) {
                    self.log_hr();
                    
                    self.set_to_hide_added_logline();
                    
                    if ( self.is_for_likes_timeline ) {
                        self.log( '[Stop]', min_datetime, '-', max_datetime, ' ( Tweet:', total_tweet_counter, '/ Media:', total_image_counter, ')' );
                    }
                    else {
                        self.log( '[Stop]', min_id, '-', max_id, ' ( Tweet:', total_tweet_counter, '/ Media:', total_image_counter, ')' );
                    }
                    
                    request_save( function () {
                        self.set_to_show_added_logline();
                        
                        if ( ( ! dry_run ) && min_id ) {
                            self.jq_until_id.val( ( self.is_for_likes_timeline ) ? min_datetime : min_id ).trigger( 'change', [ true ] );
                        }
                        
                        if ( typeof callback == 'function' ) {
                            callback();
                        }
                    } );
                    
                } // end of stop_download()
                
                
                function download_completed( callback ) {
                    self.log_hr();
                    
                    self.set_to_hide_added_logline();
                    
                    var is_limited = !! ( limit_tweet_number && ( limit_tweet_number <= total_tweet_counter ) );
                    
                    if ( self.is_for_likes_timeline ) {
                        self.log( '[Complete' + ( is_limited  ? '(limited)' : '' ) + ']', min_datetime, '-', max_datetime, ' ( Tweet:', total_tweet_counter, '/ Media:', total_image_counter, ')' );
                    }
                    else {
                        self.log( '[Complete' + ( is_limited  ? '(limited)' : '' ) + ']', min_id, '-', max_id, ' ( Tweet:', total_tweet_counter, '/ Media:', total_image_counter, ')' );
                    }
                    
                    request_save( function () {
                        self.set_to_show_added_logline();
                        
                        if ( ( ! dry_run ) && is_limited && min_id ) {
                            self.jq_until_id.val( ( self.is_for_likes_timeline ) ? min_datetime : min_id ).trigger( 'change', [ true ] );
                        }
                        
                        if ( typeof callback == 'function' ) {
                            callback();
                        }
                    } );
                    
                } // end of download_completed()
                
                
                function is_close_dialog_requested() {
                    if ( ! self.closing ) {
                        return false;
                    }
                    
                    clean_up( function () {
                        close_dialog();
                    } );
                    
                    return true;
                } // end of is_close_dialog_requested()
                
                
                function is_stop_download_requested() {
                    if ( ! self.stopping ) {
                        return false;
                    }
                    
                    stop_download( function () {
                        clean_up();
                    } );
                    
                    return true;
                } // end of is_stop_download_requested()
                
                
                function check_tweet_info( result ) {
                    if ( is_close_dialog_requested() || is_stop_download_requested() ) {
                        return;
                    }
                    
                    if ( 
                        ( ! result ) ||
                        ( ! result.tweet_info ) ||
                        ( limit_tweet_number && ( limit_tweet_number <= total_tweet_counter ) )
                    ) {
                        download_completed( function () {
                            clean_up();
                        } );
                        return;
                    }
                    
                    var current_tweet_info_fetch_result = result,
                        current_tweet_info = result.tweet_info,
                        current_image_result_map = {},
                        current_image_download_counter = 0,
                        current_tweet_action_date = '';
                    
                    if ( self.is_for_likes_timeline ) {
                        current_tweet_action_date = format_date( like_id_to_date( result.media_timeline_parameters.max_position ), 'YYYY/MM/DD hh:mm:ss' );
                        self.log( ( 1 + total_tweet_counter ) + '.', current_tweet_action_date + '(L) <-', current_tweet_info.datetime, current_tweet_info.tweet_url );
                    }
                    else {
                        if ( self.is_search_timeline || ( ! include_retweets ) || ( ! current_tweet_info.retweet_id ) ) {
                            self.log( ( 1 + total_tweet_counter ) + '.', current_tweet_info.datetime, current_tweet_info.tweet_url );
                        }
                        else {
                            var rt_date = tweet_id_to_date( current_tweet_info.retweet_id ),
                                rt_datetime = ( rt_date ) ? format_date( rt_date, 'YYYY/MM/DD hh:mm:ss' ) : current_tweet_info.retweet_id;
                            
                            current_tweet_action_date = ( rt_date ) ? rt_datetime : '(ID:' + current_tweet_info.retweet_id + ')';
                            self.log( ( 1 + total_tweet_counter ) + '.', rt_datetime + '(R) <-', current_tweet_info.datetime, current_tweet_info.tweet_url );
                        }
                    }
                    
                    function push_image_result( image_url, image_result ) {
                        if ( ! image_result ) {
                            image_result = {
                                error : '[bug] unknown error'
                            };
                        }
                        
                        if ( current_image_result_map[ image_url ] ) {
                            return;
                        }
                        
                        current_image_result_map[ image_url ] = image_result;
                        
                        current_image_download_counter ++;
                        
                        if ( current_image_download_counter < current_tweet_info.image_urls.length ) {
                            return;
                        }
                        
                        var current_tweet_id = current_tweet_info.tweet_id,
                            current_target_id = ( self.is_for_likes_timeline ) ? current_tweet_info_fetch_result.media_timeline_parameters.max_position : ( current_tweet_info.retweet_id || current_tweet_id ),
                            report_index = 0,
                            date;
                        
                        if ( ( ! max_id ) || ( bignum_cmp( max_id, current_target_id ) < 0 ) ) {
                            max_id = current_target_id;
                            
                            if ( self.is_for_likes_timeline ) {
                                max_datetime = format_date( like_id_to_date( max_id ), 'YYYY/MM/DD hh:mm:ss' );
                            }
                            else {
                                max_datetime = current_tweet_info.datetime;
                            }
                        }
                        
                        if ( ( ! min_id ) || ( bignum_cmp( current_target_id, min_id ) < 0 ) ) {
                            min_id = current_target_id;
                            
                            if ( self.is_for_likes_timeline ) {
                                min_datetime = format_date( like_id_to_date( min_id ), 'YYYY/MM/DD hh:mm:ss' );
                            }
                            else {
                                min_datetime = current_tweet_info.datetime;
                            }
                        }
                        
                        total_tweet_counter ++;
                        total_image_counter += current_image_download_counter;
                        
                        $.each( current_tweet_info.image_urls, function ( index, image_url ) {
                            report_index ++;
                            
                            var image_result = current_image_result_map[ image_url ],
                                media_type = current_tweet_info.media_type,
                                img_extension = ( media_type == 'image' ) ? get_img_extension( image_url ) : get_video_extension( image_url ),
                                media_prefix = ( media_type == 'gif' ) ? 'gif' : ( ( media_type == 'image' ) ? 'img' : 'vid' ),
                                is_api_url = /^https?:\/\/api\.twitter\.com\//.test( image_url ),
                                media_infos = current_tweet_info.media_infos[ index ],
                                image_filename = media_infos.image_filename,
                                media_url = ( is_api_url ) ? '-' : image_url;
                            
                            if ( media_type == 'image' ) {
                                if ( media_url.match( /^(.+)\.([^.:]+):?((?:[^:]+)?)$/ ) ) {
                                    media_url = RegExp.$1 + '?format=' + RegExp.$2 + ( ( RegExp.$3 ) ? '&name=' + RegExp.$3 : '' );
                                }
                            }
                            
                            self.csv_push_row( {
                                tweet_date : current_tweet_info.datetime,
                                action_date : current_tweet_action_date,
                                profile_name : current_tweet_info.tweet_profile_name,
                                screen_name : '@' + current_tweet_info.tweet_screen_name,
                                tweet_url : current_tweet_info.tweet_url,
                                media_url : media_url,
                                media_type : ( media_type == 'gif' ) ? 'GIF' : ( ( media_type == 'image' ) ? 'Image' : 'Video' ),
                                media_filename : ( ( ! image_filename ) || image_result.error || is_api_url ) ? '-' : image_filename,
                                remarks : ( image_result.error ) ? image_result.error : '',
                                tweet_content : current_tweet_info.tweet_text
                            } );
                            
                            if ( image_result.error ) {
                                self.log( '  ' + media_prefix + report_index + ')', media_url, '=>', image_result.error );
                                return;
                            }
                            
                            self.log( '  ' + media_prefix + report_index + ')', media_url );
                            
                            if ( dry_run ) {
                                return;
                            }
                            
                            if ( zip && image_result.arraybuffer ) {
                                zip.file( image_filename, image_result.arraybuffer, {
                                    date : current_tweet_info.zipdate
                                } );
                                
                                total_file_size += image_result.arraybuffer.byteLength;
                                delete image_result.arraybuffer;
                                image_result.arraybuffer = null;
                            }
                            else if ( zip_request && Number.isFinite( image_result.size ) ) {
                                total_file_size += image_result.size;
                                
                                log_debug( image_url, '=>', image_result.size, 'byte / total: ', total_file_size , 'byte' );
                            }
                            else {
                                self.log( '  ' + media_prefix + report_index + ')', image_url, '=> zip / zip_request was already removed' );
                            }
                            
                            if ( ( OPTIONS.DOWNLOAD_SIZE_LIMIT_MB ) && ( OPTIONS.DOWNLOAD_SIZE_LIMIT_MB * 1000000 <= total_file_size ) ) {
                                self.jq_button_stop.click();
                                
                                self.log_hr();
                                self.log( 'Stop: total file size is over limit' );
                            }
                        } );
                        
                        MediaTimeline.fetch_tweet_info( check_tweet_info );
                    
                    } // end of push_image_result()
                    
                    
                    function load_image( image_url_index, first_image_url, current_image_url ) {
                        if ( ! current_image_url ) {
                            current_image_url = first_image_url;
                        }
                        
                        var extension_list = [ 'png', 'jpg', 'gif' ],
                            next_extension_map = {
                                'png' : 'gif'
                            ,   'gif' : 'jpg'
                            ,   'jpg' : 'png'
                            },
                            first_extension = get_img_extension( first_image_url, extension_list ),
                            current_extension = get_img_extension( current_image_url, extension_list ),
                            media_type = current_tweet_info.media_type,
                            media_extension = ( media_type == 'image' ) ? current_extension : get_video_extension( current_image_url ),
                            media_prefix = ( media_type == 'gif' ) ? 'gif' : ( ( media_type == 'image' ) ? 'img' : 'vid' ),
                            timestamp = datetime_to_timestamp( current_tweet_info.datetime ),
                            image_filename = [ current_tweet_info.tweet_screen_name, current_tweet_info.tweet_id, timestamp, media_prefix + ( image_url_index + 1 ) ].join( '-' ) + '.' + media_extension;
                        
                        current_tweet_info.image_urls[ image_url_index ] = current_image_url;
                        current_tweet_info.media_infos[ image_url_index ] = {
                            timestamp : timestamp,
                            image_filename : image_filename
                        };
                        
                        if ( dry_run ) {
                            push_image_result( first_image_url, {} );
                            return;
                        }
                            
                        if ( zip_request ) {
                            zip_request.file( {
                                url : current_image_url,
                                filename : image_filename,
                                zip_options : {
                                    date : current_tweet_info.zipdate
                                }
                            }, function ( response ) {
                                if ( response.error ) {
                                    // 元の拡張子が png でも、png:orig が取得できない場合がある
                                    // → gif:orig なら取得できるケース有り・ステータスチェックし、エラー時にはリトライする
                                    var next_extension = next_extension_map[ current_extension ];
                                    
                                    if ( ( ! next_extension ) || ( next_extension == first_extension ) ) {
                                        current_tweet_info.image_urls[ image_url_index ] = first_image_url;
                                        push_image_result( first_image_url, response );
                                        return;
                                    }
                                    load_image( image_url_index, first_image_url, current_image_url.replace( '.' + current_extension, '.' + next_extension ) );
                                    return;
                                }
                                push_image_result( current_image_url, response );
                            } );
                        }
                        else {
                            fetch_url( current_image_url, {
                                responseType : 'arraybuffer'
                            ,   onload : function ( response ) {
                                    if ( response.status < 200 || 300 <= response.status ) {
                                        // 元の拡張子が png でも、png:orig が取得できない場合がある
                                        // → gif:orig なら取得できるケース有り・ステータスチェックし、エラー時にはリトライする
                                        var next_extension = next_extension_map[ current_extension ];
                                        
                                        if ( ( ! next_extension ) || ( next_extension == first_extension ) ) {
                                            current_tweet_info.image_urls[ image_url_index ] = first_image_url;
                                            push_image_result( first_image_url, {
                                                error : response.status + ' ' + response.statusText
                                            } );
                                            return;
                                        }
                                        load_image( image_url_index, first_image_url, current_image_url.replace( '.' + current_extension, '.' + next_extension ) );
                                        return;
                                    }
                                    push_image_result( current_image_url, {
                                        arraybuffer : response.response
                                    } );
                                } // end of onload()
                            ,   onerror : function ( response ) {
                                    push_image_result( current_image_url, {
                                        error : response.status + ' ' + response.statusText
                                    } );
                                } // end of onerror()
                            } );
                        }
                    } // end of load_image()
                    
                    
                    if ( current_tweet_info.media_type == 'image' ) {
                        $.each( current_tweet_info.image_urls, function ( index, image_url ) {
                            load_image( index, image_url );
                        } );
                    }
                    else if ( current_tweet_info.media_type == 'gif' ) {
                        $.each( current_tweet_info.image_urls, function ( index, video_info_url ) {
                            if ( current_tweet_info.media_quick ) {
                                load_image( index, video_info_url );
                                return;
                            }
                            
                            if ( self.media_url_cache[ video_info_url ] ) {
                                load_image( index, self.media_url_cache[ video_info_url ] );
                                return;
                            }
                            
                            $.ajax( {
                                type : 'GET'
                            ,   url : video_info_url
                            ,   dataType : 'json'
                            ,   headers : {
                                    'Authorization' : 'Bearer ' + oauth2_access_token
                                }
                            } )
                            .done( function ( json ) {
                                var video_url = json.track.playbackUrl;
                                
                                current_tweet_info.image_urls[ index ] = video_url;
                                current_tweet_info.video_info = json.track;
                                
                                if ( is_video_url( video_url ) ) {
                                    self.media_url_cache[ video_info_url ] = video_url;
                                    load_image( index, video_url );
                                }
                                else {
                                    push_image_result( video_url, {
                                        error : 'not supported'
                                    } );
                                }
                            } )
                            .fail( function ( jqXHR, textStatus, errorThrown ) {
                                log_error( video_info_url, textStatus, jqXHR.status + ' ' + jqXHR.statusText );
                                push_image_result( video_info_url, {
                                    error : 'API error: ' + jqXHR.status + ' ' + jqXHR.statusText
                                } );
                            } )
                            .always( function () {
                            } );
                        } );
                    }
                    else if ( ( current_tweet_info.media_type == 'video' ) && ( current_tweet_info.media_source == 'vine' ) ) {
                        $.each( current_tweet_info.image_urls, function ( index, video_info_url ) {
                            if ( self.media_url_cache[ video_info_url ] ) {
                                load_image( index, self.media_url_cache[ video_info_url ] );
                                return;
                            }
                            
                            $.ajax( {
                                type : 'GET'
                            ,   url : video_info_url
                            ,   dataType : 'json'
                            ,   headers : {
                                    'Authorization' : 'Bearer ' + oauth2_access_token
                                }
                            } )
                            .done( function ( json ) {
                                var video_url = json.track.playbackUrl;
                                
                                current_tweet_info.image_urls[ index ] = video_url;
                                current_tweet_info.video_info = json.track;
                                
                                if ( is_video_url( video_url ) ) {
                                    self.media_url_cache[ video_info_url ] = video_url;
                                    load_image( index, video_url );
                                }
                                else {
                                    push_image_result( video_url, {
                                        error : 'not supported'
                                    } );
                                }
                            } )
                            .fail( function ( jqXHR, textStatus, errorThrown ) {
                                log_error( video_info_url, textStatus, jqXHR.status + ' ' + jqXHR.statusText );
                                push_image_result( video_info_url, {
                                    error : 'API error: ' + jqXHR.status + ' ' + jqXHR.statusText
                                } );
                            } )
                            .always( function () {
                            } );
                        } );
                    }
                    else {
                        $.each( current_tweet_info.image_urls, function ( index, tweet_info_url ) {
                            if ( self.media_url_cache[ tweet_info_url ] ) {
                                load_image( index, self.media_url_cache[ tweet_info_url ] );
                                return;
                            }
                            
                            $.ajax( {
                                type : 'GET'
                            ,   url : tweet_info_url
                            ,   dataType : 'json'
                            ,   headers : {
                                    'Authorization' : 'Bearer ' + oauth2_access_token
                                }
                            } )
                            .done( function ( json ) {
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
                                    log_error( tweet_info_url, error );
                                    // TODO: 外部動画等は未サポート
                                }
                                
                                current_tweet_info.video_info = video_info;
                                
                                if ( video_url ) {
                                    self.media_url_cache[ tweet_info_url ] = video_url;
                                    current_tweet_info.image_urls[ index ] = video_url;
                                    load_image( index, video_url );
                                }
                                else {
                                    push_image_result( tweet_info_url, {
                                        error : 'not supported'
                                    } );
                                }
                            } )
                            .fail( function ( jqXHR, textStatus, errorThrown ) {
                                log_error( tweet_info_url, textStatus, jqXHR.status + ' ' + jqXHR.statusText );
                                push_image_result( tweet_info_url, {
                                    error : 'API error: ' + jqXHR.status + ' ' + jqXHR.statusText
                                } );
                            } )
                            .always( function () {
                            } );
                        } );
                    }
                } // end of check_tweet_info()
                
                
                if ( since_id && until_id && ( bignum_cmp( until_id, since_id ) <= 0 ) ) {
                    self.log( '[Error]', 'Wrong range' );
                    
                    clean_up();
                    
                    return self;
                }
                
                self.downloading = true;
                self.stopping = false;
                self.closing = false;
                
                MediaTimeline.fetch_tweet_info( check_tweet_info );
                
                return self;
            } // end of start_download()
        
        ,   on_start : function ( event ) {
                var self = this;
                
                self.clear_log();
                
                self.jq_button_start.prop( 'disabled', true );
                self.jq_button_stop.prop( 'disabled', false );
                self.jq_button_container.find( 'input[type=checkbox]' ).prop( 'disabled', true );
                self.jq_checkbox_container.find( 'input[type=checkbox]' ).prop( 'disabled', true );
                
                self.start_download();
                
                return self;
            } // end of on_start()
        
        ,   on_stop : function ( event ) {
                var self = this;
                
                self.jq_button_stop.prop( 'disabled', true );
                self.jq_button_container.find( 'input[type=checkbox]' ).prop( 'disabled', false );
                self.jq_checkbox_container.find( 'input[type=checkbox]' ).prop( 'disabled', false );
                
                if ( self.MediaTimeline ) {
                    self.MediaTimeline.stop();
                }
                self.stopping = true;
                
                return self;
            } // end of on_stop()
        
        ,   on_close : function ( event ) {
                var self = this;
                
                self.jq_button_start.prop( 'disabled', true );
                self.jq_button_stop.prop( 'disabled', true );
                self.jq_button_container.find( 'input[type=checkbox]' ).prop( 'disabled', true );
                self.jq_checkbox_container.find( 'input[type=checkbox]' ).prop( 'disabled', true );
                
                if ( self.downloading ) {
                    if ( self.MediaTimeline ) {
                        self.MediaTimeline.stop();
                    }
                    self.closing = true;
                    
                    return self;
                }
                
                self.hide_container();
                
                return self;
            } // end of on_close()
        
        },
        
        
        MediaDownload = object_extender( TemplateMediaDownload ).init();
    
    
    function download_media_timeline( is_for_likes_timeline ) {
        MediaDownload.show_container( is_for_likes_timeline );
    } // end of download_media_timeline()
    
    
    return download_media_timeline;
} )(); // end of download_media_timeline()


var check_timeline_headers = ( function () {
    var button_class_name = SCRIPT_NAME + '_download_button',
        jq_button_template = $( '<a />' )
            .addClass( button_class_name )
            .addClass( 'js-tooltip' )
            .attr( {
                href : '#'
            ,   title : OPTIONS.DOWNLOAD_BUTTON_HELP_TEXT
            } )
            .css( {
                'font-size' : '16px'
            ,   'vertical-align' : 'middle'
            ,   'text-decoration' : 'underline'
            } )
            .click( function ( event ) {
                var jq_button = $( this );
                
                event.stopPropagation();
                event.preventDefault();
                
                jq_button.blur();
                
                download_media_timeline( jq_button.hasClass( 'likes' ) );
                
                return false;
            } );
    
    function check_search_timeline( jq_node ) {
        if ( ! judge_search_timeline() ) {
            return;
        }
        
        var jq_target_container = ( jq_node.hasClass( 'AdaptiveFiltersBar-nav' ) ) ? jq_node : jq_node.find( 'ul.AdaptiveFiltersBar-nav' );
        
        if ( jq_target_container.length <= 0 ) {
            return;
        }

        var jq_button = jq_button_template.clone( true ),
            jq_button_container = $( '<li class="AdaptiveFiltersBar-item u-borderUserColor" />' ).addClass( SCRIPT_NAME + '_download_button_container' );
        
        jq_target_container.find( '.' + SCRIPT_NAME + '_download_button_container' ).remove();
        
        jq_button
            .text( OPTIONS.DOWNLOAD_BUTTON_TEXT_LONG )
            .css( {
                'font-size' : '14px'
            ,   'font-weight' : 'bold'
            ,   'line-height' : '20px'
            //,   'color' : '#657786'
            ,   'display' : 'block'
            ,   'padding' : '16px'
            } );
        
        jq_button_container.append( jq_button );
        jq_target_container.append( jq_button_container );
        
    } // end of check_search_timeline()
    
    
    function check_profile_nav( jq_node ) {
        var jq_target_container = ( jq_node.hasClass( 'ProfileNav-list' ) ) ? jq_node : jq_node.find( 'ul.ProfileNav-list' );
        
        if ( jq_target_container.length <= 0 ) {
            return;
        }
        
        var jq_button = jq_button_template.clone( true )
                .text( OPTIONS.DOWNLOAD_BUTTON_TEXT_LONG ),
            
            jq_likes_button = jq_button_template.clone( true )
                .addClass( 'likes' )
                .text( OPTIONS.LIKES_DOWNLOAD_BUTTON_TEXT_LONG )
                .attr( 'title', OPTIONS.LIKES_DOWNLOAD_BUTTON_HELP_TEXT ),
            
            jq_button_container = $( '<li class="ProfileNav-item" />' )
                .append( jq_likes_button )
                .append( jq_button )
                .addClass( SCRIPT_NAME + '_download_button_container' )
                .css( {
                    'text-align' : 'right'
                } ),
            jq_insert_point = jq_target_container.find( '.ProfileNav-item--more' );
        
        jq_target_container.find( '.' + SCRIPT_NAME + '_download_button_container' ).remove();
        
        jq_button_container.find( '.' + SCRIPT_NAME + '_download_button' ).css( {
                'font-size' : '14px'
            ,   'font-weight' : 'bold'
            ,   'line-height' : '20px'
            //,   'color' : '#657786'
            ,   'display' : 'block'
            ,   'padding' : '0'
            } );
        
        if ( 0 < jq_insert_point.length ) {
            jq_insert_point.before( jq_button_container );
        }
        else {
            jq_target_container.append( jq_button_container );
        }
        
        if ( jq_target_container.find( 'a[data-nav="favorites"]' ).length <= 0 ) {
            jq_likes_button.hide();
        }
        
    } // end of check_profile_nav()
    
    
    function check_profile_heading( jq_node ) {
        var jq_target_container = ( jq_node.attr( 'data-element-term' ) == 'photos_and_videos_toggle' ) ? jq_node : jq_node.find( 'li[data-element-term="photos_and_videos_toggle"]' );
        
        if ( jq_target_container.length <= 0 ) {
            return;
        }
        
        var jq_button = jq_button_template.clone( true );
        
        jq_button
            .text( OPTIONS.DOWNLOAD_BUTTON_TEXT )
            .css( {
            } );
        
        jq_target_container.find( '.' + button_class_name ).remove();
        jq_target_container.append( jq_button );
        
    } // end of check_profile_heading()
    
    
    return function ( node ) {
        if ( ( ! node ) || ( node.nodeType != 1 ) ) {
            return false;
        }
        
        var jq_node = $( node );
        
        check_profile_nav( jq_node );
        check_profile_heading( jq_node );
        check_search_timeline( jq_node );
    };

} )(); // end of check_timeline_headers()


function add_media_button_to_tweet( jq_tweet ) {
    var tweet_id = jq_tweet.attr( 'data-tweet-id' ),
        jq_action_list = jq_tweet.find( '.ProfileTweet-actionList, footer' ),
        jq_images = jq_tweet.find( '.AdaptiveMedia-photoContainer img' ),
        jq_playable_media = jq_tweet.find( '.PlayableMedia' ),
        media_button_class_name = SCRIPT_NAME + '_media_button',
        tooltip_title = ( OPTIONS.OPEN_MEDIA_LINK_BY_DEFAULT ) ? OPTIONS.OPEN_MEDIA_LINK : OPTIONS.DOWNLOAD_MEDIA_TITLE,
        tooltip_alt_title = ( OPTIONS.OPEN_MEDIA_LINK_BY_DEFAULT ) ? OPTIONS.DOWNLOAD_MEDIA_TITLE : OPTIONS.OPEN_MEDIA_LINK,
        jq_media_button_container = $( '<div><button/></div>' )
            .addClass( 'ProfileTweet-action ' + media_button_class_name )
            .addClass( 'js-tooltip' )
            //.attr( 'data-original-title', 'Click: ' + tooltip_title + ' / \n[Alt]+Click: ' + tooltip_alt_title )
            .attr( 'title', 'Click: ' + tooltip_title + ' / \n[Alt]+Click: ' + tooltip_alt_title )
            .css( {
                'display' : 'none'
            } ),
        jq_media_button = jq_media_button_container.find( 'button:first' )
            .addClass( 'btn' )
            .css( {
                'font-size' : '12px'
            ,   'font-weight' : 'normal'
            ,   'padding' : '2px 3px'
            //,   'color' : 'white'
            //,   'background' : '#657786'
            ,   'text-decoration' : 'none'
            ,   'cursor' : 'pointer'
            ,   'display' : 'inline-block'
            } );
    
    if ( ( ! tweet_id ) || ( ( jq_images.length <= 0 ) && ( jq_playable_media.length <= 0 ) ) ) {
        return;
    }
    
    jq_action_list.find( '.' + media_button_class_name ).remove();
    
    
    function is_open_image_mode( event ) {
        return ( ( ( ! OPTIONS.OPEN_MEDIA_LINK_BY_DEFAULT ) && ( event.altKey ) ) || ( ( OPTIONS.OPEN_MEDIA_LINK_BY_DEFAULT ) && ( ! event.altKey ) ) );
    } // end of is_open_image_mode()
    
    
    var image_download_handler = ( function () {
        var clickable = true;
        
        function open_images( event ) {
            var image_urls = [];
            
            jq_images.each( function ( image_index ) {
                var jq_image = $( this ),
                    image_url = get_img_url_orig( jq_image.attr( 'src' ) );
                
                image_urls.unshift( image_url );
            } );
            
            image_urls.forEach( function ( image_url ) {
                w.open( image_url );
            } );
        } // end of open_images()
        
        
        return function ( event ) {
            event.stopPropagation();
            event.preventDefault();
            
            if ( is_open_image_mode( event ) ) {
                open_images( event );
                return;
            }
            
            if ( ! clickable ) {
                return;
            }
            clickable = false;
            jq_media_button.css( 'cursor', 'progress' );
            
            var image_info_list = [],
                download_counter = jq_images.length,
                screen_name = jq_tweet.find( 'a.js-user-profile-link.js-action-profile:first' ).attr( 'href' ).replace( /^.*\//, '' ),
                timestamp_ms = jq_tweet.find( '*[data-time-ms]' ).attr( 'data-time-ms' ),
                date = new Date( parseInt( timestamp_ms, 10 ) ),
                timestamp = ( timestamp_ms ) ? format_date( date, 'YYYYMMDD_hhmmss' ) : '',
                zipdate = adjust_date_for_zip( date ),
                media_prefix = 'img',
                zip = null,
                zip_request = null;
            
            
            if ( ( OPTIONS.ENABLE_ZIPREQUEST ) && ( typeof ZipRequest == 'function' ) ) {
                zip_request = new ZipRequest().open();
            }
            else {
                zip = new JSZip();
            }
            
            
            function clean_up() {
                if ( zip_request ) {
                    zip_request.close();
                    zip_request = null;
                }
                zip = null;
                
                clickable = true;
                jq_media_button.css( 'cursor', 'pointer' );
            } // end of clean_up()
            
            
            function download_completed() {
                clean_up();
            } // end of download_completed()
            
            
            function download_error() {
                clean_up();
            } // end of download_error()
            
            
            function set_result( target_image_index, image_result ) {
                if ( ! image_result ) {
                    image_result = {
                        error : '[bug] unknown error'
                    };
                }
                
                image_info_list[ target_image_index ].result = image_result;
                
                if ( 0 < --download_counter ) {
                    return;
                }
                
                $.each( image_info_list, function ( image_index, image_info ) {
                    var image_result = image_info.result,
                        img_extension = get_img_extension( image_info.image_url );
                    
                    if ( image_info.error ) {
                        log_error( image_info.image_url, '=>', image_info.error );
                        return;
                    }
                    
                    if ( zip && image_result.arraybuffer ) {
                        var image_filename = [ screen_name, tweet_id, timestamp, media_prefix + ( image_index + 1 ) ].join( '-' ) + '.' + img_extension;
                        
                        zip.file( image_filename, image_result.arraybuffer, {
                            date : zipdate
                        } );
                        
                        delete image_result.arraybuffer;
                    }
                    else if ( zip_request && Number.isFinite( image_result.size ) ) {
                        log_debug( image_info.image_url, '=>', image_result.size, 'byte' );
                    }
                    else {
                        log_error( image_info.image_url, '=> [bug] unknown error' );
                    }
                } );
                
                var zip_content_type = 'blob',
                    url_scheme = 'blob',
                    zip_filename = [ screen_name, tweet_id, timestamp, media_prefix ].join( '-' ) + '.zip';
                        
                
                if ( IS_FIREFOX ) {
                    zip_content_type =  'base64';
                    url_scheme = 'data';
                }
                
                if ( zip_request ) {
                    zip_request.generate( url_scheme, function ( response ) {
                        if ( ! zip_request ) {
                            log_error( 'zip_request.generate(): zip_request was already removed'  );
                            
                            download_error();
                            return;
                        }
                        zip_request.close();
                        zip_request = null;
                        
                        if ( response.error ) {
                            log_error( 'zip_request.generate()', response.error );
                            
                            download_error();
                            return;
                        }
                        download_url( zip_filename, response.zip_url );
                        
                        download_completed();
                    } );
                }
                else if ( zip ) {
                    zip.generateAsync( { type : zip_content_type } )
                    .then( function ( zip_content ) {
                        // TODO: ZIP を保存しようとすると、Firefox でセキュリティ警告が出る場合がある（「このファイルを開くのは危険です」(This file is not commonly downloaded.)）
                        // → Firefox のみ、Blob URL ではなく、Data URL(Base64) で様子見
                        if ( zip_content_type == 'base64' ) {
                            download_base64( zip_filename, zip_content );
                        }
                        else {
                            download_blob( zip_filename, zip_content );
                        }
                        
                        download_completed();
                    } )
                    .catch( function ( error ) {
                        log_error( 'zip.generateAsync()', error );
                        
                        download_error();
                    } );
                }
                else {
                    log_error( 'zip / zip_request was already removed' );
                }
            } // end of set_result()
            
            
            function load_image( image_index, first_image_url, current_image_url ) {
                if ( ! current_image_url ) {
                    current_image_url = first_image_url;
                }
                
                var extension_list = [ 'png', 'jpg', 'gif' ],
                    next_extension_map = {
                        'png' : 'gif'
                    ,   'gif' : 'jpg'
                    ,   'jpg' : 'png'
                    },
                    first_extension = get_img_extension( first_image_url, extension_list ),
                    current_extension = get_img_extension( current_image_url, extension_list ),
                    image_filename = [ screen_name, tweet_id, timestamp, media_prefix + ( image_index + 1 ) ].join( '-' ) + '.' + current_extension;
                
                image_info_list[ image_index ].image_url = current_image_url;
                
                if ( zip_request ) {
                    zip_request.file( {
                        url : current_image_url,
                        filename : image_filename,
                        zip_options : {
                            date : zipdate
                        }
                    }, function ( response ) {
                        if ( response.error ) {
                            // 元の拡張子が png でも、png:orig が取得できない場合がある
                            // → gif:orig なら取得できるケース有り・ステータスチェックし、エラー時にはリトライする
                            var next_extension = next_extension_map[ current_extension ];
                            
                            if ( ( ! next_extension ) || ( next_extension == first_extension ) ) {
                                image_info_list[ image_index ].image_url = first_image_url;
                                set_result( image_index, response );
                                return;
                            }
                            load_image( image_index, first_image_url, current_image_url.replace( '.' + current_extension, '.' + next_extension ) );
                            return;
                        }
                        set_result( image_index, response );
                    } );
                }
                else {
                    fetch_url( current_image_url, {
                        responseType : 'arraybuffer'
                    ,   onload : function ( response ) {
                            if ( response.status < 200 || 300 <= response.status ) {
                                // 元の拡張子が png でも、png:orig が取得できない場合がある
                                // → gif:orig なら取得できるケース有り・ステータスチェックし、エラー時にはリトライする
                                var next_extension = next_extension_map[ current_extension ];
                                
                                if ( ( ! next_extension ) || ( next_extension == first_extension ) ) {
                                    image_info_list[ image_index ].image_url = first_image_url;
                                    set_result( image_index, {
                                        error : response.status + ' ' + response.statusText
                                    } );
                                    return;
                                }
                                load_image( image_index, first_image_url, current_image_url.replace( '.' + current_extension, '.' + next_extension ) );
                                return;
                            }
                            set_result( image_index, {
                                arraybuffer : response.response
                            } );
                        } // end of onload()
                    ,   onerror : function ( response ) {
                            set_result( image_index, {
                                error : response.status + ' ' + response.statusText
                            } );
                        } // end of onerror()
                    } );
                }
            } // end of load_image()
            
            
            jq_images.each( function ( image_index ) {
                var jq_image = $( this ),
                    image_url = get_img_url_orig( jq_image.attr( 'src' ) ),
                    image_info = {
                        image_url : image_url,
                        result : {}
                    };
                
                image_info_list.push( image_info );
                
                load_image( image_index, image_url );
            } );
        };
    } )(); // end of image_download_handler()
    
    
    function activate_video_download_link( video_url, media_prefix ) {
        var screen_name = jq_tweet.find( 'a.js-user-profile-link.js-action-profile:first' ).attr( 'href' ).replace( /^.*\//, '' ),
            timestamp_ms = jq_tweet.find( '*[data-time-ms]' ).attr( 'data-time-ms' ),
            timestamp = ( timestamp_ms ) ? format_date( new Date( parseInt( timestamp_ms, 10 ) ), 'YYYYMMDD_hhmmss' ) : '',
            filename = [ screen_name, tweet_id, timestamp, media_prefix + '1' ].join( '-' ) + '.' + get_video_extension( video_url ),
            clickable = true;
        
        jq_media_button
            .prop( 'data-video-url', video_url )
            .click( function ( event ) {
                event.stopPropagation();
                event.preventDefault();
                
                if ( is_open_image_mode( event ) ) {
                    w.open( video_url );
                    return;
                }
                
                if ( ! clickable ) {
                    return;
                }
                clickable = false;
                jq_media_button.css( 'cursor', 'progress' );
                
                fetch_url( video_url, {
                    responseType : 'blob'
                ,   onload : function ( response ) {
                        download_blob( filename, response.response );
                    }
                ,   onerror : function ( response ) {
                        log_error( video_url, 'fetch failure' );
                    }
                ,   oncomplete : function ( response ) {
                        clickable = true;
                        jq_media_button.css( 'cursor', 'pointer' );
                    }
                } );
            } );
        
        jq_media_button_container.css( 'display', 'inline-block' );
    } // end of activate_video_download_link()
    
    
    if ( 0 < jq_images.length ) {
        if ( ! OPTIONS.IMAGE_DOWNLOAD_LINK ) {
            return;
        }
        
        jq_media_button
            .text( OPTIONS.IMAGE_DOWNLOAD_LINK_TEXT )
            .prop( 'data-tweet-url', jq_tweet.attr( 'data-permalink-path' ) )
            .click( function ( event ) {
                image_download_handler( event );
            } );
        
        jq_media_button_container.css( 'display', 'inline-block' );
    }
    else {
        if ( ( ! OPTIONS.VIDEO_DOWNLOAD_LINK ) || ( ! oauth2_access_token ) ) {
            return;
        }
        jq_media_button.text( OPTIONS.VIDEO_DOWNLOAD_LINK_TEXT );
        
        if ( jq_playable_media.hasClass( 'PlayableMedia--gif' ) || jq_playable_media.hasClass( 'PlayableMedia--vine' ) ) {
            var media_prefix = jq_playable_media.hasClass( 'PlayableMedia--gif' ) ? 'gif' : 'vid';
            
            jq_media_button.click( function ( event ) {
                jq_media_button.off( 'click' );
                
                event.stopPropagation();
                event.preventDefault();
                
                if ( OPTIONS.QUICK_LOAD_GIF && ( media_prefix == 'gif' ) ) {
                    try {
                        var video_url = get_gif_video_url_from_playable_media( jq_playable_media );
                        
                        activate_video_download_link( video_url, media_prefix );
                        
                        if ( is_open_image_mode( event ) ) {
                            w.open( video_url );
                        }
                        else {
                            jq_media_button.click();
                        }
                        return;
                    }
                    catch ( error ) {
                    }
                }
                
                var video_info_url = API_VIDEO_CONFIG_BASE.replace( '#TWEETID#', tweet_id );
                
                $.ajax( {
                    type : 'GET'
                ,   url : video_info_url
                ,   dataType : 'json'
                ,   headers : {
                        'Authorization' : 'Bearer ' + oauth2_access_token
                    }
                } )
                .done( function ( json ) {
                    var video_url = json.track.playbackUrl;
                    
                    if ( ! is_video_url( video_url ) ) {
                        jq_media_button_container.css( 'display', 'none' );
                        return;
                    }
                    activate_video_download_link( video_url, media_prefix );
                    
                    if ( is_open_image_mode( event ) ) {
                        w.open( video_url );
                    }
                    else {
                        jq_media_button.click();
                    }
                } )
                .fail( function ( jqXHR, textStatus, errorThrown ) {
                    log_error( video_info_url, textStatus, jqXHR.status + ' ' + jqXHR.statusText );
                    
                    jq_media_button_container.css( 'display', 'none' );
                } )
                .always( function () {
                } );
            } );
            
            jq_media_button_container.css( 'display', 'inline-block' );
        }
        else if ( jq_playable_media.hasClass( 'PlayableMedia--video' ) ) {
        
            jq_media_button.click( function ( event ) {
                jq_media_button.off( 'click' );
                
                event.stopPropagation();
                event.preventDefault();
                
                var tweet_info_url = API_TWEET_SHOW_BASE.replace( '#TWEETID#', tweet_id );
                
                $.ajax( {
                    type : 'GET'
                ,   url : tweet_info_url
                ,   dataType : 'json'
                ,   headers : {
                        'Authorization' : 'Bearer ' + oauth2_access_token
                    }
                } )
                .done( function ( json ) {
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
                        log_error( tweet_info_url, error );
                        // TODO: 外部動画等は未サポート
                    }
                    
                    if ( ! video_url ) {
                        jq_media_button_container.css( 'display', 'none' );
                        return;
                    }
                    activate_video_download_link( video_url, 'vid' );
                    
                    if ( is_open_image_mode( event ) ) {
                        w.open( video_url );
                    }
                    else {
                        jq_media_button.click();
                    }
                } )
                .fail( function ( jqXHR, textStatus, errorThrown ) {
                    log_error( tweet_info_url, textStatus, jqXHR.status + ' ' + jqXHR.statusText );
                } )
                .always( function () {
                } );
            } );
            
            jq_media_button_container.css( 'display', 'inline-block' );
        }
    }
    
    var jq_action_more = jq_action_list.find( '.ProfileTweet-action--more' );
    
    if ( 0 < jq_action_more.length ) {
        // 操作性のため、「その他」メニュー("float:right;"指定)よりも左側に挿入
        jq_action_more.before( jq_media_button_container );
    }
    else {
        jq_action_list.append( jq_media_button_container );
    }
    
} // end of add_media_button_to_tweet()


function check_media_tweets( node ) {
    if ( ( ! node ) || ( node.nodeType != 1 ) ) {
        return false;
    }
    
    var jq_node = $( node ),
        tweet_class_names = [ 'js-stream-tweet', 'tweet', 'js-tweet' ],
        tweet_selector = $.map( tweet_class_names, function ( class_name ) {
            return 'div.' + class_name;
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
        
        add_media_button_to_tweet( jq_tweet );
    } );
    
    return ( 0 < jq_tweets.length );
} // end of check_media_tweets()


function insert_download_buttons() {
    check_timeline_headers( d.body );
} // end of insert_download_buttons()


function insert_media_buttons() {
    if ( ( ! OPTIONS.IMAGE_DOWNLOAD_LINK ) && ( ! OPTIONS.VIDEO_DOWNLOAD_LINK ) ) {
        return;
    }
    check_media_tweets( d.body );
} // end of insert_media_buttons()


function start_mutation_observer() {
    new MutationObserver( function ( records ) {
        var is_search_timeline = judge_search_timeline();
        
        records.forEach( function ( record ) {
            var target = record.target;
                            
            to_array( record.addedNodes ).forEach( function ( addedNode ) {
                if ( addedNode.nodeType != 1 ) {
                    return;
                }
                
                if ( OPTIONS.IMAGE_DOWNLOAD_LINK || OPTIONS.VIDEO_DOWNLOAD_LINK ) {
                    check_media_tweets( addedNode );
                }
                
                check_timeline_headers( addedNode );
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
    
    if ( ( get_value( SCRIPT_NAME + '_limit_tweet_number' ) !== null ) && ( ! isNaN( get_value( SCRIPT_NAME + '_limit_tweet_number' ) ) ) ) {
        limit_tweet_number = parseInt( get_value( SCRIPT_NAME + '_limit_tweet_number' ), 10 );
    }
    else {
        limit_tweet_number = OPTIONS.DEFAULT_LIMIT_TWEET_NUMBER;
        set_value( SCRIPT_NAME + '_limit_tweet_number',  String( limit_tweet_number ) );
    }
    
    if ( get_value( SCRIPT_NAME + '_support_image' ) !== null ) {
        support_image = ( get_value( SCRIPT_NAME + '_support_image' ) !== '0' );
    }
    else {
        support_image = OPTIONS.DEFAULT_SUPPORT_IMAGE;
        set_value( SCRIPT_NAME + '_support_image', ( support_image ) ? '1' : '0' );
    }
    
    if ( get_value( SCRIPT_NAME + '_support_gif' ) !== null ) {
        support_gif = ( get_value( SCRIPT_NAME + '_support_gif' ) !== '0' );
    }
    else {
        support_gif = OPTIONS.DEFAULT_SUPPORT_GIF;
        set_value( SCRIPT_NAME + '_support_gif', ( support_gif ) ? '1' : '0' );
    }
    
    if ( get_value( SCRIPT_NAME + '_support_video' ) !== null ) {
        support_video = ( get_value( SCRIPT_NAME + '_support_video' ) !== '0' );
    }
    else {
        support_video = OPTIONS.DEFAULT_SUPPORT_VIDEO;
        set_value( SCRIPT_NAME + '_support_video', ( support_video ) ? '1' : '0' );
    }
    
    if ( get_value( SCRIPT_NAME + '_include_retweets' ) !== null ) {
        include_retweets = ( get_value( SCRIPT_NAME + '_include_retweets' ) !== '0' );
    }
    else {
        include_retweets = OPTIONS.DEFAULT_INCLUDE_RETWEETS;
        set_value( SCRIPT_NAME + '_include_retweets', ( include_retweets ) ? '1' : '0' );
    }
    
    if ( get_value( SCRIPT_NAME + '_dry_run' ) !== null ) {
        dry_run = ( get_value( SCRIPT_NAME + '_dry_run' ) !== '0' );
    }
    else {
        dry_run = OPTIONS.DEFAULT_DRY_RUN;
        set_value( SCRIPT_NAME + '_dry_run', ( dry_run ) ? '1' : '0' );
    }
    
    
    function insert_css( css_rule_text ) {
        var parent = d.querySelector( 'head' ) || d.body || d.documentElement,
            css_style = d.createElement( 'style' ),
            css_rule = d.createTextNode( css_rule_text );
        
        css_style.type = 'text/css';
        css_style.className = SCRIPT_NAME + '-css-rule';
        
        if ( css_style.styleSheet ) {
            css_style.styleSheet.cssText = css_rule.nodeValue;
        }
        else {
            css_style.appendChild( css_rule );
        }
        
        parent.appendChild( css_style );
    } // end of insert_css()
    
    
    function set_user_css() {
        var dialog_container_selector = '#' + SCRIPT_NAME + '_container',
            night_mode_dialog_container_selector = dialog_container_selector + '.night_mode',
            dialog_selector = '.' + SCRIPT_NAME + '_dialog',
            
            toolbox_selector = dialog_selector + ' .' + SCRIPT_NAME + '_toolbox',
            range_container_selector = toolbox_selector + ' .range_container',
            checkbox_container_selector = toolbox_selector + ' .' + SCRIPT_NAME + '_checkbox_container',
            button_container_selector = toolbox_selector + ' .' + SCRIPT_NAME + '_button_container',
            
            status_container_selector = dialog_selector + ' .' + SCRIPT_NAME + '_status',
            log_selector = status_container_selector + ' .' + SCRIPT_NAME + '_log',
            log_mask_selector = status_container_selector + ' .' + SCRIPT_NAME + '_log_mask',
            
            css_rule_lines = [
                dialog_container_selector + ' {background: rgba( 0, 0, 0, 0.8 );}'
            ,   dialog_container_selector + ' ' + dialog_selector + ' {background: white;}'
            
            ,   dialog_container_selector + ' ' + toolbox_selector + ' {background: lightblue;}'
            ,   dialog_container_selector + ' ' + range_container_selector + ' h3 {color: #66757f;}'
            ,   dialog_container_selector + ' ' + range_container_selector + ' table {color: #14171a;}'
            ,   dialog_container_selector + ' ' + range_container_selector + ' input.tweet_id {color: #14171a; background: white; border-color: #e6ecf0;}'
            ,   dialog_container_selector + ' ' + range_container_selector + ' input.tweet_number {color: #14171a; background: white; border-color: #e6ecf0;}'
            ,   dialog_container_selector + ' ' + checkbox_container_selector + ' label {color: #14171a;}'
            ,   dialog_container_selector + ' ' + button_container_selector + ' label {color: #14171a;}'
            
            ,   dialog_container_selector + ' ' + status_container_selector + ' {background: #f8f8ff;}'
            ,   dialog_container_selector + ' ' + log_selector + ' {color: #14171a; background: snow; border: inset #f8f8ff 1px;}'
            ,   dialog_container_selector + ' ' + log_mask_selector + ' {background: rgba( 0, 0, 0, 0.8 )}'
            ,   dialog_container_selector + ' ' + log_selector + ' .log-item {text-shadow: 1px 1px 1px #ccc;}'
            ,   dialog_container_selector + ' ' + log_selector + ' .log-item a {text-shadow: none;}'
            ,   dialog_container_selector + ' ' + log_selector + ' .log-item a.tweet-link {color: brown;}'
            ,   dialog_container_selector + ' ' + log_selector + ' .log-item a.media-link {color: navy;}'
            
            ,   night_mode_dialog_container_selector + ' {background: rgba( 0, 0, 0, 0.8 );}'
            ,   night_mode_dialog_container_selector + ' ' + dialog_selector + ' {background: #141d26;}'
            
            ,   night_mode_dialog_container_selector + ' ' + toolbox_selector + ' {background: #1b2836;}'
            ,   night_mode_dialog_container_selector + ' ' + range_container_selector + ' h3 {color: #8899a6;}'
            ,   night_mode_dialog_container_selector + ' ' + range_container_selector + ' table {color: #8899a6;}'
            ,   night_mode_dialog_container_selector + ' ' + range_container_selector + ' input.tweet_id {color: #8899a6; background: #182430; border-color: #1B5881;}'
            ,   night_mode_dialog_container_selector + ' ' + range_container_selector + ' input.tweet_number {color: #8899a6; background: #182430; border-color: #1B5881;}'
            ,   night_mode_dialog_container_selector + ' ' + checkbox_container_selector + ' label {color: #8899a6;}'
            ,   night_mode_dialog_container_selector + ' ' + button_container_selector + ' label {color: #8899a6;}'
            
            ,   night_mode_dialog_container_selector + ' ' + status_container_selector + ' {background: #182430;}'
            ,   night_mode_dialog_container_selector + ' ' + log_selector + ' {color: white; background: #1b2836; border: inset #182430 1px;}'
            ,   night_mode_dialog_container_selector + ' ' + log_mask_selector + ' {background: rgba( 0, 0, 0, 0.8 )}'
            ,   night_mode_dialog_container_selector + ' ' + log_selector + ' .log-item {text-shadow: 1px 1px 1px #ccc;}'
            ,   night_mode_dialog_container_selector + ' ' + log_selector + ' .log-item a {text-shadow: none;}'
            ,   night_mode_dialog_container_selector + ' ' + log_selector + ' .log-item a.tweet-link {color: #bc8f8f;}'
            ,   night_mode_dialog_container_selector + ' ' + log_selector + ' .log-item a.media-link {color: #add8e6;}'
            ];
        
        $( 'style.' + SCRIPT_NAME + '-css-rule' ).remove();
        
        insert_css( css_rule_lines.join( '\n' ) );
    
    } // end of set_user_css()
    
    
    function start_main() {
        set_user_css();
        insert_download_buttons();
        insert_media_buttons();
        start_mutation_observer();
    } // end of start_main()
    
    
    function get_access_token() {
        oauth2_access_token = null;
        set_value( SCRIPT_NAME + '_oauth2_access_token', '' );
        
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
        .done( function ( json ) {
            oauth2_access_token = json.access_token;
            if ( OPTIONS.CACHE_OAUTH2_ACCESS_TOKEN ) {
                set_value( SCRIPT_NAME + '_oauth2_access_token', oauth2_access_token );
            }
        } )
        .fail( function ( jqXHR, textStatus, errorThrown ) {
            log_error( OAUTH2_TOKEN_API_URL, textStatus, jqXHR.status + ' ' + jqXHR.statusText );
            // TODO: Cookies 中に auth_token が含まれていると、403 (code:99)が返ってきてしまう
            // → auth_token は Twitter ログイン中保持されるため、Cookies を送らないようにする対策が取れない場合、対応は困難
            oauth2_access_token = null;
            set_value( SCRIPT_NAME + '_oauth2_access_token', '' );
            support_image = true;
            support_gif = false;
            support_video = false;
        } )
        .always( function () {
            start_main();
        } );
    } // end of get_access_token()
    
    
    oauth2_access_token = ( OPTIONS.CACHE_OAUTH2_ACCESS_TOKEN ) ? get_value( SCRIPT_NAME + '_oauth2_access_token' ) : null;
    
    if ( oauth2_access_token ) {
        $.ajax( {
            type : 'GET'
        ,   url : API_RATE_LIMIT_STATUS
        ,   data : {
                'resources' : 'statuses'
            }
        ,   dataType : 'json'
        ,   headers : {
                'Authorization' : 'Bearer ' + oauth2_access_token
            }
        } )
        .done( function ( json ) {
            if ( ( ! json ) || ( ! json.rate_limit_context ) || ( ! json.resources ) || ( ! json.resources.statuses ) ) {
                get_access_token();
                return;
            }
            start_main();
        } )
        .fail( function ( jqXHR, textStatus, errorThrown ) {
            log_debug( API_RATE_LIMIT_STATUS, textStatus, jqXHR.status + ' ' + jqXHR.statusText );
            get_access_token();
        } )
        .always( function () {
        } );
    }
    else {
        get_access_token();
    }

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
