// ==UserScript==
// @name            Twitter Media Downloader for new Twitter.com 2019
// @description     Download media files on new Twitter.com 2019.
// @version         0.1.4.7
// @namespace       https://memo.furyutei.work/
// @author          furyu
// @include         https://twitter.com/*
// @include         https://api.twitter.com/*
// @include         https://nazo.furyutei.work/oauth/*
// @grant           GM_xmlhttpRequest
// @grant           GM_setValue
// @grant           GM_getValue
// @grant           GM_deleteValue
// @connect         twitter.com
// @connect         twimg.com
// @connect         cdn.vine.co
// @require         https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require         https://cdnjs.cloudflare.com/ajax/libs/jszip/3.1.4/jszip.min.js
// @require         https://cdnjs.cloudflare.com/ajax/libs/decimal.js/7.3.0/decimal.min.js
// @require         https://furyutei.github.io/twMediaDownloader/src/js/twitter-oauth/sha1.js
// @require         https://furyutei.github.io/twMediaDownloader/src/js/twitter-oauth/oauth.js
// @require         https://furyutei.github.io/twMediaDownloader/src/js/twitter-oauth/twitter-api.js
// @require         https://furyutei.github.io/twMediaDownloader/src/js/timeline.js
// ==/UserScript==

/*
■ 外部ライブラリ
- [jQuery](https://jquery.com/), [jquery/jquery: jQuery JavaScript Library](https://github.com/jquery/jquery)  
    [License | jQuery Foundation](https://jquery.org/license/)  
    The MIT License  

- [JSZip](https://stuk.github.io/jszip/)  
    Copyright (c) 2009-2014 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso  
    The MIT License  
    [jszip/LICENSE.markdown](https://github.com/Stuk/jszip/blob/master/LICENSE.markdown)  

- [MikeMcl/decimal.js: An arbitrary-precision Decimal type for JavaScript](https://github.com/MikeMcl/decimal.js)  
    Copyright (c) 2016, 2017 Michael Mclaughlin  
    The MIT Licence  
    [decimal.js/LICENCE.md](https://github.com/MikeMcl/decimal.js/blob/master/LICENCE.md)  

- [sha1.js](http://pajhome.org.uk/crypt/md5/sha1.html)  
    Copyright Paul Johnston 2000 - 2009
    The BSD License

- [oauth.js](http://code.google.com/p/oauth/source/browse/code/javascript/oauth.js)(^1)  
    Copyright 2008 Netflix, Inc.
    [The Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0)  
    (^1) archived: [oauth.js](https://web.archive.org/web/20130921042751/http://code.google.com/p/oauth/source/browse/code/javascript/oauth.js)  


■ 関連記事など
- [Twitter メディアダウンローダ：ユーザータイムラインの原寸画像や動画をまとめてダウンロードするユーザースクリプト(PC用Google Chrome・Firefox等対応) - 風柳メモ](http://furyu.hatenablog.com/entry/20160723/1469282864)  

- [furyutei/twMediaDownloader: Download images of user's media-timeline on Twitter.](https://github.com/furyutei/twMediaDownloader)  

- [lambtron/chrome-extension-twitter-oauth-example: Chrome Extension Twitter Oauth Example](https://github.com/lambtron/chrome-extension-twitter-oauth-example)  
    Copyright (c) 2017 Andy Jiang  
    The MIT Licence  
    [chrome-extension-twitter-oauth-example/LICENSE](https://github.com/lambtron/chrome-extension-twitter-oauth-example/blob/master/LICENSE)  
*/

/*
The MIT License (MIT)

Copyright (c) 2020 furyu <furyutei@gmail.com>

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
    // ※検索タイムライン使用時、filter: をかけない場合にヒットする画像や動画が、filter: をかけるとヒットしないことがある
,   DOWNLOAD_SIZE_LIMIT_MB : 500 // ダウンロード時のサイズ制限(MB)
,   ENABLE_VIDEO_DOWNLOAD : true // true: 動画ダウンロードを有効にする（ユーザー認証が必要）
    
,   OPERATION : true // true: 動作中、false: 停止中

,   QUICK_LOAD_GIF : true // true: アニメーションGIF（から変換された動画）の情報(URL)取得を簡略化

,   DEFAULT_LIMIT_TWEET_NUMBER : 1000 // ダウンロードできる画像付きツイート数制限のデフォルト値
,   DEFAULT_SUPPORT_IMAGE : true // true: 画像をダウンロード対象にする
,   DEFAULT_SUPPORT_GIF : true // true: アニメーションGIF（から変換された動画）をダウンロード対象にする
,   DEFAULT_SUPPORT_VIDEO : true // true: 動画をダウンロード対象にする
,   DEFAULT_INCLUDE_RETWEETS : false // true: RTを含む
,   DEFAULT_SUPPORT_NOMEDIA : false // false: メディアを含まないツイートもログ・CSVやCSVに記録する
,   DEFAULT_DRY_RUN : false // true: 走査のみ

,   ENABLE_ZIPREQUEST : true // true: ZipRequest を使用してバックグラウンドでダウンロード＆アーカイブ(拡張機能の場合)
,   INCOGNITO_MODE : false // true: 秘匿モード（シークレットウィンドウ内で起動・拡張機能の場合のみ）
    // TODO: Firefox でシークレットウィンドウ内で実行する場合、ENABLE_ZIPREQUEST が true だと zip_request.generate() で失敗
    // → 暫定的に、判別して ZipRequest を使用しないようにする

,   TWITTER_OAUTH_POPUP : true // true: OAuth 認証時、ポップアップウィンドウを使用 / false: 同、別タブを使用

,   TWITTER_API_DELAY_TIME_MS : 1100 // Twitter API コール時、前回からの最小間隔(ms)
    // Twitter API には Rate Limit があるため、続けてコールする際に待ち時間を挟む
    // /statuses/show.json の場合、15分で900回（正確に 900回／15分というわけではなく、15分毎にリセットされる）→1秒以上は空けておく
    // TODO: 別のタブで並列して実行されている場合や、別ブラウザでの実行は考慮していない

,   TWITTER_API2_DELAY_TIME_MS : 5100 // Twitter API2 コール時、前回からの最小間隔(ms)
    // ※ api.twitter.com/2/timeline/conversation/:id の場合、15分で180回
    // TODO: 別のタブで並列して実行されている場合や、別ブラウザでの実行は考慮していない
};

// }


// ■ 共通変数 {
var SCRIPT_NAME = 'twMediaDownloader',
    IS_CHROME_EXTENSION = !! ( w.is_chrome_extension ),
    OAUTH_POPUP_WINDOW_NAME = SCRIPT_NAME + '-OAuthAuthorization',
    DEBUG = false,
    self = undefined;

if ( ! /^https:\/\/twitter\.com(?!\/account\/login_verification)/.test( w.location.href ) ) {
    if ( ( ! IS_CHROME_EXTENSION ) && ( typeof Twitter != 'undefined' ) ) {
        // Twitter OAuth 認証用ポップアップとして起動した場合は、Twitter.initialize() により tokens 取得用処理を実施（内部でTwitter.initializePopupWindow()を呼び出し）
        // ※ユーザースクリプトでの処理（拡張機能の場合、session.jsにて実施）
        Twitter.initialize( {
            popup_window_name : OAUTH_POPUP_WINDOW_NAME
        } );
    }
    return;
}

if ( /^https:\/\/twitter\.com\/i\/cards/.test( w.location.href ) ) {
    // https://twitter.com/i/cards/～ では実行しない
    return;
}


if ( ! d.querySelector( 'div#react-root' ) ) {
    return;
}

[ 'jQuery', 'JSZip', 'ZipRquest', 'Decimal', 'TwitterTimeline' ].map( ( library_name ) => {
    if ( typeof window[ library_name ] ) {
        return;
    }
    
    const
        message = SCRIPT_NAME + '(' + location.href + '): Library not found - ' +  library_name;
    
    if ( w === w.top ) {
        console.error( message );
    }
    throw new Error( message );
} );

var $ = jQuery,
    IS_TOUCHED = ( function () {
        var touched_id = SCRIPT_NAME + '_touched',
            jq_touched = $( '#' + touched_id );
        
        if ( 0 < jq_touched.length ) {
            return true;
        }
        
        $( '<b>' ).attr( 'id', touched_id ).css( 'display', 'none' ).appendTo( $( d.documentElement ) );
        
        return false;
    } )();

if ( IS_TOUCHED ) {
    console.error( SCRIPT_NAME + ': Already loaded.' );
    return;
}


if ( ( w.name == OAUTH_POPUP_WINDOW_NAME ) && ( /^\/(?:home\/?)?$/.test( new URL( location.href ).pathname ) ) ) {
    // OAuth 認証の前段階でポップアップブロック対策用ダミーとして起動した home 画面については表示を消す
    d.body.style.display = 'none';
    return;
}


var LANGUAGE = ( function () {
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
    
    USERAGENT =  w.navigator.userAgent.toLowerCase(),
    PLATFORM = w.navigator.platform.toLowerCase(),
    IS_FIREFOX = ( window.IS_FIREFOX ) || ( 0 <= USERAGENT.indexOf( 'firefox' ) ),
        // TODO: GoodTwitter等を併用していると、User-Agent では判別できなくなる（"Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; AS; rv:11.0) Waterfox/56.2"のようになる）
        // → browser が定義されているかで判別(browser_info.js)
    IS_MAC = ( 0 <= PLATFORM.indexOf( 'mac' ) ),
    
    //BASE64_BLOB_THRESHOLD = 30000000, // Data URL(base64) → Blob URL 切替の閾値(Byte) (Firefox用)(TODO: 値は要調整)
    BASE64_BLOB_THRESHOLD = 0, // Data URL(base64) → Blob URL 切替の閾値(Byte) (Firefox用)(TODO: 値は要調整)
    // TODO: Firefox の場合、Blob URL だと警告が出る場合がある・その一方、Data URL 形式だと大きいサイズはダウンロード不可
    // → Data URL 形式だとかなり重く、動作が不安定になるため、全て Blob URL に
    //   ※警告を出さないためには、「≡」→「オプション」→「プライバシーとセキュリティ」（about:preferences#privacy）にて、
    //     「セキュリティ」→「詐欺コンテンツと危険なソフトウェアからの防護」にある、
    //     「☑不要な危険ソフトウェアを警告する(C)」のチェックを外す
    
    //{ "timeline.js" より
    TwitterTimeline = ( ( TwitterTimeline ) => {
        TwitterTimeline.debug_mode = DEBUG;
        TwitterTimeline.logged_script_name = SCRIPT_NAME;
        
        return TwitterTimeline;
    } )( window.TwitterTimeline ),
    
    TIMELINE_TYPE = TwitterTimeline.TIMELINE_TYPE,
    TIMELINE_STATUS = TwitterTimeline.TIMELINE_STATUS,
    REACTION_TYPE = TwitterTimeline.REACTION_TYPE,
    MEDIA_TYPE = TwitterTimeline.MEDIA_TYPE,
    CLASS_TIMELINE_SET = TwitterTimeline.CLASS_TIMELINE_SET,
    //}
    
    API_RATE_LIMIT_STATUS = 'https://api.twitter.com/1.1/application/rate_limit_status.json',
    API_VIDEO_CONFIG_BASE = 'https://api.twitter.com/1.1/videos/tweet/config/#TWEETID#.json',
    API_TWEET_SHOW_BASE = 'https://api.twitter.com/1.1/statuses/show.json?include_profile_interstitial_type=1&include_blocking=1&include_blocked_by=1&include_followed_by=1&include_want_retweets=1&skip_status=1&cards_platform=Web-12&include_cards=1&include_ext_alt_text=true&include_reply_count=1&tweet_mode=extended&trim_user=false&include_ext_media_color=true&id=#TWEETID#',
    GIF_VIDEO_URL_BASE = 'https://video.twimg.com/tweet_video/#VIDEO_ID#.mp4',
    
    LOADING_IMAGE_URL = 'https://abs.twimg.com/a/1460504487/img/t1/spinner-rosetta-gray-32x32.gif',
    
    TEMPORARY_PAGE_URL = ( () => {
        // ポップアップブロック対策に一時的に読み込むページのURLを取得
        // ※なるべく軽いページが望ましい
        // ※非同期で設定しているが、ユーザーがアクションを起こすまでには読み込まれているだろうことを期待
        var test_url = new URL( '/favicon.ico?_temporary_page=true', d.baseURI ).href;
        
        fetch( test_url ).then( ( response ) => {
            TEMPORARY_PAGE_URL = test_url;
        } );
        return null;
    } )(),
    
    limit_tweet_number = OPTIONS.DEFAULT_LIMIT_TWEET_NUMBER,
    support_image = false,
    support_gif = false,
    support_video = false,
    include_retweets = false,  // true: ユーザータイムライン上の RT のメディアも対象とする
    support_nomedia = false,
    dry_run = false; // true: 走査のみ


switch ( LANGUAGE ) {
    case 'ja' :
        OPTIONS.DOWNLOAD_BUTTON_TEXT = '⇩';
        OPTIONS.DOWNLOAD_BUTTON_TEXT_LONG = 'メディア ⇩';
        OPTIONS.DOWNLOAD_BUTTON_HELP_TEXT = 'タイムラインの画像/動画を保存';
        OPTIONS.DIALOG_TWEET_ID_RANGE_HEADER = '対象 Tweet ID 範囲 (空欄時は制限なし)';
        OPTIONS.DIALOG_TWEET_ID_RANGE_MARK = '＜ ID ＜';
        OPTIONS.DIALOG_TWEET_ID_PLACEHOLDER_LEFT = '下限IDまたは日時';
        OPTIONS.DIALOG_TWEET_ID_PLACEHOLDER_RIGHT = '上限IDまたは日時';
        OPTIONS.DIALOG_LIMIT_TWEET_NUMBER_TEXT = '制限数';
        OPTIONS.DIALOG_BUTTON_START_TEXT = '開始';
        OPTIONS.DIALOG_BUTTON_STOP_TEXT = '停止';
        OPTIONS.DIALOG_BUTTON_CLOSE_TEXT = '閉じる';
        OPTIONS.CHECKBOX_IMAGE_TEXT = '画像';
        OPTIONS.CHECKBOX_GIF_TEXT = '動画(GIF)';
        OPTIONS.CHECKBOX_VIDEO_TEXT = '動画';
        OPTIONS.CHECKBOX_NOMEDIA_TEXT = 'メディア無し';
        OPTIONS.CHECKBOX_INCLUDE_RETWEETS = 'RTを含む';
        OPTIONS.CHECKBOX_DRY_RUN = '走査のみ';
        OPTIONS.CHECKBOX_ALERT = '少なくとも一つのメディアタイプにはチェックを入れて下さい';
        OPTIONS.IMAGE_DOWNLOAD_LINK_TEXT = '画像⇩';
        OPTIONS.VIDEO_DOWNLOAD_LINK_TEXT = 'MP4⇩';
        OPTIONS.DOWNLOAD_MEDIA_TITLE = 'ダウンロード';
        OPTIONS.OPEN_MEDIA_LINK = 'メディアを開く';
        
        OPTIONS.LIKES_DOWNLOAD_BUTTON_TEXT_LONG = 'いいね ⇩';
        OPTIONS.LIKES_DOWNLOAD_BUTTON_HELP_TEXT = '『いいね』をしたツイートの画像/動画を保存';
        OPTIONS.LIKES_DIALOG_TWEET_ID_RANGE_HEADER = '対象『いいね』日時範囲 (空欄時は制限なし)';
        OPTIONS.LIKES_DIALOG_TWEET_ID_RANGE_MARK = '＜ 日時 ＜';
        OPTIONS.LIKES_DIALOG_TWEET_ID_PLACEHOLDER_LEFT = '下限日時';
        OPTIONS.LIKES_DIALOG_TWEET_ID_PLACEHOLDER_RIGHT = '上限日時';
        
        OPTIONS.MENTIONS_DOWNLOAD_BUTTON_TEXT_LONG = '@ツイート ⇩';
        OPTIONS.MENTIONS_DOWNLOAD_BUTTON_HELP_LONG = '通知(@ツイート)の画像/動画を保存';
        break;
    default:
        OPTIONS.DOWNLOAD_BUTTON_TEXT = '⇩';
        OPTIONS.DOWNLOAD_BUTTON_TEXT_LONG = 'Media ⇩';
        OPTIONS.DOWNLOAD_BUTTON_HELP_TEXT = 'Download images/videos from timeline';
        OPTIONS.DIALOG_TWEET_ID_RANGE_HEADER = 'Download Tweet ID range (There is no limit when left blank)';
        OPTIONS.DIALOG_TWEET_ID_RANGE_MARK = '< ID <';
        OPTIONS.DIALOG_TWEET_ID_PLACEHOLDER_LEFT = 'Since ID or datetime';
        OPTIONS.DIALOG_TWEET_ID_PLACEHOLDER_RIGHT = 'Until ID or datetime';
        OPTIONS.DIALOG_LIMIT_TWEET_NUMBER_TEXT = 'Limit';
        OPTIONS.DIALOG_BUTTON_START_TEXT = 'Start';
        OPTIONS.DIALOG_BUTTON_STOP_TEXT = 'Stop';
        OPTIONS.DIALOG_BUTTON_CLOSE_TEXT = 'Close';
        OPTIONS.CHECKBOX_IMAGE_TEXT = 'Images';
        OPTIONS.CHECKBOX_GIF_TEXT = 'Videos(GIF)';
        OPTIONS.CHECKBOX_VIDEO_TEXT = 'Videos';
        OPTIONS.CHECKBOX_NOMEDIA_TEXT = 'No media';
        OPTIONS.CHECKBOX_INCLUDE_RETWEETS = 'include RTs';
        OPTIONS.CHECKBOX_DRY_RUN = 'Dry run';
        OPTIONS.CHECKBOX_ALERT = 'Please check the checkbox of at least one media type !';
        OPTIONS.IMAGE_DOWNLOAD_LINK_TEXT = 'IMG⇩';
        OPTIONS.VIDEO_DOWNLOAD_LINK_TEXT = 'MP4⇩';
        OPTIONS.DOWNLOAD_MEDIA_TITLE = 'Download';
        OPTIONS.OPEN_MEDIA_LINK = 'Open media links';
        
        OPTIONS.LIKES_DOWNLOAD_BUTTON_TEXT_LONG = 'Likes ⇩';
        OPTIONS.LIKES_DOWNLOAD_BUTTON_HELP_TEXT = 'Download images/videos from Likes-timeline';
        OPTIONS.LIKES_DIALOG_TWEET_ID_RANGE_HEADER = 'Download "Likes" date-time range (There is no limit when left blank)';
        OPTIONS.LIKES_DIALOG_TWEET_ID_RANGE_MARK = '< DATETIME <';
        OPTIONS.LIKES_DIALOG_TWEET_ID_PLACEHOLDER_LEFT = 'Since datetime';
        OPTIONS.LIKES_DIALOG_TWEET_ID_PLACEHOLDER_RIGHT = 'Until datetime';
        
        OPTIONS.MENTIONS_DOWNLOAD_BUTTON_TEXT_LONG = 'Mentions ⇩';
        OPTIONS.MENTIONS_DOWNLOAD_BUTTON_HELP_LONG = 'Download images/videos of mentions from Notifications-timeline';
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


function log_info() {
    var arg_list = [ '[' + SCRIPT_NAME + ']', '(' + ( new Date().toISOString() ) + ')' ];
    
    console.info.apply( console, arg_list.concat( to_array( arguments ) ) );
} // end of log_info()


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
//   [62:22](41) timestamp: 現在の Unix Time(ms) から、1288834974657(ms) (2010/11/04 01:42:54 UTC) を引いたもの
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
    var video_url = jq_target.find( 'video[src*="video.twimg.com/tweet_video/"]' ).attr( 'src' );
    
    if ( video_url && video_url.match( /\.mp4/ ) ) {
        return video_url;
    }
    
    // 動画GIFの背景画像 URL から MP4 の URL を割り出す
    // background-image:url('https://pbs.twimg.com/tweet_video_thumb/#VIDEO_ID#.jpg') => https://video.twimg.com/tweet_video/#VIDEO_ID#.mp4
    return GIF_VIDEO_URL_BASE.replace( '#VIDEO_ID#', jq_target.find( '.PlayableMedia-player' ).attr( 'style' ).match( /tweet_video_thumb\/([^.?]+)[.?]/ )[ 1 ] );
} // end of get_gif_video_url_from_playable_media()


var get_logined_screen_name = ( () => {
    var logined_screen_name = '';
    
    return () => {
        if ( logined_screen_name ) {
            // 一度アカウントが確定するとアカウント切替でページが変わるまでそのままの想定
            return logined_screen_name;
        }
        
        var screen_name,
            $user_link;
        
        //$user_link = $( 'nav[role="navigation"] > a[role="link"]:has(img[src*="profile_images/"])' ); // 遅い→ :has() を未使用にすることで効果大
        $user_link = $( 'nav[role="navigation"] > a[role="link"]' ).filter( function () {return ( 0 < $( this ).find( 'img[src*="profile_images/"]' ).length );} );
        
        screen_name = ( $user_link.attr( 'href' ) || '' ).replace( /^.*\//g, '' );
        
        if ( screen_name ) {
            logined_screen_name = screen_name;
        }
        
        return screen_name;
    };
} )(); // end of get_logined_screen_name()


function get_screen_name( url ) {
    if ( ! url ) {
        url = w.location.href;
    }
    
    if ( ! url.trim().match( /^https?:\/\/[^\/]+\/([^\/?#]+)/ ) ) {
        return null;
    }
    
    var screen_name = RegExp.$1;
    
    switch ( screen_name ) {
        case 'search' :
        case 'mentions' :
        case 'i' :
        case 'notifications' :
        case 'messages' :
            return null;
    }
    
    if ( screen_name.length < 2 ) {
        // ログイン時に『いいね』タイムラインは https://twitter.com/i/likes になってしまう
        screen_name = $( 'h2.ProfileHeaderCard-screenname span.username b.u-linkComplex-target' ).text().trim();
    }
    
    return screen_name;
} // end of get_screen_name()


function get_profile_name() {
    //return $( 'div[data-testid="primaryColumn"] > div > div > div:first h2[role="heading"] > div[aria-haspopup="false"] span > span > span' ).text().trim();
    //return $( 'div[data-testid="primaryColumn"] > div > div > div:first h2[role="heading"] > div[aria-haspopup="false"] span > span > span' ).get().reduce( ( previousValue, currentValue ) => {
    return $( 'div[data-testid="primaryColumn"] > div > div > div:first h2[role="heading"] > div > div > div > span > span > span' ).get().reduce( ( previousValue, currentValue ) => {
        var jq_span = $( currentValue ),
            jq_span_img = jq_span.find( 'img' ),
            text = '';
        
        try {
            text = jq_span.text().trim() || ( ( 0 < jq_span_img.length ) ? jq_span_img.attr( 'alt' ).trim() : '' ); // 絵文字は text() では取れない→ img.alt から取得
        }
        catch ( error ) {
        }
        
        if ( ! text ) {
            text = ' ';
        }
        
        return previousValue + text;
    }, '' );
} // end of get_profile_name()


function get_tweet_id( url ) {
    if ( ! url ) {
        url = w.location.href;
    }
    
    url = url.trim();
    if ( /^\d+$/.test( url ) ) {
        return url;
    }
    
    url = url.trim();
    
    if ( url.match( /^https?:\/\/twitter\.com\/[^\/]+\/[^\/]+\/(\d+)(?:$|\/)/ ) ) {
        return RegExp.$1;
    }
    
    if ( url.match( /^\/[^\/]+\/status(?:es)?\/(\d+)(?:$|\/)/ ) ) {
        return RegExp.$1;
    }
    
    return null;
} // end of get_tweet_id()


function judge_profile_timeline( url ) {
    if ( ! url ) {
        url = w.location.href;
    }
    
    return ( !! get_screen_name( url ) ) && ( !! get_profile_name( url ) );
} // end of judge_profile_timeline()


function judge_search_timeline( url ) {
    if ( ! url ) {
        url = w.location.href;
    }
    return /^\/(?:search|hashtag)/.test( new URL( url ).pathname );
} // end of judge_search_timeline()


function judge_notifications_timeline( url ) {
    if ( ! url ) {
        url = w.location.href;
    }
    
    return /^\/(?:notifications)(?:\/mentions|$)/.test( new URL( url ).pathname );
} // end of judge_notifications_timeline()


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


var set_values = ( function () {
    if ( typeof async_set_values == 'function' ) {
        return function ( name_value_map, callback ) {
            async_set_values( name_value_map )
            .then( function () {
                if ( typeof callback == 'function' ) {
                    callback();
                }
            } );
        };
    }
    
    return function ( name_value_map, callback ) {
        Object.keys( name_value_map ).forEach( function ( name ) {
            set_value( name, name_value_map[ name ] );
        } );
        
        if ( typeof callback == 'function' ) {
            callback();
        }
    };
} )(); // end of set_values()


var get_values = ( function () {
    if ( typeof async_get_values == 'function' ) {
        return function ( name_list, callback ) {
            async_get_values( name_list )
            .then( function ( name_value_map ) {
                callback( name_value_map );
            } );
        };
    }
    
    return function ( name_list, callback ) {
        var name_value_map = {};
        
        name_list.forEach( function ( name ) {
            name_value_map[ name ] = get_value( name );
        } );
        callback( name_value_map );
    };
} )(); // end of get_values()


function is_night_mode() {
    return ( getComputedStyle( d.body ).backgroundColor != 'rgb(255, 255, 255)' );
} // end of is_night_mode()


var [
    update_twitter_api_info,
    twitter_api_is_enabled,
    initialize_twitter_api,
    twitter_api_get_json,
    api2_get_tweet_info,
] = ( () => {
    var OAUTH_CONSUMER_KEY = 'kyxX7ZLs2D3efqDbpK8Mqnpnr',
        OAUTH_CONSUMER_SECRET = 'D85tY89jQoWWVH8oNjIg28PJfK4S2louq5NPxw8VzvlKBwSR0x',
        OAUTH_CALLBACK_URL = 'https://nazo.furyutei.work/oauth/',
        
        API2_AUTHORIZATION_BEARER = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
        // ※ https://abs.twimg.com/responsive-web/web/main.<version>.js (例：https://abs.twimg.com/responsive-web/web/main.bd8d7749ae1a70054.js) 内で定義されている値
        // TODO: 継続して使えるかどうか不明→変更された場合の対応を要検討
        API2_CONVERSATION_BASE = 'https://api.twitter.com/2/timeline/conversation/#TWEETID#.json?include_profile_interstitial_type=1&include_blocking=1&include_blocked_by=1&include_followed_by=1&include_want_retweets=1&include_mute_edge=1&include_can_dm=1&include_can_media_tag=1&skip_status=1&cards_platform=Web-12&include_cards=1&include_composer_source=true&include_ext_alt_text=true&include_reply_count=1&tweet_mode=extended&include_entities=true&include_user_entities=true&include_ext_media_color=true&include_ext_media_availability=true&send_error_codes=true&count=20&ext=mediaStats%2ChighlightedLabel%2CcameraMoment',
        
        twitter_api_1st_call = true,
        
        twitter_api_info_map = {},
        
        get_csrf_token = () => {
            var csrf_token;
            
            try {
                csrf_token = document.cookie.match( /ct0=(.*?)(?:;|$)/ )[ 1 ];
            }
            catch ( error ) {
            }
            
            return csrf_token;
        }, // end of get_csrf_token()
        
        get_twitter_api = ( screen_name ) => {
            if ( ! screen_name ) {
                screen_name = get_logined_screen_name();
            }
            
            return ( twitter_api_info_map[ screen_name ] || {} ).api;
        }, // end of get_twitter_api()
        
        update_twitter_api_info = ( () => {
            var api2_is_checked = false,
                
                update_api2_info = () => {
                    if ( api2_is_checked ) {
                        return;
                    }
                    
                    api2_is_checked = true;
                    
                    // API2 (api.twitter.com/2/) が有効かどうかをツイート（https://twitter.com/jack/status/20）を読みこんで確認
                    var target_tweet_id = 20;
                    
                    api2_get_tweet_info( target_tweet_id )
                    .done( ( json, textStatus, jqXHR ) => {
                        log_info( 'API2 (api.twitter.com/2/) is available.' );
                    } )
                    .fail( ( jqXHR, textStatus, errorThrown ) => {
                        log_error( 'API2 (api.twitter.com/2/) is not available. (', jqXHR.statusText, ':', textStatus, ')' );
                        
                        get_csrf_token = () => false; // API2 無効化
                    } )
                    .always( () => {
                    } );
                };
            
            return ( screen_name ) => {
                update_api2_info();
                
                if ( typeof Twitter == 'undefined' ) {
                    return;
                }
                
                if ( ! screen_name ) {
                    screen_name = get_logined_screen_name();
                }
                
                if ( ( twitter_api_info_map[ screen_name ] || {} ).is_checked ) {
                    return;
                }
                
                var twitter_api_info = twitter_api_info_map[ screen_name ] = {
                        is_checked : true,
                        api : null,
                    };
                
                // OAuth 1.0a 用のキャッシュされたtokenが有効かを確認
                Twitter.initialize( {
                    consumer_key : OAUTH_CONSUMER_KEY,
                    consumer_secret : OAUTH_CONSUMER_SECRET,
                    screen_name : screen_name,
                    use_cache : true,
                    auto_reauth : false,
                } )
                .isAuthenticated()
                .done( ( api, result ) => {
                    twitter_api_info.api = api;
                    
                    var current_user = Twitter.getCurrentUser();
                    
                    log_info( 'Specified screen_name: "' + screen_name + '" => User authentication (OAuth 1.0a) is enabled. (screen_name:' + current_user.screen_name + ', user_id:' + current_user.user_id + ')' );
                } )
                .fail( ( result ) => {
                    log_info( 'Specified screen_name: "' + screen_name + '" => Invalid cached token (' + result + ')' );
                } )
                .always( function () {
                } );
            };
        } )(), // end of update_twitter_api_info()
        
        twitter_api_is_enabled = () => {
            return ( get_twitter_api() || get_csrf_token() );
        }, // end of twitter_api_is_enabled()
        
        initialize_twitter_api = () => {
            var jq_deferred = new $.Deferred(),
                jq_promise = jq_deferred.promise(),
                logined_screen_name = get_logined_screen_name(),
                
                finish = () => {
                    jq_deferred.resolve();
                };
            
            if ( ! twitter_api_1st_call ) {
                finish();
                return jq_promise;
            }
            
            twitter_api_1st_call = false;
            
            if ( typeof Twitter == 'undefined' ) {
                finish();
                return jq_promise;
            }
            
            if ( ( ! OPTIONS.ENABLE_VIDEO_DOWNLOAD ) || get_twitter_api( logined_screen_name ) ) {
                finish();
                return jq_promise;
            }
            
            // OAuth 1.0a 認証処理
            var popup_window_width = Math.floor( window.outerWidth * 0.8 ),
                popup_window_height = Math.floor( window.outerHeight * 0.5 ),
                popup_window_top = 0,
                popup_window_left = 0,
                
                popup_window_option = ( () => {
                    if ( ! OPTIONS.TWITTER_OAUTH_POPUP ) {
                        return null;
                    }
                    if ( popup_window_width < 1000 ) {
                        popup_window_width = 1000;
                    }
                    
                    if ( popup_window_height < 700 ) {
                        popup_window_height = 700;
                    }
                    
                    popup_window_top = Math.floor( window.screenY + ( window.outerHeight - popup_window_height ) / 8 );
                    popup_window_left = Math.floor( window.screenX + ( window.outerWidth - popup_window_width ) / 2 );
                    
                    return [
                        'width=' + popup_window_width,
                        'height=' + popup_window_height,
                        'top=' + popup_window_top,
                        'left=' + popup_window_left,
                        'toolbar=0,scrollbars=1,status=1,resizable=1,location=1,menuBar=0'
                    ];
                } )(),
                
                user_specified_window = window.open( ( TEMPORARY_PAGE_URL || new URL( '/home', d.baseURI ).href ), OAUTH_POPUP_WINDOW_NAME, popup_window_option ),
                // 非同期にウィンドウを開くと、ポップアップブロックが働いてしまうため、ユーザーアクションの直後に予めウィンドウを開いておく
                // ※ 第一引数(URL) を 'about:blank' にすると、Firefox では window.name が変更できない（『DOMException: "Permission denied to access property "name" on cross-origin object"』発生）
                
                wait_window_ready = ( callback ) => {
                    try {
                        user_specified_window.name = OAUTH_POPUP_WINDOW_NAME;
                        
                        log_debug( 'wait_window_ready(): OK' );
                        
                        callback();
                    }
                    catch ( error ) {
                        log_debug( 'wait_window_ready(): ', error );
                        
                        // Firefox の場合、開いた直後には window.name が変更できない場合がある→変更可能になるまで待つ
                        setTimeout( () => {
                            wait_window_ready( callback );
                        }, 100 );
                    }
                };
            
            wait_window_ready( () => {
                Twitter.initialize( {
                    consumer_key : OAUTH_CONSUMER_KEY,
                    consumer_secret : OAUTH_CONSUMER_SECRET,
                    callback_url : OAUTH_CALLBACK_URL,
                    screen_name : logined_screen_name,
                    popup_window_name : OAUTH_POPUP_WINDOW_NAME,
                    use_cache : false,
                    auto_reauth : false,
                    user_specified_window : user_specified_window
                } )
                .authenticate()
                .done( ( api ) => {
                    api( 'account/verify_credentials', 'GET' )
                    .done( ( result ) => {
                        twitter_api_info_map[ logined_screen_name ] = {
                            is_checked : true,
                            api : api,
                        };
                        
                        var current_user = Twitter.getCurrentUser();
                        
                        log_info( 'User authentication (OAuth 1.0a) is enabled. (screen_name:' + current_user.screen_name + ', user_id:' + current_user.user_id + ')' );
                        
                        finish();
                    } )
                    .fail( ( error ) => {
                        log_error( 'api( "account/verify_credentials" ) failure:', error );
                        
                        finish();
                    } );
                } )
                .fail( ( error ) => {
                    log_error( 'Twitter.authenticate() failure:', error );
                    
                    if ( ( ! /refused/i.test( error ) ) && confirm( 'Authorization failed. Retry ?' ) ) {
                        initialize_twitter_api()
                        .then( function () {
                            finish();
                        } );
                        return;
                    }
                    
                    finish();
                });
            } );
            
            return jq_promise;
        }, // end of initialize_twitter_api()
        
        twitter_api_delay = ( () => {
            var last_called_time_ms = new Date().getTime();
            
            return function ( min_wait_ms ) {
                if ( ! min_wait_ms ) {
                    min_wait_ms = OPTIONS.TWITTER_API2_DELAY_TIME_MS;
                }
                
                var jq_deferred = new $.Deferred(),
                    delay_time_ms = ( min_wait_ms ) ? ( last_called_time_ms + min_wait_ms - new Date().getTime() ) : 1;
                
                if ( delay_time_ms < 0 ) {
                    delay_time_ms = 1;
                }
                setTimeout( function () {
                    last_called_time_ms = new Date().getTime();
                    jq_deferred.resolve();
                }, delay_time_ms );
                
                return jq_deferred.promise();
            };
        } )(), // end of twitter_api_delay()
        
        api2_get_tweet_info = ( tweet_id ) => {
            var jq_deferred = new $.Deferred(),
                csrf_token = get_csrf_token(),
                api2_url = API2_CONVERSATION_BASE.replace( '#TWEETID#', tweet_id );
            
            if ( ! csrf_token ) {
                jq_deferred.reject( {
                    status : 0
                ,   statusText : 'Illegal condition'
                }, 'Invalid csrf token' );
                
                return jq_deferred.promise();
            }
            
            var api_headers = {
                    'Authorization' : 'Bearer ' + API2_AUTHORIZATION_BEARER
                ,   'x-csrf-token' : csrf_token
                ,   'x-twitter-active-user' : 'yes'
                ,   'x-twitter-auth-type' : 'OAuth2Session'
                ,   'x-twitter-client-language' : LANGUAGE
                };
            
            if (
                ( ! IS_CHROME_EXTENSION ) ||
                IS_FIREFOX
            ) {
                $.ajax( {
                    type : 'GET'
                ,   url : api2_url
                ,   headers : api_headers
                ,   dataType : 'json'
                ,   xhrFields : {
                        withCredentials : true
                    }
                } )
                .done( function ( json, textStatus, jqXHR ) {
                    log_debug( api2_url, json );
                    try {
                        jq_deferred.resolve( json.globalObjects.tweets[ tweet_id ] );
                    }
                    catch ( error ) {
                        jq_deferred.reject( jqXHR, error );
                    }
                } )
                .fail( function ( jqXHR, textStatus, errorThrown ) {
                    log_error( api2_url, textStatus, jqXHR.status + ' ' + jqXHR.statusText );
                    jq_deferred.reject( jqXHR, textStatus, errorThrown );
                } );
                
                return jq_deferred.promise();
            }
            
            /*
            // Chrome 拡張機能の場合 api.twitter.com を呼ぶと、
            // > Cross-Origin Read Blocking (CORB) blocked cross-origin response <url> with MIME type application/json. See https://www.chromestatus.com/feature/5629709824032768 for more details.
            // のような警告が出て、レスポンスボディが空になってしまう
            // 参考：
            //   [Changes to Cross-Origin Requests in Chrome Extension Content Scripts - The Chromium Projects](https://www.chromium.org/Home/chromium-security/extension-content-script-fetches)
            //   [Cross-Origin Read Blocking (CORB) とは - ASnoKaze blog](https://asnokaze.hatenablog.com/entry/2018/04/10/205717)
            */
            chrome.runtime.sendMessage( {
                type : 'FETCH_JSON',
                url : api2_url,
                options : {
                    method : 'GET',
                    headers : api_headers,
                    mode: 'cors',
                    credentials: 'include',
                },
            }, function ( response ) {
                log_debug( 'FETCH_JSON => response', response );
                
                if ( response.error ) {
                    jq_deferred.reject( { status : response.error, statusText : '' }, 'fetch error' );
                    return;
                }
                
                try {
                    jq_deferred.resolve( response.json.globalObjects.tweets[ tweet_id ] );
                    // TODO: シークレット(incognito)モードだと、{"errors":[{"code":353,"message":"This request requires a matching csrf cookie and header."}]} のように返されてしまう
                    // → manifest.json に『"incognito" : "split"』が必要だが、煩雑になる(Firefoxでは manifest.json 読み込み時にエラーとなる)ため、保留
                }
                catch ( error ) {
                    jq_deferred.reject( { status : 0, statusText : '' }, error );
                }
            } );
            
            return jq_deferred.promise();
        }, // end of api2_get_tweet_info()
        
        twitter_api_get_json = ( api_url, options ) => {
            if ( ! options ) {
                options = {};
            }
            
            var csrf_token = get_csrf_token(),
                tweet_id = ( function () {
                    var tweet_id;
                    
                    try {
                        tweet_id = ( api_url.match( /\/(\d+)\.json/ ) || api_url.match( /&id=(\d+)/ ) )[ 1 ];
                    }
                    catch ( error ) {
                    }
                    
                    return tweet_id;
                } )(),
                twitter_api = get_twitter_api(),
                min_wait_ms = ( twitter_api ) ? OPTIONS.TWITTER_API_DELAY_TIME_MS : OPTIONS.TWITTER_API2_DELAY_TIME_MS;
            
            return twitter_api_delay( min_wait_ms )
                .then( function () {
                    if ( twitter_api ) {
                        // API1.1 (OAuth 1.0a ユーザー認証) 使用
                        var parameters = {};
                        
                        /*
                        //if ( options.auto_reauth ) {
                        //    parameters.api_options = {
                        //        auto_reauth : options.auto_reauth
                        //    };
                        //}
                        // TODO: auto_reauth を有効にしていると認証ポップアップが非同期で表示されるのでポップアップブロックにひっかかる
                        // →保留
                        */
                        return twitter_api( api_url, 'GET', parameters );
                    }
                    else if ( csrf_token && tweet_id ) {
                        // API2 使用
                        return api2_get_tweet_info( tweet_id );
                    }
                    else {
                        return $.ajax( {
                            type : 'GET'
                        ,   url : api_url
                        ,   dataType : 'json'
                        } );
                    }
                } );
        }; // end of twitter_api_get_json()
    
    return [
        update_twitter_api_info,
        twitter_api_is_enabled,
        initialize_twitter_api,
        twitter_api_get_json,
        api2_get_tweet_info,
    ];
} )();



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
            
            if ( /^[\-+]?\d+\.?\d*(?:E[\-+]?\d+)?$/.test( column_item ) ) {
                csv_columns.push( column_item );
            }
            else {
                csv_columns.push( '"' + column_item.replace( /"/g, '""' ) + '"' );
            }
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


function is_ziprequest_usable() {
    /*
    //var is_usable = ( ( OPTIONS.ENABLE_ZIPREQUEST ) && ( typeof ZipRequest == 'function' ) && ( ( ! IS_FIREFOX ) || ( ! OPTIONS.INCOGNITO_MODE ) ) );
    //    // TODO: Firefox はシークレットモードでは ZipRequest が使用できない（zip_request.generate()
    //
    //return is_usable;
    */
    // TODO: background 側の処理メモリを圧迫してしまったとしても、content_scripts 側では感知／タブを閉じて解放が出来ない
    // → 2020.08.12: 暫定的に ZipRequest は使用不可にして対応
    return false;
} // end of is_ziprequest_usable()


var download_media_timeline = ( function () {
    var TemplateMediaDownload = {
            downloading : false
        ,   stopping : false
        ,   closing : false
        
        ,   is_for_likes_timeline : false
        ,   is_for_notifications_timeline : false
        
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
                    jq_checkbox_nomedia,
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
                        set_values( {
                            [ SCRIPT_NAME + '_support_image' ] : ( support_image ) ? '1' : '0'
                        } );
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
                        set_values( {
                            [ SCRIPT_NAME + '_support_gif' ] : ( support_gif ) ? '1' : '0'
                        } );
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
                        set_values( {
                            [ SCRIPT_NAME + '_support_video' ] : ( support_video ) ? '1' : '0'
                        } );
                    } );
                
                self.jq_checkbox_nomedia = jq_checkbox_nomedia = $( '<label><input type="checkbox" name="image">' + OPTIONS.CHECKBOX_NOMEDIA_TEXT + '</label>' )
                    .addClass( SCRIPT_NAME + '_checkbox_nomedia' );
                jq_checkbox_nomedia
                    .find( 'input' )
                    .prop( 'checked', support_nomedia )
                    .change( function ( event ) {
                        var jq_input = $( this );
                        
                        event.stopPropagation();
                        event.preventDefault();
                        
                        support_nomedia = jq_input.is( ':checked' );
                        set_values( {
                            [ SCRIPT_NAME + '_support_nomedia' ] : ( support_nomedia ) ? '1' : '0'
                        } );
                    } );
                
                self.jq_checkbox_include_retweets = jq_checkbox_include_retweets = $( '<label>(<input type="checkbox" name="include_retweets">' + OPTIONS.CHECKBOX_INCLUDE_RETWEETS + ')</label>' )
                    .addClass( SCRIPT_NAME + '_checkbox_include_retweets' );
                jq_checkbox_include_retweets
                    .find( 'input' )
                    .prop( 'checked', include_retweets )
                    .change( function ( event ) {
                        var jq_input = $( this );
                        
                        event.stopPropagation();
                        event.preventDefault();
                        
                        include_retweets = jq_input.is( ':checked' );
                        set_values( {
                            [ SCRIPT_NAME + '_include_retweets' ] : ( include_retweets ) ? '1' : '0'
                        } );
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
                        set_values( {
                            [ SCRIPT_NAME + '_dry_run' ] : ( dry_run ) ? '1' : '0'
                        } );
                    } );
                
                self.jq_button_start = jq_button_start = $( '<button />' )
                    .text( OPTIONS.DIALOG_BUTTON_START_TEXT )
                    .addClass( SCRIPT_NAME + '_button_start' )
                    .click( function ( event ) {
                        event.stopPropagation();
                        event.preventDefault();
                        
                        jq_button_start.blur();
                        
                        if ( jq_checkbox_container.find( 'input[type=checkbox][name!="include_retweets"]:enabled:checked' ).length <= 0 ) {
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
                
                jq_button_close
                    .html( '&#215;' ) // ×
                    .css( {
                        'font-size' : '32px'
                    ,   'display' : 'inline-block'
                    ,   'position' : 'absolute'
                    ,   'top' : '0'
                    ,   'right' : '10px'
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
                        
                        //self.on_close( event );
                        // ※誤ってダウンロード中にダイアログ外をクリックし閉じてしまうため、無効化
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
                    ,   'font-size' : '14px'
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
                
                
                function get_reg_time_string( time_string )  {
                    if ( time_string.match( /^(\d{4})(\d{2})(\d{2})[_\-](\d{2})(\d{2})(\d{2})$/ ) ) {
                        time_string = RegExp.$1 + '/' + RegExp.$2 + '/' + RegExp.$3 + ' ' + RegExp.$4 + ':' + RegExp.$5 + ':' + RegExp.$6;
                    }
                    return time_string;
                } // end of get_reg_time_string()
                
                
                function set_change_event( jq_target_id, jq_target_date ) {
                    jq_target_id.change( function ( event ) {
                        var val = jq_target_id.val().trim(),
                            tweet_id = '',
                            date = null,
                            date_string = '';
                        
                        if ( self.is_for_likes_timeline ) {
                            val = get_reg_time_string( val );
                            
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
                                val = get_reg_time_string( val );
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
                        set_values( {
                            [ SCRIPT_NAME + '_limit_tweet_number' ] : String( limit_tweet_number )
                        } );
                        jq_limit_tweet_number.val( limit_tweet_number );
                    } );
                
                self.jq_checkbox_container = jq_checkbox_container = $( '<div />' )
                    .addClass( SCRIPT_NAME + '_checkbox_container' )
                    .attr( {
                    } )
                    .css( {
                        'position' : 'absolute'
                    ,   'left' : '32px'
                    ,   'bottom' : '12px'
                    ,   'width' : '480px'
                    ,   'text-align' : 'left'
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
                
                jq_log_mask.find( '.spinner-bigger' )
                    .append( $( '<img/>' ).attr( 'src', LOADING_IMAGE_URL ) );
                
                jq_checkbox_container
                    .append( jq_checkbox_image )
                    .append( jq_checkbox_gif )
                    .append( jq_checkbox_video )
                    .append( jq_checkbox_nomedia )
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
                
                if ( true || twitter_api_is_enabled() ) {
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
                
                if ( OPTIONS.ENABLE_VIDEO_DOWNLOAD && twitter_api_is_enabled() ) {
                    self.jq_checkbox_video.css( 'color', '' ).find( 'input' ).prop( 'disabled', false );
                }
                else {
                    self.jq_checkbox_video.css( 'color', 'gray' ).find( 'input' ).prop( 'disabled', true );
                }
                
                if ( self.is_for_likes_timeline || self.is_for_notifications_timeline || judge_search_timeline() ) {
                    self.jq_checkbox_include_retweets.hide();
                }
                else {
                    self.jq_checkbox_include_retweets.show();
                }
                
                return self;
            } // end of reset_buttons()
        
        ,   show_container : function ( options ) {
                if ( ! options ) {
                    options = {};
                }
                
                var self = this,
                    jq_container = self.jq_container,
                    jq_range_container,
                    jq_button_close,
                    is_for_likes_timeline = self.is_for_likes_timeline = !! options.is_for_likes_timeline,
                    is_for_notifications_timeline = self.is_for_notifications_timeline = !! options.is_for_notifications_timeline,
                    timeline_type = self.timeline_type = options.timeline_type;
                
                if ( ! jq_container ) {
                    self.init_container();
                    
                    jq_container = self.jq_container;
                }
                
                jq_range_container = self.jq_range_container;
                
                if ( is_for_likes_timeline ) {
                    jq_range_container.find( 'input[name="since_id"]' ).attr( 'placeholder', OPTIONS.LIKES_DIALOG_TWEET_ID_PLACEHOLDER_LEFT );
                    jq_range_container.find( 'input[name="until_id"]' ).attr( 'placeholder', OPTIONS.LIKES_DIALOG_TWEET_ID_PLACEHOLDER_RIGHT );
                    jq_range_container.find( 'h3 > span.range_header_text' ).text( OPTIONS.LIKES_DIALOG_TWEET_ID_RANGE_HEADER );
                    jq_range_container.find( 'span.range_text' ).text( OPTIONS.LIKES_DIALOG_TWEET_ID_RANGE_MARK );
                }
                else {
                    jq_range_container.find( 'input[name="since_id"]' ).attr( 'placeholder', OPTIONS.DIALOG_TWEET_ID_PLACEHOLDER_LEFT );
                    jq_range_container.find( 'input[name="until_id"]' ).attr( 'placeholder', OPTIONS.DIALOG_TWEET_ID_PLACEHOLDER_RIGHT );
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
                
                var column_item_list = [ 'tweet_date', 'action_date', 'profile_name', 'screen_name', 'tweet_url', 'media_type', 'media_url', 'media_filename', 'remarks', 'tweet_content', 'reply_number', 'retweet_number', 'like_number' ].map( function ( column_name ) {
                        return ( column_map[ column_name ] || ( typeof column_map[ column_name ] == 'number' ) ) ? column_map[ column_name ] : '';
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
                    screen_name = self.screen_name = get_screen_name(),
                    logined_screen_name = self.logined_screen_name = get_logined_screen_name(),
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
                    total_media_counter = 0,
                    total_file_size = 0,
                    filter_info = {
                        image : support_image
                    ,   gif : support_gif
                    ,   video : support_video && OPTIONS.ENABLE_VIDEO_DOWNLOAD && twitter_api_is_enabled()
                    ,   nomedia : support_nomedia
                    ,   include_retweets : ( self.is_for_likes_timeline || self.is_for_notifications_timeline ) ? false : include_retweets
                    ,   dry_run : dry_run
                    ,   is_for_likes_timeline : self.is_for_likes_timeline
                    ,   is_for_notifications_timeline : self.is_for_notifications_timeline
                    },
                    
                    timeline_type = self.timeline_type,
                    ClassTimeline = CLASS_TIMELINE_SET[ timeline_type ],
                    TimelineObject = self.TimelineObject = null,
                    
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
                
                switch ( timeline_type ) {
                    case TIMELINE_TYPE.user : {
                            TimelineObject = new ClassTimeline( {
                                screen_name : screen_name,
                                max_tweet_id : until_id ? Decimal.sub( until_id, 1 ) : null,
                            } );
                        }
                        break;
                    
                    case TIMELINE_TYPE.search : {
                            let specified_query = $( 'div[data-testid="primaryColumn"] form[role="search"] input[data-testid="SearchBox_Search_Input"]' ).val(),
                                specified_filter_info = {
                                    use_media_filter : OPTIONS.ENABLE_FILTER,
                                    image : filter_info.image,
                                    gif : filter_info.gif,
                                    video : filter_info.video,
                                    nomedia : filter_info.nomedia,
                                };
                            
                            if ( ! specified_query ) {
                                specified_query = decodeURIComponent( get_url_info( w.location.href ).query_map[ 'q' ] || '' );
                            }
                            TimelineObject = new ClassTimeline( {
                                specified_query :  specified_query,
                                max_tweet_id : until_id ? Decimal.sub( until_id, 1 ) : null,
                                filter_info : specified_filter_info,
                            } );
                        }
                        break;
                    
                    default :
                        alert( 'Unsupported timeline !' );
                        return;
                }
                
                self.TimelineObject = TimelineObject;
                
                if ( is_ziprequest_usable() ) {
                    zip_request = new ZipRequest().open();
                }
                else {
                    zip = new JSZip();
                }
                
                self.log( 'Target URL :', w.location.href );
                self.csv_push_row( {
                    tweet_date : 'Target URL:',
                    action_date : w.location.href
                } );
                
                if ( TimelineObject.query_base ) {
                    self.log( 'Search Query :', TimelineObject.query_base );
                    self.csv_push_row( {
                        tweet_date : 'Search Query:',
                        action_date : TimelineObject.query_base,
                    } );
                }
                
                var line_prefix = '';
                
                if ( ! is_search_timeline ) {
                    line_prefix = '[@' + ( screen_name ? screen_name : logined_screen_name ) + '] ';
                    self.csv_push_row( {
                        tweet_date : ( self.is_for_notifications_timeline ) ? 'Mentions to' : profile_name
                    ,   action_date : '@' + ( screen_name ? screen_name : logined_screen_name )
                    } );
                }
                
                if ( self.is_for_likes_timeline ) {
                    self.log( line_prefix + '"Likes" date-time range :', since_date, '-', until_date );
                    self.csv_push_row( {
                        tweet_date : '"Likes" range:'
                    ,   action_date : since_date + ' ~ ' + until_date
                    } );
                }
                else {
                    self.log( line_prefix + 'Tweet range :', ( ( since_id ) ? since_id : '<unspecified>' ), since_date, '-', ( ( until_id ) ? until_id : '<unspecified>' ), until_date );
                    self.csv_push_row( {
                        tweet_date : 'Tweet range:'
                    ,   action_date : ( ( since_id ) ? since_id : '<unspecified>' ) + ' ' + since_date + ' ~ ' + ( ( until_id ) ? until_id : '<unspecified>' ) + ' ' + until_date
                    } );
                }
                
                var flag_strings = [
                        'Image : ' + ( filter_info.image ? 'on' : 'off' )
                    ,   'GIF : ' + ( filter_info.gif ? 'on' : 'off' )
                    ,   'Video : ' + ( filter_info.video ? 'on' : 'off' )
                    ,   'No media : ' + ( filter_info.nomedia ? 'on' : 'off' )
                    ],
                    flag_text = '';
                
                if ( is_search_timeline || self.is_for_likes_timeline || self.is_for_notifications_timeline ) {
                }
                else {
                    flag_strings.push( 'include RTs : ' + ( filter_info.include_retweets ? 'on' : 'off' ) );
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
                    tweet_content : 'Tweet content',
                    reply_number : 'Replies',
                    retweet_number : 'Retweets',
                    like_number : 'Likes'
                } );
                
                self.log_hr();
                
                
                function close_dialog() {
                    if ( zip_request ) {
                        zip_request.close();
                        zip_request = null;
                    }
                    zip = null;
                    TimelineObject = null;
                    
                    self.hide_container();
                } // end of close_dialog()
                
                
                function clean_up( callback ) {
                    if ( zip_request ) {
                        zip_request.close();
                        zip_request = null;
                    }
                    zip = null;
                    TimelineObject = null;
                    
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
                    
                    if ( ( ! min_id ) || ( ! max_id ) || ( total_tweet_counter <= 0 ) || ( ( ! filter_info.nomedia ) && ( total_media_counter <= 0 ) ) ) {
                        _callback();
                        return;
                    }
                    
                    var filename_head = ( self.is_search_timeline ) ?
                            ( 'search(' + format_date( new Date(), 'YYYYMMDD_hhmmss' ) + ')' ) :
                            ( ( self.is_for_notifications_timeline ) ? logined_screen_name : screen_name ),
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
                    else if ( self.is_for_notifications_timeline ) {
                         filename_prefix = [
                                'mentions-to'
                            ,   filename_head
                            ,   ( min_id + '(' + datetime_to_timestamp( min_datetime ) + ')' )
                            ,   ( max_id + '(' + datetime_to_timestamp( max_datetime ) + ')' )
                            ,   ( ( ( ! self.is_search_timeline ) && filter_info.include_retweets ) ? 'include_rts-' : '' ) + ( ( dry_run ) ? 'dryrun' : 'media' )
                            ].join( '-' );
                    }
                    else {
                         filename_prefix = [
                                filename_head
                            ,   ( min_id + '(' + datetime_to_timestamp( min_datetime ) + ')' )
                            ,   ( max_id + '(' + datetime_to_timestamp( max_datetime ) + ')' )
                            ,   ( ( ( ! self.is_search_timeline ) && filter_info.include_retweets ) ? 'include_rts-' : '' ) + ( ( dry_run ) ? 'dryrun' : 'media' )
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
                                alert( 'Sorry, ZIP download failed !' );
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
                            
                            alert( 'Sorry, ZIP download failed !' );
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
                        self.log( '[Stop]', min_datetime, '-', max_datetime, ' ( Tweet:', total_tweet_counter, '/ Media:', total_media_counter, ')' );
                    }
                    else {
                        self.log( '[Stop]', min_id, '-', max_id, ' ( Tweet:', total_tweet_counter, '/ Media:', total_media_counter, ')' );
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
                        self.log( '[Complete' + ( is_limited  ? '(limited)' : '' ) + ']', min_datetime, '-', max_datetime, ' ( Tweet:', total_tweet_counter, '/ Media:', total_media_counter, ')' );
                    }
                    else {
                        self.log( '[Complete' + ( is_limited  ? '(limited)' : '' ) + ']', min_id, '-', max_id, ' ( Tweet:', total_tweet_counter, '/ Media:', total_media_counter, ')' );
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
                
                
                async function check_fetched_tweet_info( tweet_info ) {
                    if ( is_close_dialog_requested() || is_stop_download_requested() ) {
                        return;
                    }
                    
                    if ( ( ! tweet_info ) || ( limit_tweet_number && ( limit_tweet_number <= total_tweet_counter ) ) ) {
                        download_completed( () => clean_up() );
                        return;
                    }
                    
                    let reacted_info = tweet_info.reacted_info,
                        target_tweet_info = ( reacted_info.id ) ? reacted_info : tweet_info,
                        reaction_info = ( reacted_info.id ) ? tweet_info : null,
                        comparison_id = ( reaction_info ) ? reaction_info.id : target_tweet_info.id,
                        comparison_datetime = ( reaction_info ) ? reaction_info.datetime : target_tweet_info.datetime,
                        is_matched_tweet = true;
                    
                    if ( until_id && ( bignum_cmp( until_id, comparison_id ) <= 0 ) ) {
                        return await check_fetched_tweet_info( await TimelineObject.fetch_tweet_info() );
                    }
                    
                    if ( since_id && ( bignum_cmp( comparison_id, since_id ) <= 0 ) ) {
                        download_completed( () => clean_up() );
                        return;
                    }
                    
                    switch ( target_tweet_info.media_type ) {
                        case MEDIA_TYPE.image :
                            if ( ! filter_info.image ) {
                                is_matched_tweet = false;
                            }
                            break;
                            
                        case MEDIA_TYPE.gif :
                            if ( ! filter_info.gif ) {
                                is_matched_tweet = false;
                            }
                            break;
                        
                        case MEDIA_TYPE.video :
                            if ( ! filter_info.video ) {
                                is_matched_tweet = false;
                            }
                            break;
                        
                        case MEDIA_TYPE.nomedia :
                            if ( ! filter_info.nomedia ) {
                                is_matched_tweet = false;
                            }
                            break;
                    }
                    
                    if ( is_matched_tweet ) {
                        switch ( reacted_info.type ) {
                            case REACTION_TYPE.retweet :
                                if ( ! filter_info.include_retweets ) {
                                    is_matched_tweet = false;
                                }
                                break;
                        }
                    }
                    
                    if ( ! is_matched_tweet ) {
                        return await check_fetched_tweet_info( await TimelineObject.fetch_tweet_info() );
                    }
                    
                    if ( reacted_info.type == REACTION_TYPE.retweet ) {
                        self.log( ( 1 + total_tweet_counter ) + '.', reaction_info.datetime + '(R) <-', target_tweet_info.datetime, target_tweet_info.tweet_url );
                    }
                    else {
                        self.log( ( 1 + total_tweet_counter ) + '.', target_tweet_info.datetime, target_tweet_info.tweet_url );
                    }
                    
                    if ( ( ! max_id ) || ( bignum_cmp( max_id, comparison_id ) < 0 ) ) {
                        max_id = comparison_id;
                        max_datetime = comparison_datetime;
                    }
                    
                    if ( ( ! min_id ) || ( bignum_cmp( comparison_id, min_id ) < 0 ) ) {
                        min_id = comparison_id;
                        min_datetime = comparison_datetime;
                    }
                    
                    total_tweet_counter ++;
                    
                    if ( 0 < target_tweet_info.media_list.length ) {
                        for ( let media_index = 0; media_index < target_tweet_info.media_list.length; media_index ++ ) {
                            let media = target_tweet_info.media_list[ media_index ],
                                media_url = media.media_url,
                                report_index = media_index + 1,
                                csv_media_type,
                                media_prefix,
                                media_extension;
                            
                            switch ( media.media_type ) {
                                case MEDIA_TYPE.image :
                                    csv_media_type = 'Image';
                                    media_prefix = 'img';
                                    media_extension = get_img_extension( media_url );
                                    break;
                                
                                case MEDIA_TYPE.gif :
                                    csv_media_type = 'GIF';
                                    media_prefix = 'gif';
                                    media_extension = get_video_extension( media_url );
                                    break;
                                
                                case MEDIA_TYPE.video :
                                    csv_media_type = 'Video';
                                    media_prefix = 'vid';
                                    media_extension = get_video_extension( media_url );
                                    break;
                                
                                default:
                                    log_error( '[bug] unknown error => ignored', media );
                                    continue;
                            }
                            
                            let timestamp = datetime_to_timestamp( target_tweet_info.datetime ),
                                media_filename = [ target_tweet_info.screen_name, target_tweet_info.id, timestamp, media_prefix + report_index ].join( '-' ) + '.' + media_extension,
                                download_error;
                            
                            if ( ! dry_run ) {
                                let media_result = await new Promise( ( resolve, reject ) => {
                                        fetch_url( media_url, {
                                            responseType : 'arraybuffer',
                                            
                                            onload : ( response ) => {
                                                resolve( {
                                                    arraybuffer : response.response,
                                                } );
                                            },
                                            
                                            onerror : ( response ) => {
                                                resolve( {
                                                    error : response.status + ' ' + response.statusText,
                                                } );
                                            } // end of onerror()
                                        } );
                                    } );
                                
                                if ( media_result.error ) {
                                    download_error = media_result.error;
                                }
                                else {
                                    zip.file( media_filename, media_result.arraybuffer, {
                                        date : adjust_date_for_zip( target_tweet_info.date ),
                                    } );
                                    
                                    total_file_size += media_result.arraybuffer.byteLength;
                                    log_debug( media_url, '=>', media_result.arraybuffer.byteLength, 'byte / total: ', total_file_size , 'byte' );
                                    
                                    delete media_result.arraybuffer;
                                    media_result.arraybuffer = null;
                                }
                            }
                            
                            self.csv_push_row( {
                                tweet_date : target_tweet_info.datetime,
                                action_date : ( reaction_info ) ? reaction_info.datetime : '',
                                profile_name : target_tweet_info.user_name,
                                screen_name : '@' + target_tweet_info.screen_name,
                                tweet_url : target_tweet_info.tweet_url,
                                media_url : media_url,
                                media_type : csv_media_type,
                                media_filename : ( media_filename ) ? media_filename : '-',
                                remarks : download_error || '',
                                tweet_content : target_tweet_info.text,
                                reply_number : target_tweet_info.reply_count || '',
                                retweet_number : target_tweet_info.retweet_count || '',
                                like_number : target_tweet_info.like_count || '',
                            } );
                            
                            if ( download_error ) {
                                self.log( '  ' + media_prefix + report_index + '\x29', media_url, '=>', download_error );
                            }
                            else {
                                self.log( '  ' + media_prefix + report_index + '\x29', media_url );
                            }
                            
                            if ( ( OPTIONS.DOWNLOAD_SIZE_LIMIT_MB ) && ( OPTIONS.DOWNLOAD_SIZE_LIMIT_MB * 1000000 <= total_file_size ) ) {
                                self.log_hr();
                                self.log( 'Stop: Total file size is over limit' );
                                
                                self.jq_button_stop.click();
                                
                                if ( is_stop_download_requested() || is_close_dialog_requested() ) {
                                    return;
                                }
                                else {
                                    log_error( '[bug] unknown error' );
                                }
                            }
                            
                            total_media_counter ++;
                        }
                    }
                    else {
                        self.csv_push_row( {
                            tweet_date : target_tweet_info.datetime,
                            action_date : ( reaction_info ) ? reaction_info.datetime : '',
                            profile_name : target_tweet_info.user_name,
                            screen_name : '@' + target_tweet_info.screen_name,
                            tweet_url : target_tweet_info.tweet_url,
                            media_url : '',
                            media_type : 'No media',
                            media_filename : '',
                            remarks : '',
                            tweet_content : target_tweet_info.text,
                            reply_number : target_tweet_info.reply_count || '',
                            retweet_number : target_tweet_info.retweet_count || '',
                            like_number : target_tweet_info.like_count || '',
                        } );
                        
                        self.log( '  (no media)' );
                    }
                    
                    return await check_fetched_tweet_info( await TimelineObject.fetch_tweet_info() );
                } // end of check_fetched_tweet_info()
                
                
                if ( since_id && until_id && ( bignum_cmp( until_id, since_id ) <= 0 ) ) {
                    self.log( '[Error]', 'Wrong range' );
                    
                    clean_up();
                    
                    return self;
                }
                
                self.downloading = true;
                self.stopping = false;
                self.closing = false;
                
                TimelineObject.fetch_tweet_info()
                .then( ( tweet_info ) => {
                    check_fetched_tweet_info( tweet_info );
                } )
                .catch( ( error ) => {
                    self.log( '[Error]', error );
                    check_fetched_tweet_info( null );
                } );
                
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
                    self.closing = true;
                    
                    return self;
                }
                
                self.hide_container();
                
                return self;
            } // end of on_close()
        
        },
        
        
        MediaDownload = object_extender( TemplateMediaDownload ).init();
    
    
    function download_media_timeline( options ) {
        if ( ! options ) {
            options = {};
        }
        
        /*
        //initialize_twitter_api()
        //.then( function () {
        //    MediaDownload.show_container( options );
        //} );
        */
        
        MediaDownload.show_container( options );
    } // end of download_media_timeline()
    
    
    return download_media_timeline;
} )(); // end of download_media_timeline()


var check_timeline_headers = ( function () {
    var button_class_name = SCRIPT_NAME + '_download_button',
        button_container_class_name = SCRIPT_NAME + '_download_button_container',
        
        jq_button_template = $( '<a />' )
            .addClass( button_class_name )
            .addClass( 'js-tooltip' )
            .attr( {
                href : '#'
            ,   title : OPTIONS.DOWNLOAD_BUTTON_HELP_TEXT
            ,   'data-timeline-type' : TIMELINE_TYPE.unknown
            } )
            /*
            .css( {
                'font-size' : '16px'
            ,   'vertical-align' : 'middle'
            ,   'text-decoration' : 'underline'
            } )
            */
            .click( function ( event ) {
                var jq_button = $( this );
                
                event.stopPropagation();
                event.preventDefault();
                
                jq_button.blur();
                
                download_media_timeline( {
                    is_for_likes_timeline : jq_button.hasClass( 'likes' )
                ,   is_for_notifications_timeline : jq_button.hasClass( 'notifications' )
                ,   timeline_type : jq_button.attr( 'data-timeline-type' )
                } );
                
                return false;
            } );
    
    jq_button_template.attr( 'role', 'link' );
    
    
    function check_search_timeline( jq_node ) {
        if ( ! CLASS_TIMELINE_SET[ TIMELINE_TYPE.search ] ) {
            return false;
        }
        
        if ( ! judge_search_timeline() ) {
            return false;
        }
        var jq_target_container = $();
        
        jq_target_container = $( 'div[data-testid="primaryColumn"] > div > div > div:first' );
        if ( 0 < jq_target_container.find( '.' + button_container_class_name ).length ) {
            jq_target_container = $();
        }
        
        if ( jq_target_container.length <= 0 ) {
            return false;
        }

        jq_target_container.find( '.' + button_container_class_name ).remove();
        
        var jq_button = jq_button_template.clone( true )
                .text( OPTIONS.DOWNLOAD_BUTTON_TEXT_LONG )
                .attr( 'data-timeline-type', TIMELINE_TYPE.search ),
            
            jq_button_container;
        
        jq_button_container = $( '<div />' )
            .css( {
                'right' : '12px'
            ,   'bottom' : '-14px'
            } );
        
        jq_button_container
            .addClass( button_container_class_name )
            .append( jq_button );
        
        jq_target_container.append( jq_button_container );
        
        return true;
    } // end of check_search_timeline()
    
    
    function check_profile_nav( jq_node ) {
        if ( ( ! CLASS_TIMELINE_SET[ TIMELINE_TYPE.user ] ) && ( ! CLASS_TIMELINE_SET[ TIMELINE_TYPE.likes ] ) ) {
            return false;
        }
        
        if ( ! judge_profile_timeline() ) {
            return false;
        }
        
        var jq_target_container = $();
        
        //jq_target_container = $( 'div[data-testid="primaryColumn"] > div > div > div:first:has(h2[role="heading"] > div[aria-haspopup="false"] span > span > span)' );
        //jq_target_container = $( 'div[data-testid="primaryColumn"] > div > div > div' ).first().filter( function () {return ( 0 < $( this ).find( 'h2[role="heading"] > div[aria-haspopup="false"] span > span > span' ).length );} );
        jq_target_container = $( 'div[data-testid="primaryColumn"] > div > div > div' ).first().filter( function () {return ( 0 < $( this ).find( 'h2[role="heading"] > div > div > div > span > span > span' ).length );} );
        if ( 0 < jq_target_container.find( '.' + button_container_class_name ).length ) {
            jq_target_container = $();
        }
        
        if ( jq_target_container.length <= 0 ) {
            return false;
        }
        
        jq_target_container.find( '.' + button_container_class_name ).remove();
        
        var jq_button = jq_button_template.clone( true )
                .text( OPTIONS.DOWNLOAD_BUTTON_TEXT_LONG )
                .attr( 'data-timeline-type', TIMELINE_TYPE.user ),
            
            jq_likes_button = jq_button_template.clone( true )
                .addClass( 'likes' )
                .text( OPTIONS.LIKES_DOWNLOAD_BUTTON_TEXT_LONG )
                .attr( 'title', OPTIONS.LIKES_DOWNLOAD_BUTTON_HELP_TEXT )
                .attr( 'data-timeline-type', TIMELINE_TYPE.likes ),
            
            jq_button_container,
            jq_insert_point = jq_target_container.find( '.ProfileNav-item--more' );
        
        jq_button_container = $( '<div />' )
            .css( {
                'right' : '130px'
            ,   'bottom' : '2px'
            } );
        
        if ( CLASS_TIMELINE_SET[ TIMELINE_TYPE.user ] ) {
            jq_button_container.append( jq_button );
        }
        
        if ( CLASS_TIMELINE_SET[ TIMELINE_TYPE.likes ] ) {
            jq_button_container.append( jq_likes_button );
        }
        
        jq_button
            .css( {
                'margin-right' : '16px'
            } );
        
        jq_button_container
            .addClass( button_container_class_name );
        
        jq_target_container.append( jq_button_container );
        
        return true;
    } // end of check_profile_nav()
    
    
    function check_profile_heading( jq_node ) {
        return false;
    } // end of check_profile_heading()
    
    
    function check_notifications_timeline( jq_node ) {
        if ( ! CLASS_TIMELINE_SET[ TIMELINE_TYPE.notifications ] ) {
            return false;
        }
        
        if ( ! judge_notifications_timeline() ) {
            return false;
        }
        
        var jq_target_container = $();
        
        jq_target_container = $( 'div[data-testid="primaryColumn"] > div > div > div:first' );
        if ( 0 < jq_target_container.find( '.' + button_container_class_name ).length ) {
            jq_target_container = $();
        }
        
        if ( jq_target_container.length <= 0 ) {
            return false;
        }
        
        jq_target_container.find( '.' + button_container_class_name ).remove();
        
        var jq_button = jq_button_template.clone( true )
                .addClass( 'notifications' )
                .attr( 'title', OPTIONS.MENTIONS_DOWNLOAD_BUTTON_HELP_LONG )
                .attr( 'data-timeline-type', TIMELINE_TYPE.notifications )
                .css( {
                } ),
            
            jq_button_container;
        
        jq_button.text( OPTIONS.MENTIONS_DOWNLOAD_BUTTON_TEXT_LONG );
        
        jq_button_container = $( '<div />' )
            .addClass( button_container_class_name )
            .css( {
                'right' : '130px'
            ,   'bottom' : '2px'
            } )
            .append( jq_button );
        
        jq_target_container.append( jq_button_container );
        
        return true;
    } // end of check_notifications_timeline()
    
    
    return function ( node ) {
        if ( ( ! node ) || ( node.nodeType != 1 ) ) {
            return false;
        }
        
        var jq_node = $( node ),
            counter = 0;
        
        if ( 0 < jq_node.find( '.' + button_container_class_name ).length ) {
            return false;
        }
        if ( check_profile_nav( jq_node ) ) counter ++;
        if ( check_profile_heading( jq_node ) ) counter ++;
        if ( check_search_timeline( jq_node ) ) counter ++;
        if ( check_notifications_timeline( jq_node ) ) counter ++;
        
        if ( 0 < counter ) log_debug( 'check_timeline_headers():', counter );
        
        return ( 0 < counter );
    };

} )(); // end of check_timeline_headers()


function add_media_button_to_tweet( jq_tweet ) {
    var media_button_class_name = SCRIPT_NAME + '_media_button',
        tweet_id,
        jq_action_list,
        jq_images,
        jq_playable_media,
        jq_player,
        tweet_url,
        screen_name,
        timestamp_ms,
        jq_tweet_time,
        jq_tweet_profile_link,
        media_number = 0;
    
    //tweet_url = jq_tweet.find( 'a[role="link"][href^="/"][href*="/status/"]:has(time)' ).attr( 'href' );
    tweet_url = jq_tweet.find( 'a[role="link"][href^="/"][href*="/status/"]' ).filter( function () {return ( 0 < $( this ).find( 'time' ).length );} ).attr( 'href' );
    jq_tweet_time = jq_tweet.find( 'a[role="link"] time[datetime]' );
        
    if ( ! tweet_url ) {
        tweet_url = new URL( location.href ).pathname;
    }
    
    if ( tweet_url.match( /^\/([^\/]+)\/status(?:es)?\/(\d+)/ ) ) {
        screen_name = RegExp.$1;
        tweet_id = RegExp.$2;
    }
    else {
        screen_name = '_unknown_';
        tweet_id = 0;
    }
    
    if ( 0 < jq_tweet_time.length ) {
        timestamp_ms = new Date( jq_tweet_time.attr( 'datetime' ) ).getTime();
    }
    else {
        // TODO: 個別ツイートの場合、日付が取得できない→ツイートIDから取得しているが、2010年11月以前は未対応
        try {
            timestamp_ms = tweet_id_to_date( tweet_id ).getTime();
        }
        catch ( error ) {
            timestamp_ms = new Date().getTime();
        }
    }
    
    //jq_action_list = jq_tweet.find( 'div[dir="auto"]:has(>a[role="link"][href*="/help.twitter.com/"])' ); // →遅い→ :has() を未使用にすることで効果大
    jq_action_list = jq_tweet.find( 'div[dir="auto"]' ).filter( function () {return ( 0 < $( this ).children( 'a[role="link"][href*="/help.twitter.com/"]' ).length );} );
    if ( jq_action_list.length <= 0 ) {
        jq_action_list = jq_tweet.find( 'div[role="group"]' );
    }
    
    // ボタン挿入時には、画像の数が確定していない場合がある→クリック直後に取得
    jq_images = jq_tweet.find( 'div[aria-label] > img[src*="//pbs.twimg.com/media/"]' )
        .filter( function ( index ) {
            return ( $( this ).parents( 'div[role="blockquote"]' ).length <= 0 ); // 引用ツイート中画像は対象としない
        } );
    
    jq_playable_media = jq_tweet.find( 'div[data-testid="previewInterstitial"]' ) // ※動画を自動再生しない場合のみ存在する要素
        .filter( function ( index ) {
            return ( $( this ).parents( 'div[role="blockquote"]' ).length <= 0 ); // 引用ツイート中画像は対象としない
        } )
        .addClass( 'PlayableMedia' );
    
    if ( 0 < jq_playable_media.length ) {
        jq_player = jq_playable_media.find( 'div[style*="background-image"]' ).addClass( 'PlayableMedia-player' );
        
        var background_image = jq_player.css( 'background-image' );
        
        if ( background_image ) {
            if ( background_image.match( /tweet_video_thumb/ ) ) {
                jq_playable_media.addClass( 'PlayableMedia--gif' );
            }
            //else if ( background_image.match( /(?:_video_thumb\/\d+\/|\/media\/)/ ) ) {
            //    jq_playable_media.addClass( 'PlayableMedia--video' );
            //}
            else if ( ! background_image.match( /card_img/ ) ) {
                jq_playable_media.addClass( 'PlayableMedia--video' );
            }
            else {
                // TODO: GIF / VIDEO 以外は未対応
                //jq_playable_media.addClass( 'PlayableMedia--vine' );
            }
        }
        else {
            jq_playable_media.removeClass( 'PlayableMedia' );
        }
    }
    else {
        var jq_video = jq_tweet.find( 'video' )
                .filter( function ( index ) {
                    return ( $( this ).parents( 'div[role="blockquote"]' ).length <= 0 ); // 引用ツイート中画像は対象としない
                } ),
            video_url = jq_video.attr( 'src' );
        
        if ( video_url ) {
            // [2020.01.14] video が div[role="button"] 下に無いケースあり e.g.) https://twitter.com/ceres13627_5/status/1216894829201743873
            //jq_playable_media = jq_player = jq_video.parents( 'div[role="button"]' ).addClass( 'PlayableMedia-player' );
            jq_playable_media = jq_player = jq_video.parents().eq( 3 ).addClass( 'PlayableMedia-player' );
            jq_playable_media.addClass( 'PlayableMedia' );
            
            if ( video_url.match( /video\.twimg\.com\/tweet_video\/.*?\.mp4/ ) ) {
                jq_playable_media.addClass( 'PlayableMedia--gif' );
            }
            else {
                jq_playable_media.addClass( 'PlayableMedia--video' );
            }
        }
    }
    
    jq_playable_media = jq_tweet.find( '.PlayableMedia' );
    
    media_number = ( 0 < jq_playable_media.length ) ? 1 : jq_images.length;
    
    if ( ( ! tweet_id ) || ( media_number <= 0 ) || ( jq_action_list.find( '.' + media_button_class_name ).attr( 'data-media-number' ) == media_number ) ) {
        return false;
    }
    
    // ダウンロード用の情報取得向けに要素埋め込み
    jq_tweet.find( '.' + SCRIPT_NAME + '_tweet_profile' ).remove();
    
    jq_tweet_profile_link = $( '<a class="js-user-profile-link js-action-profile" />' )
        .addClass( SCRIPT_NAME + '_tweet_profile' )
        .attr( {
            'href' : '/' + screen_name
        ,   'data-tweet-url' :  tweet_url
        ,   'data-time-ms' : timestamp_ms
        ,   'data-screen_name' :  screen_name
        ,   'data-tweet-id' :  tweet_id
        } )
        .css( 'display', 'none' );
    
    jq_tweet.append( jq_tweet_profile_link );
    
    screen_name = jq_tweet.find( 'a.js-user-profile-link.js-action-profile:first' ).attr( 'href' ).replace( /^.*\//, '' );
    timestamp_ms = jq_tweet.find( '*[data-time-ms]' ).attr( 'data-time-ms' );
    
    var tooltip_title = ( OPTIONS.OPEN_MEDIA_LINK_BY_DEFAULT ) ? OPTIONS.OPEN_MEDIA_LINK : OPTIONS.DOWNLOAD_MEDIA_TITLE,
        tooltip_alt_title = ( OPTIONS.OPEN_MEDIA_LINK_BY_DEFAULT ) ? OPTIONS.DOWNLOAD_MEDIA_TITLE : OPTIONS.OPEN_MEDIA_LINK,
        jq_media_button_container = $( '<div><button/></div>' )
            .addClass( 'ProfileTweet-action ' + media_button_class_name )
            .addClass( 'js-tooltip' )
            //.attr( 'data-original-title', 'Click: ' + tooltip_title + ' / \n' + ( IS_MAC ? '[option]' : '[Alt]' ) + '+Click: ' + tooltip_alt_title )
            .attr( 'title', 'Click: ' + tooltip_title + ' / \n' + ( IS_MAC ? '[option]' : '[Alt]' ) + '+Click: ' + tooltip_alt_title )
            .attr( 'data-media-number', media_number )
            .css( {
                'display' : 'none'
            } ),
        jq_media_button = jq_media_button_container.find( 'button:first' )
            .addClass( 'btn' );
    
    jq_action_list.find( '.' + media_button_class_name ).remove();
    
    
    function is_open_image_mode( event ) {
        return ( ( ( ! OPTIONS.OPEN_MEDIA_LINK_BY_DEFAULT ) && ( event.altKey ) ) || ( ( OPTIONS.OPEN_MEDIA_LINK_BY_DEFAULT ) && ( ! event.altKey ) ) );
    } // end of is_open_image_mode()
    
    
    function get_error_message( jqXHR ) {
        var message = '';
        
        switch ( jqXHR.status ) {
            case 401 :
                message = '(Unauthorized)';
                break;
            case 403 :
                message = '(Forbidden)';
                break;
            case 429 :
                try {
                    message = '(It will be reset after about ' + ~~( jqXHR.getResponseHeader( 'x-rate-limit-reset' ) - new Date().getTime() / 1000 ) + ' seconds)';
                }
                catch ( error ) {
                }
                break;
        }
        return message;
    } // end of get_error_message()
    
    
    var image_download_handler = ( function () {
        var clickable = true;
        
        function open_images( event ) {
            var image_urls = [];
            
            jq_images.each( function ( image_index ) {
                var jq_image = $( this ),
                    image_url = get_img_url_orig( jq_image.attr( 'src' ) );
                
                //image_urls.unshift( image_url );
                image_urls.push( image_url );
            } );
            
            if ( typeof extension_functions != 'undefined' ) {
                extension_functions.open_multi_tabs( image_urls );
            }
            else {
                image_urls.reverse().forEach( function ( image_url ) {
                    w.open( image_url );
                } );
            }
        } // end of open_images()
        
        
        return function ( event ) {
            event.stopPropagation();
            event.preventDefault();
            
            // ボタン挿入時には、画像の数が確定していない場合がある→クリック直後に取得
            jq_images = jq_tweet.find( 'div[aria-label] > img[src*="//pbs.twimg.com/media/"]' )
                .filter( function ( index ) {
                    return ( $( this ).parents( 'div[role="blockquote"]' ).length <= 0 ); // 引用ツイート中画像は対象としない
                } )
                .sort( function ( img_a, img_b ) {
                    try {
                        var num_a = parseInt( $( img_a ).parents( 'a[href]' ).attr( 'href' ).replace( /^.*\/photo\//, '' ), 10 ),
                            num_b = parseInt( $( img_b ).parents( 'a[href]' ).attr( 'href' ).replace( /^.*\/photo\//, '' ), 10 );
                        
                        if ( num_a < num_b ) {
                            return -1;
                        }
                        else if ( num_b < num_a ) {
                            return 1;
                        }
                        return 0;
                    }
                    catch ( error ) {
                        return 0;
                    }
                } );
            
            if ( jq_images.length != media_number ) {
                log_debug( 'unmatch media number', media_number, '=>', jq_images.length );
                media_number = jq_images.length;
                jq_media_button_container.attr( 'data-media-number', media_number );
            }
            
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
                date = new Date( parseInt( timestamp_ms, 10 ) ),
                timestamp = ( timestamp_ms ) ? format_date( date, 'YYYYMMDD_hhmmss' ) : '',
                zipdate = adjust_date_for_zip( date ),
                media_prefix = 'img',
                zip = null,
                zip_request = null;
            
            if ( is_ziprequest_usable() ) {
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
                            
                            alert( 'Sorry, ZIP download failed !' );
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
                        log_error( 'Error in zip.generateAsync()', error );
                        
                        alert( 'Sorry, ZIP download failed !' );
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
        var timestamp = ( timestamp_ms ) ? format_date( new Date( parseInt( timestamp_ms, 10 ) ), 'YYYYMMDD_hhmmss' ) : '',
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
    
    
    if ( ( jq_playable_media.length <= 0 ) && ( 0 < jq_images.length ) ) {
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
        if ( ! OPTIONS.VIDEO_DOWNLOAD_LINK ) {
            return;
        }
        
        if ( ! OPTIONS.ENABLE_VIDEO_DOWNLOAD ) {
            if ( ( ! jq_playable_media.hasClass( 'PlayableMedia--gif' ) ) || ( ! OPTIONS.QUICK_LOAD_GIF ) ) {
                return;
            }
        }
        
        if ( jq_playable_media.length <= 0 ) {
            return;
        }
        
        jq_media_button.text( OPTIONS.VIDEO_DOWNLOAD_LINK_TEXT );

        if ( jq_playable_media.hasClass( 'PlayableMedia--gif' ) || jq_playable_media.hasClass( 'PlayableMedia--vine' ) ) {
            var media_prefix = jq_playable_media.hasClass( 'PlayableMedia--gif' ) ? 'gif' : 'vid';
            
            jq_media_button.click( function ( event ) {
                //jq_media_button.off( 'click' );
                
                event.stopPropagation();
                event.preventDefault();
                
                if ( OPTIONS.QUICK_LOAD_GIF && ( media_prefix == 'gif' ) ) {
                    try {
                        var video_url = get_gif_video_url_from_playable_media( jq_playable_media );
                        
                        jq_media_button.off( 'click' );
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
                
                var video_info_url = API_VIDEO_CONFIG_BASE.replace( '#TWEETID#', tweet_id ),
                    child_window;
                
                if ( is_open_image_mode( event ) ) {
                    // ポップアップブロック対策
                    //child_window = w.open( 'about:blank', '_blank' ); // 空ページを開いておく
                    child_window = w.open( LOADING_IMAGE_URL, '_blank' ); // ダミー画像を開いておく
                }
                
                /*
                //initialize_twitter_api()
                //.then( function () {
                //    return twitter_api_get_json( video_info_url, { auto_reauth : true } );
                //} )
                */
                twitter_api_get_json( video_info_url )
                .done( function ( json, textStatus, jqXHR ) {
                    jq_media_button.off( 'click' );
                    
                    var video_url;
                    
                    try {
                        video_url = json.track.playbackUrl;
                    }
                    catch ( error ) {
                        video_url = json.extended_entities.media[ 0 ].video_info.variants[ 0 ].url;
                    }
                    
                    if ( ! is_video_url( video_url ) ) {
                        jq_media_button_container.css( 'display', 'none' );
                        if ( child_window ) {
                            child_window.close();
                        }
                        return;
                    }
                    activate_video_download_link( video_url, media_prefix );
                    
                    if ( is_open_image_mode( event ) ) {
                        if ( child_window ) {
                            child_window.location.replace( video_url );
                        }
                        else {
                            w.open( video_url );
                        }
                    }
                    else {
                        jq_media_button.click();
                    }
                } )
                .fail( function ( jqXHR, textStatus, errorThrown ) {
                    var error_message = get_error_message( jqXHR );
                    
                    log_error( video_info_url, textStatus, jqXHR.status + ' ' + jqXHR.statusText, error_message );
                    alert( jqXHR.status + ' ' + jqXHR.statusText + ' ' + error_message );
                    //jq_media_button_container.css( 'display', 'none' );
                } )
                .always( function () {
                } );
            } );
            
            jq_media_button_container.css( 'display', 'inline-block' );
        }
        else if ( jq_playable_media.hasClass( 'PlayableMedia--video' ) ) {
            jq_media_button.click( function ( event ) {
                //jq_media_button.off( 'click' );
                
                event.stopPropagation();
                event.preventDefault();
                
                var tweet_info_url = API_TWEET_SHOW_BASE.replace( '#TWEETID#', tweet_id ),
                    child_window;
                
                if ( is_open_image_mode( event ) ) {
                    // ポップアップブロック対策
                    //child_window = w.open( 'about:blank', '_blank' ); // 空ページを開いておく
                    child_window = w.open( LOADING_IMAGE_URL, '_blank' ); // ダミー画像を開いておく
                }
                
                /*
                //initialize_twitter_api()
                //.then( function () {
                //    return twitter_api_get_json( tweet_info_url, { auto_reauth : true } );
                //} )
                */
                //twitter_api_get_json( tweet_info_url )
                api2_get_tweet_info( tweet_id )
                .done( function ( json, textStatus, jqXHR ) {
                    jq_media_button.off( 'click' );
                    
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
                        //log_error( tweet_info_url, error );
                        log_error( tweet_id, error );
                        // TODO: 外部動画等は未サポート
                        log_info( 'response(json):', json );
                    }
                    
                    if ( ! video_url ) {
                        jq_media_button_container.css( 'display', 'none' );
                        if ( child_window ) {
                            child_window.close();
                        }
                        return;
                    }
                    activate_video_download_link( video_url, 'vid' );
                    
                    if ( is_open_image_mode( event ) ) {
                        if ( child_window ) {
                            child_window.location.replace( video_url );
                        }
                        else {
                            w.open( video_url );
                        }
                    }
                    else {
                        jq_media_button.click();
                    }
                } )
                .fail( function ( jqXHR, textStatus, errorThrown ) {
                    var error_message = get_error_message( jqXHR );
                    
                    log_error( tweet_info_url, textStatus, jqXHR.status + ' ' + jqXHR.statusText, error_message );
                    alert( jqXHR.status + ' ' + jqXHR.statusText + ' ' + error_message );
                    //jq_media_button_container.css( 'display', 'none' );
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
    
    return ( 0 < jq_media_button_container.length );
} // end of add_media_button_to_tweet()


function check_media_tweets( node ) {
    if ( ( ! node ) || ( node.nodeType != 1 ) ) {
        return false;
    }
    
    var jq_node = $( node ),
        jq_tweets = $();
    
    if ( jq_node.hasClasses( [ SCRIPT_NAME + '_media_button', SCRIPT_NAME + '_tweet_profile' ], true ) ) {
        return false;
    }
    
    jq_tweets = jq_node
        //.find( 'div[data-testid="primaryColumn"] article[role="article"]:has(div[data-testid="tweet"]):has(div[aria-label]):not(:has(.' + SCRIPT_NAME + '_media_button))' ) // → :has() を使わなくしてもそれ程パフォーマンスは変わらない
        .find( 'div[data-testid="primaryColumn"] article[role="article"]' )
        .filter( function () {
            var $tweet = $( this );
            
            return ( ( 0 < $tweet.find( 'div[data-testid="tweet"]' ).length ) && ( 0 < $tweet.find( 'div[aria-label]' ).length ) && ( $tweet.find( '.' + SCRIPT_NAME + '_media_button' ).length <= 0 ) );
        } )
        .filter( function ( index ) {
            var jq_tweet = $( this );
            
            return ( jq_tweet.find( 'a.' + SCRIPT_NAME + '_tweet_profile' ).length <= 0 );
        } );
    
    jq_tweets = jq_tweets.filter( function ( index ) {
        var jq_tweet = $( this );
        
        return add_media_button_to_tweet( jq_tweet );
    } );
    
    if ( 0 < jq_tweets.length ) log_debug( 'check_media_tweets():', jq_tweets.length );
    
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


function update_display_mode() {
    $( d.body ).attr( 'data-nightmode', is_night_mode() );
} // end of update_display_mode()


var is_primary_column_ready = () => {
    if ( $( 'div[data-testid="primaryColumn"]' ).length <= 0 ) {
        return false;
    }
    is_primary_column_ready = () => true;
    
    return true;
}; // end of is_primary_column_ready()


function start_mutation_observer() {
    new MutationObserver( function ( records ) {
        log_debug( '*** MutationObserver ***', records );
        
        update_twitter_api_info();
        update_display_mode();
        
        // TODO: React版 Twitter の場合、要素ごとの処理を行うと取りこぼしが出てしまう
        // → 追加要素毎の処理を止め、まとめてチェック
        if ( ! is_primary_column_ready() ) {
            return;
        }
        
        if ( OPTIONS.IMAGE_DOWNLOAD_LINK || OPTIONS.VIDEO_DOWNLOAD_LINK ) {
            check_media_tweets( d.body );
        }
        
        check_timeline_headers( d.body );
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
    
    // 2020.08.14: 不安定なオプションの固定化
    Object.assign( OPTIONS, {
        ENABLE_VIDEO_DOWNLOAD : true,
        ENABLE_ZIPREQUEST : false,
    } );
    
    function initialize_global_variables( callback ) {
        var global_names = [ 'limit_tweet_number', 'support_image', 'support_gif', 'support_video', 'support_nomedia', 'include_retweets', 'dry_run' ],
            storage_name_map = {},
            storage_names = global_names.map( function ( global_name ) {
                var storage_name = SCRIPT_NAME + '_' + global_name;
                
                storage_name_map[ global_name ] = storage_name;
                return storage_name;
            } ),
            finish = function ( name_value_map ) {
                set_values( name_value_map, function () {
                    callback( name_value_map );
                } );
            };
        
        get_values( storage_names, function ( name_value_map ) {
            if ( ( name_value_map[ storage_name_map.limit_tweet_number ] !== null ) && ( ! isNaN( name_value_map[ storage_name_map.limit_tweet_number ] ) ) ) {
                limit_tweet_number = parseInt( name_value_map[ storage_name_map.limit_tweet_number ], 10 );
            }
            else {
                limit_tweet_number = OPTIONS.DEFAULT_LIMIT_TWEET_NUMBER;
                name_value_map[ storage_name_map.limit_tweet_number ] = String( limit_tweet_number );
            }
            
            if ( name_value_map[ storage_name_map.support_image ] !== null ) {
                support_image = ( name_value_map[ storage_name_map.support_image ] !== '0' );
            }
            else {
                support_image = OPTIONS.DEFAULT_SUPPORT_IMAGE;
                name_value_map[ storage_name_map.support_image ] = ( support_image ) ? '1' : '0';
            }
            
            if ( name_value_map[ storage_name_map.support_gif ] !== null ) {
                support_gif = ( name_value_map[ storage_name_map.support_gif ] !== '0' );
            }
            else {
                support_gif = OPTIONS.DEFAULT_SUPPORT_GIF;
                name_value_map[ storage_name_map.support_gif ] = ( support_gif ) ? '1' : '0';
            }
            
            if ( name_value_map[ storage_name_map.support_video ] !== null ) {
                support_video = ( name_value_map[ storage_name_map.support_video ] !== '0' );
            }
            else {
                support_video = OPTIONS.DEFAULT_SUPPORT_VIDEO;
                name_value_map[ storage_name_map.support_video ] = ( support_video ) ? '1' : '0';
            }
            
            if ( name_value_map[ storage_name_map.support_nomedia ] !== null ) {
                support_nomedia = ( name_value_map[ storage_name_map.support_nomedia ] !== '0' );
            }
            else {
                support_nomedia = OPTIONS.DEFAULT_SUPPORT_NOMEDIA;
                name_value_map[ storage_name_map.support_nomedia ] = ( support_nomedia ) ? '1' : '0';
            }
            
            if ( name_value_map[ storage_name_map.include_retweets ] !== null ) {
                include_retweets = ( name_value_map[ storage_name_map.include_retweets ] !== '0' );
            }
            else {
                include_retweets = OPTIONS.DEFAULT_INCLUDE_RETWEETS;
                name_value_map[ storage_name_map.include_retweets ] = ( include_retweets ) ? '1' : '0';
            }
            
            if ( name_value_map[ storage_name_map.dry_run ] !== null ) {
                dry_run = ( name_value_map[ storage_name_map.dry_run ] !== '0' );
            }
            else {
                dry_run = OPTIONS.DEFAULT_DRY_RUN;
                name_value_map[ storage_name_map.dry_run ] = ( dry_run ) ? '1' : '0';
            }
            
            finish( name_value_map );
        } );
    
    } // end of initialize_global_variables()
    
    
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
            
            night_mode_selector = 'body[data-nightmode="true"]',
            media_button_selector = '.' + SCRIPT_NAME + '_media_button button.btn',
            night_mode_media_button_selector = night_mode_selector + ' ' + media_button_selector,
            header_button_selector = '.' + SCRIPT_NAME + '_download_button',
            night_mode_header_button_selector = night_mode_selector + ' ' + header_button_selector,
            header_button_container_selector = '.' + SCRIPT_NAME + '_download_button_container',
            night_mode_header_button_container_selector = night_mode_selector + ' ' + header_button_container_selector,
            
            css_rule_lines = [
                '.' + SCRIPT_NAME + '_toolbox label {cursor: pointer;}'
            
            ,   dialog_container_selector + ' {background: rgba( 0, 0, 0, 0.8 );}'
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
            
            ,   media_button_selector + ' {font-size: 12px; font-weight: normal; padding: 2px 3px; text-decoration: none; cursor: pointer; display: inline-block;}'
            ,   header_button_selector + ' {font-size: 16px; vertical-align: middle; text-decoration: underline}'
            ];
        
        var css_rule_lines_react = [
                media_button_selector + ' {margin-left: 8px; margin-right: 8px; background-image: linear-gradient(rgb(255, 255, 255), rgb(245, 248, 250)); background-color: rgb(245, 248, 250); color: rgb(102, 117, 127); cursor: pointer; display: inline-block; position: relative; border-width: 1px; border-style: solid; border-color: rgb(230, 236, 240); border-radius: 4px;}'
            ,   media_button_selector + ':hover {color: rgb(20, 23, 26); background-color: rgb(230, 236, 240); background-image: linear-gradient(rgb(255, 255, 255), rgb(230, 236, 240)); text-decoration: none; border-color: rgb(230, 236, 240);}'
            ,   header_button_selector + ' {color: rgb(27, 149, 224); font-weight: bolder;}'
            ,   header_button_container_selector + '{position: absolute; z-index: 1000;}'
            ,   dialog_container_selector + ' ' + log_selector + ' pre {margin: 0 0;}'
            ,   dialog_container_selector + ' ' + range_container_selector + ' {font-size:14px;}'
            ,   dialog_container_selector + ' ' + range_container_selector + ' input[type="text"] {padding: 2px 2px;}'
            ,   dialog_container_selector + ' .btn {background-color: #f5f8fa; background-image: linear-gradient(#fff,#f5f8fa); background-repeat: no-repeat; border: 1px solid #e6ecf0; border-radius: 4px; color: #66757f; cursor: pointer; display: inline-block; font-size: 14px; font-weight: bold; line-height: normal; padding: 8px 16px; position: relative;}'
            ,   dialog_container_selector + ' .btn:focus {outline: 0!important; box-shadow: 0 0 0 2px #fff, 0 0 2px 4px rgba(255, 0, 0, 0.4); background: #fff; border-color: #fff; text-decoration: none;}'
            ,   dialog_container_selector + ' .btn:hover {color: #14171a; text-decoration: none; background-color: #e6ecf0; background-image: linear-gradient(#fff,#e6ecf0); border-color: #e6ecf0;}'
            ,   dialog_container_selector + ' .btn:active {outline: 0!important; color: #14171a; background: #e6ecf0; border-color: #ccd6dd; box-shadow: inset 0 1px 4px rgba(0,0,0,0.25);}'
            ,   dialog_container_selector + ' .btn:focus:hover {border-color: #fff;}'
            ,   dialog_container_selector + ' .btn[disabled] {color: #66757f; cursor: default; background-color: #ccd6dd; background-image: linear-gradient(#fff,#f5f8fa); border-color: #ccd6dd; opacity: .5; -ms-filter: "alpha(opacity=50)";}'
            
            ,   night_mode_media_button_selector + ' {background-color: #182430; background-image: none; border: 1px solid #38444d; border-radius: 4px; color: #8899a6; display: inline-block;}'
            ,   night_mode_media_button_selector + ':hover {color: #fff; text-decoration: none; background-color: #10171e; background-image: none; border-color: #10171e;}'
            ,   night_mode_dialog_container_selector + ' .btn {background-color: rgb(24, 36, 48); background-image: none; color: rgb(136, 153, 166); cursor: pointer; display: inline-block; font-size: 14px; font-weight: bold; line-height: normal; position: relative; background-repeat: no-repeat; border-width: 1px; border-style: solid; border-color: rgb(56, 68, 77); border-image: initial; border-radius: 4px; padding: 8px 16px;}'
            ,   night_mode_dialog_container_selector + ' .btn:focus {outline: 0!important;}'
            ,   night_mode_dialog_container_selector + ' .btn:hover {color: rgb(255, 255, 255); background-color: rgb(16, 23, 30); background-image: none; text-decoration: none; border-color: rgb(16, 23, 30);}'
            ,   night_mode_dialog_container_selector + ' .btn:active {color: rgb(255, 255, 255); box-shadow: rgba(0, 0, 0, 0.25) 0px 1px 4px inset; background: rgb(16, 23, 30); border-color: rgb(56, 68, 77);}'
            ,   night_mode_dialog_container_selector + ' .btn:focus:hover {border-color: #fff;}'
            ,   night_mode_dialog_container_selector + ' .btn[disabled] {color: #8899a6; cursor: default; background-color: #38444d; background-image: linear-gradient(#fff,#182430); border-color: #38444d; opacity: .5; -ms-filter: "alpha(opacity=50)";}'
            ];
        
        css_rule_lines = css_rule_lines.concat( css_rule_lines_react );
        
        $( 'style.' + SCRIPT_NAME + '-css-rule' ).remove();
        
        insert_css( css_rule_lines.join( '\n' ) );
    
    } // end of set_user_css()
    
    
    function start_main( name_value_map ) {
        set_user_css();
        insert_download_buttons();
        insert_media_buttons();
        start_mutation_observer();
    } // end of start_main()
    
    
    initialize_global_variables( function ( name_value_map ) {
        // ※以前はこの時点で Twitter API の動作確認を実施していたが、React版ではこの時点ではサイドバーが表示されておらず get_logined_screen_name() で screen_name が取得できないため、
        //   最初に initialize_twitter_api() がコールされた時点で確認するように修正
        start_main( name_value_map );
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
