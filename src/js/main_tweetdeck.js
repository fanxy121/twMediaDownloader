// 【TweetDeck 用・Twitter メディアダウンローダ メイン処理】
( function ( w, d ) {

'use strict';

// ■ パラメータ {
var OPTIONS = {
    IMAGE_DOWNLOAD_LINK : true, // true: 個別ツイートに画像ダウンロードボタンを追加
    VIDEO_DOWNLOAD_LINK : true, // true: 個別ツイートに動画ダウンロードボタンを追加
    OPEN_MEDIA_LINK_BY_DEFAULT : false, // true: デフォルトでメディアリンクを開く（[Alt]＋Click時にダウンロード）
    ENABLED_ON_TWEETDECK : true, // true: TweetDeck 上で動作
    OPERATION : true, // true: 動作中、false: 停止中
    
    // TODO: 以下のオプション は TweetDeck では未サポート
    ENABLE_FILTER : true, // true: 検索タイムライン使用時に filter: をかける
    // ※検索タイムライン使用時、filter: をかけない場合にヒットする画像や動画が、filter: をかけるとヒットしないことがある
    DOWNLOAD_SIZE_LIMIT_MB : 500, // ダウンロード時のサイズ制限(MB)
    ENABLE_VIDEO_DOWNLOAD : true, // true: 動画ダウンロードを有効にする（ユーザー認証が必要）
    QUICK_LOAD_GIF : true,// true: アニメーションGIF（から変換された動画）の情報(URL)取得を簡略化
    DEFAULT_LIMIT_TWEET_NUMBER : 1000, // ダウンロードできる画像付きツイート数制限のデフォルト値
    DEFAULT_SUPPORT_IMAGE : true, // true: 画像をダウンロード対象にする
    DEFAULT_SUPPORT_GIF : true, // true: アニメーションGIF（から変換された動画）をダウンロード対象にする
    DEFAULT_SUPPORT_VIDEO : true, // true: 動画をダウンロード対象にする
    DEFAULT_INCLUDE_RETWEETS : false, // true: RTを含む
    DEFAULT_SUPPORT_NOMEDIA : false, // false: メディアを含まないツイートもログ・CSVやCSVに記録する
    DEFAULT_DRY_RUN : false, // true: 走査のみ
    ENABLE_ZIPREQUEST : true, // true: ZipRequest を使用してバックグラウンドでダウンロード＆アーカイブ(拡張機能の場合)
    INCOGNITO_MODE : false, // true: 秘匿モード（シークレットウィンドウ内で起動・拡張機能の場合のみ）
    // TODO: Firefox でシークレットウィンドウ内で実行する場合、ENABLE_ZIPREQUEST が true だと zip_request.generate() で失敗
    // → 暫定的に、判別して ZipRequest を使用しないようにする
    TWITTER_OAUTH_POPUP : true, // true: OAuth 認証時、ポップアップウィンドウを使用 / false: 同、別タブを使用
    TWITTER_API_DELAY_TIME_MS : 1100, // Twitter API コール時、前回からの最小間隔(ms)
    // Twitter API には Rate Limit があるため、続けてコールする際に待ち時間を挟む
    // /statuses/show.json の場合、15分で900回（正確に 900回／15分というわけではなく、15分毎にリセットされる）→1秒以上は空けておく
    // TODO: 別のタブで並列して実行されている場合や、別ブラウザでの実行は考慮していない
    TWITTER_API2_DELAY_TIME_MS : 5100, // Twitter API2 コール時、前回からの最小間隔(ms)
    // ※ api.twitter.com/2/timeline/conversation/:id の場合、15分で180回
    // TODO: 別のタブで並列して実行されている場合や、別ブラウザでの実行は考慮していない
};

// }


// ■ 共通変数 {
var SCRIPT_NAME = 'twMediaDownloader',
    IS_CHROME_EXTENSION = !! ( w.is_chrome_extension ),
    DEBUG = false;

if ( ( typeof jQuery != 'function' ) || ( ( typeof JSZip != 'function' ) && ( typeof ZipRequest != 'function' ) ) || ( typeof Decimal != 'function' ) ) {
    if ( w === w.top ) {
        console.error( SCRIPT_NAME + '(' + location.href + '):', 'Library not found - ', 'jQuery:', typeof jQuery, 'JSZip:', typeof JSZip, 'ZipRequest:', typeof ZipRequest, 'Decimal:', typeof Decimal );
    }
    return;
}

var $ = jQuery,
    IS_TOUCHED = ( function () {
        var touched_id = SCRIPT_NAME + '_touched',
            $touched = $( '#' + touched_id );
        
        if ( 0 < $touched.length ) {
            return true;
        }
        
        $( '<b>' ).attr( 'id', touched_id ).css( 'display', 'none' ).appendTo( $( d.documentElement ) );
        
        return false;
    } )();

if ( IS_TOUCHED ) {
    console.error( SCRIPT_NAME + ': Already loaded.' );
    return;
}


var LANGUAGE = ( () => {
        // TODO: TweetDeck の場合、html[lang]は "en-US" 固定
        try{
            return ( w.navigator.browserLanguage || w.navigator.language || w.navigator.userLanguage ).substr( 0, 2 );
        }
        catch ( error ) {
            return 'en';
        }
    } )(),
    
    USERAGENT =  w.navigator.userAgent.toLowerCase(),
    PLATFORM = w.navigator.platform.toLowerCase(),
    IS_FIREFOX = ( 0 <= USERAGENT.indexOf( 'firefox' ) ),
    IS_MAC = ( 0 <= PLATFORM.indexOf( 'mac' ) ),
    
    DOMAIN_PREFIX = location.hostname.match( /^(.+\.)?twitter\.com$/ )[ 1 ] || '',
    
    LOADING_IMAGE_URL = 'https://abs.twimg.com/a/1460504487/img/t1/spinner-rosetta-gray-32x32.gif',
    
    MEDIA_BUTTON_CLASS = SCRIPT_NAME + '_media_button',
    
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


var set_values = ( function () {
    return function ( name_value_map, callback ) {
        async_set_values( name_value_map )
        .then( function () {
            if ( typeof callback == 'function' ) {
                callback();
            }
        } );
    };
} )(); // end of set_values()


var get_values = ( function () {
    return function ( name_list, callback ) {
        async_get_values( name_list )
        .then( function ( name_value_map ) {
            callback( name_value_map );
        } );
    };
} )(); // end of get_values()


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


function insert_css( css_rule_text, css_style_id ) {
    var parent = d.querySelector( 'head' ) || d.body || d.documentElement,
        css_style = d.createElement( 'style' ),
        css_rule = d.createTextNode( css_rule_text );
    
    css_style.type = 'text/css';
    css_style.className = SCRIPT_NAME + '-css-rule';
    if ( css_style_id ) {
        css_style.id = css_style_id;
    }
    
    if ( css_style.styleSheet ) {
        css_style.styleSheet.cssText = css_rule.nodeValue;
    }
    else {
        css_style.appendChild( css_rule );
    }
    
    parent.appendChild( css_style );
} // end of insert_css()


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
    
    download_button.addEventListener( 'click', ( event ) => {
        event.stopPropagation(); // TweetDeck 側のイベントハンドラ無効化
    } );
    
    document.documentElement.appendChild( download_button );
    
    download_button.click();
    
    download_button.parentNode.removeChild( download_button );
} // end of download_url()


function download_blob( filename, blob ) {
    var blob_url = URL.createObjectURL( blob );
    
    download_url( filename, blob_url );
} // end of download_blob()


function normalize_image_url( source_url ) {
    // https://pbs.twimg.com/media/<id>.png:orig → https://pbs.twimg.com/media/<id>?format=png&name=orig 変換
    var reg_result = source_url.match( /^(.+)\.([^.:]+):((?:[^:]+)?)$/ );
    
    if ( ! reg_result ) {
        return source_url;
    }
    
    return reg_result[ 1 ] + '?format=' + reg_result[ 2 ] + ( ( reg_result[ 3 ] ) ? '&name=' + reg_result[ 4 ] : '' );
} // end of normalize_image_url()


function change_image_url( source_url, required_name ) {
    if ( /^https?:\/\/ton\.twitter\.com\//.test( source_url ) ) {
        // DM の画像は変換しない
        return source_url;
    }
    
    source_url = normalize_image_url( source_url );
    
    var url_info = new URL( source_url ),
        base_url = url_info.origin + url_info.pathname.replace( /\.[^.]*$/, '' ),
        original_format = ( url_info.pathname.match( /\.([^.]*)$/ ) || [ 0, '' ] )[ 1 ],
        format = url_info.searchParams.get( 'format' ) || original_format,
        name = url_info.searchParams.get( 'name' ) || 'medium',
        destination_format = format;
    
    if ( ! required_name ) {
        required_name = name;
    }
    
    if ( ( required_name == 'orig' ) && original_format ) {
        destination_format = original_format;
    }
    
    return base_url + '?format=' + encodeURIComponent( destination_format ) + '&name=' + encodeURIComponent( required_name );
} // end of change_image_url()


var get_gif_video_url_from_thumbnail_url = ( () => {
    // 動画GIFの背景画像 URL から MP4 の URL を割り出す
    // background-image:url('https://pbs.twimg.com/tweet_video_thumb/#VIDEO_ID#.jpg') => https://video.twimg.com/tweet_video/#VIDEO_ID#.mp4
    
    var gif_video_url_template = 'https://video.twimg.com/tweet_video/#VIDEO_ID#.mp4',
        reg_thumbnail_url = /\/tweet_video_thumb\/([^\/.?]+)/;
    
    return ( thumbnail_url ) => {
        try {
            return gif_video_url_template.replace( /#VIDEO_ID#/, thumbnail_url.match( reg_thumbnail_url )[ 1 ] );
        }
        catch ( error ) {
            return null;
        }
    };
} )(); // end of get_gif_video_url_from_thumbnail_url()


function get_image_extension( image_url ) {
    var url_info = new URL( image_url ),
        original_format = ( url_info.pathname.match( /\.([^.]*)$/ ) || [ 0, '' ] )[ 1 ],
        format = url_info.searchParams.get( 'format' ) || original_format || 'jpg';
    
    return format;
} // end of get_image_extension()


function is_video_url( url ) {
    return /\.mp4(?:$|\?)/.test( url );
} // end of is_video_url()


function get_video_extension( video_url ) {
    if ( ! is_video_url( video_url ) ) {
        return 'mp4';
    }
    return video_url.match( /\.([^.?]*)(?:$|\?)/ )[ 1 ];
} // end of get_video_extension()


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


function is_night_mode() {
    // TweetDeck 用判定
    var $html = $( 'html' );
    
    return $html.hasClasses( [ 'dark', 'night_mode' ], true );
} // end of is_night_mode()


function update_display_mode() {
    $( d.body ).attr( 'data-nightmode', is_night_mode() );
} // end of update_display_mode()


var fetch_api_json = ( () => {
    var api_authorization_bearer = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
        
        get_api_csrf_token = () => {
            var csrf_token;
            
            try {
                csrf_token = document.cookie.match( /ct0=(.*?)(?:;|$)/ )[ 1 ];
            }
            catch ( error ) {
            }
            
            return csrf_token;
        }, // end of get_api_csrf_token()
        
        create_api_header = () => {
            return {
                'authorization' : 'Bearer ' + api_authorization_bearer,
                'x-csrf-token' : get_api_csrf_token(),
                'x-twitter-active-user' : 'yes',
                'x-twitter-auth-type' : 'OAuth2Session',
                'x-twitter-client-language' : LANGUAGE,
            };
        },
        
        fetch_json = ( url, options ) => {
            log_debug( 'fetch_json()', url, options );
            
            if ( ( ! DOMAIN_PREFIX ) || ( IS_FIREFOX ) ) {
                return fetch( url, options ).then( response => response.json() );
            }
            
            /*
            // mobile.twitter.com 等から api.twitter.com を呼ぶと、
            // > Cross-Origin Read Blocking (CORB) blocked cross-origin response <url> with MIME type application/json. See https://www.chromestatus.com/feature/5629709824032768 for more details.
            // のような警告が出て、レスポンスボディが空になってしまう
            // 参考：
            //   [Changes to Cross-Origin Requests in Chrome Extension Content Scripts - The Chromium Projects](https://www.chromium.org/Home/chromium-security/extension-content-script-fetches)
            //   [Cross-Origin Read Blocking (CORB) とは - ASnoKaze blog](https://asnokaze.hatenablog.com/entry/2018/04/10/205717)
            */
            
            return new Promise( ( resolve, reject ) => {
                chrome.runtime.sendMessage( {
                    type : 'FETCH_JSON',
                    url : url,
                    options : options,
                }, function ( response ) {
                    log_debug( 'FETCH_JSON => response', response );
                    
                    if ( response.error ) {
                        reject( response.error );
                        return;
                    }
                    resolve( response.json );
                    // TODO: シークレット(incognito)モードだと、{"errors":[{"code":353,"message":"This request requires a matching csrf cookie and header."}]} のように返されてしまう
                    // → manifest.json に『"incognito" : "split"』が必要だが、煩雑になる(Firefoxでは manifest.json 読み込み時にエラーとなる)ため、保留
                } );
            } );
        }, // end of fetch_json()
        
        fetch_api_json = ( api_url ) => {
            return fetch_json( api_url, {
                method : 'GET',
                headers : create_api_header(),
                mode: 'cors',
                credentials: 'include',
            } );
        }; // end of fetch_api_json()
    
    return fetch_api_json;
} )(); // end of fetch_api_json()


var fetch_tweet_video_url = ( () => {
    var api_tweet_show_template = 'https://api.twitter.com/1.1/statuses/show.json?include_profile_interstitial_type=1&include_blocking=1&include_blocked_by=1&include_followed_by=1&include_want_retweets=1&skip_status=1&cards_platform=Web-12&include_cards=1&include_ext_alt_text=true&include_reply_count=1&tweet_mode=extended&trim_user=false&include_ext_media_color=true&id=#TWEETID#';
    
    return ( tweet_id ) => {
        var api_url = api_tweet_show_template.replace( /#TWEETID#/g, tweet_id );
        
        return fetch_api_json( api_url )
            .then( ( json ) => {
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
                    log_error( 'fetch_tweet_video_url():', api_url, error );
                    // TODO: 外部動画等は未サポート
                }
                
                return video_url;
            } );
    };
} )(); // end of fetch_tweet_video_url()


var add_media_button_to_tweet = ( () => {
    var tweet_info_map = {},
        reaction_info_map = {},
        
        update_tweet_info = ( tweet_id, values ) => {
            if ( ! tweet_id ) {
                return {};
            }
            
            if ( ! values ) {
                values = {};
            }
            
            values.id = tweet_id;
            
            var tweet_info = tweet_info_map[ tweet_id ] = tweet_info_map[ tweet_id ] || {
                    rt_info_map : {},
                    like_info_map : {},
                };
            
            Object.assign( tweet_info, values );
            
            return tweet_info;
        }, // end of update_tweet_info()
        
        update_reaction_info = ( $tweet ) => {
            var data_tweet_id = $tweet.attr( 'data-tweet-id' ) || '',
                data_key = $tweet.attr( 'data-key' ) || '';
            
            if ( data_tweet_id == data_key ) {
                return {};
            }
            
            var existing_reaction_info = get_stored_reaction_info( data_key );
            
            if ( existing_reaction_info ) {
                return;
            }
            
            var retweet_id = ( data_key.match( /^(\d+)$/ ) || [ 0, '' ] )[ 1 ],
                is_retweet = !! ( retweet_id ),
                is_like = /^favorite_/.test( data_key ),
                is_dm = /^conversation-/.test( data_key ),
                
                reaction_name = ( () => {
                    if ( is_retweet ) {
                        return 'retweet';
                    }
                    if ( is_like ) {
                        return 'like';
                    }
                    if ( is_dm ) {
                        return 'dm';
                    }
                    return 'other';
                } )();
            
            if ( reaction_name == 'other' ) {
                return {};
            }
            
            var $user_link,
                $time;
            
            if ( is_dm ) {
                $user_link = $tweet.find( 'header a[rel="user"]:first' );
                $time = $tweet.find( 'header time:first' );
            }
            else {
                $user_link = $tweet.find( [
                    '.activity-header .nbfc a[rel="user"]:first',
                    '.tweet .tweet-context .nbfc a[rel="user"]:first',
                ].join( ',' ) );
                $time = $tweet.find( '.activity-header time' );
            }
            
            var reacter_screen_name = ( $user_link.attr( 'href' ) || '/' ).match( /\/([^\/]*)$/ )[ 1 ],
                reacted_timestamp_ms = 1 * ( $time.attr( 'data-time' ) || new Date().getTime() ),
                
                reaction_info = reaction_info_map[ data_key ] = {
                    key : data_key,
                    reaction_name : reaction_name,
                    id : retweet_id,
                    reacted_id : data_tweet_id,
                    screen_name : reacter_screen_name,
                    timestamp_ms : reacted_timestamp_ms,
                };
            
            if ( ( ! data_tweet_id ) || ( ( ! is_retweet ) && ( ! is_like ) ) ) {
                return reaction_info;
            }
            
            var reacted_tweet_info = update_tweet_info( data_tweet_id ),
                reaction_tweet_info = ( is_retweet ) ? update_tweet_info( retweet_id, reaction_info ) : {},
                info_map = ( is_retweet ) ? reacted_tweet_info.rt_info_map : reacted_tweet_info.like_info_map;
            
            info_map[ reacter_screen_name ] = reaction_info;
            
            return reaction_info;
        }, // end of update_reaction_info()
        
        get_tweet_id_info = ( $tweet ) => {
            var tweet_id = $tweet.attr( 'data-tweet-id' ),
                $header,
                screen_name,
                timestamp_ms,
                
                parse_time_string = ( () => {
                    var reg_time = /^(\d+):(\d+)(am|pm)[^\d]+(.+)$/i;
                    
                    return ( source_time_string ) => {
                        source_time_string = source_time_string.trim();
                        
                        var reg_result = source_time_string.match( reg_time );
                        
                        if ( ! reg_result ) {
                            return null;
                        }
                        
                        var hour = 1 * reg_result[ 1 ],
                            minute = 1 * reg_result[ 2 ],
                            suffix = reg_result[ 3 ].toLowerCase(),
                            date = reg_result[ 4 ];
                        
                        if ( hour == 12 ) {
                            hour = 0;
                        }
                        if ( suffix == 'pm' ) {
                            hour = hour + 12;
                        }
                        
                        var time_string = date + ' ' + hour + ':' + minute,
                            timestamp_ms = Date.parse( time_string );
                        
                        if ( isNaN( timestamp_ms ) ) {
                            return null;
                        }
                        return timestamp_ms;
                    };
                } )();
            
            if ( 0 < $tweet.find( '.tweet-detail' ).length ) {
                screen_name = $tweet.find( '.account-summary a.account-link:first' ).attr( 'data-user-name' );
                timestamp_ms = parse_time_string( $tweet.find( '.margin-tl a[rel="url"]:first' ).text() );
                if ( ! timestamp_ms ) {
                    try {
                        timestamp_ms = tweet_id_to_date( tweet_id ).getTime();
                    }
                    catch ( error ) {
                        timestamp_ms = new Date().getTime();
                    }
                }
            }
            else {
                $header = $tweet.find( 'header' );
                screen_name = ( $header.find( 'a[rel="user"]:first' ).attr( 'href' ) || '/' ).match( /\/([^\/]*)$/ )[ 1 ];
                timestamp_ms = 1 * $header.find( 'time:first' ).attr( 'data-time' );
            }
            
            var tweet_id_info = {
                tweet_id : tweet_id,
                screen_name : screen_name,
                timestamp_ms : timestamp_ms,
            };
            
            return tweet_id_info;
        }, // end of get_tweet_id_info()
        
        get_thumbnail_url = ( () => {
            var reg_url = /url\("?(.+?)"?\)/;
            
            return ( $element ) => {
                try {
                    return $element.css( 'background-image' ).match( reg_url )[ 1 ];
                }
                catch ( error ) {
                    return null;
                }
            };
        } )(), // end of get_thumbnail_url()
        
        update_stored_tweet_info = ( $tweet ) => {
            var reaction_info = update_reaction_info( $tweet ),
                tweet_id_info = get_tweet_id_info( $tweet ),
                tweet_id = tweet_id_info.tweet_id;
            
            if ( ! tweet_id ) {
                return {
                    tweet_info : null,
                    reaction_info : reaction_info,
                };
            }
            
            var existing_tweet_info = get_stored_tweet_info( tweet_id );
            
            if ( existing_tweet_info && existing_tweet_info.screen_name ) {
                return {
                    tweet_info : existing_tweet_info,
                    reaction_info : reaction_info,
                };
            }
            
            var is_tweet_detail = ( 0 < $tweet.find( '.tweet-detail' ).length ),
                $media_container = $tweet.find( '.js-media' ).filter( function () {
                    return ( $( this ).parents( '.quoted-tweet' ).length <= 0 ); // 引用ツイート中のメディアは対象外
                } ),
                
                media_type = ( () => {
                    if ( $media_container.length <= 0 ) {
                        return 'none';
                    }
                    
                    if ( 0 < $media_container.find( '.is-gif' ).length ) {
                        return 'gif';
                    }
                    
                    if ( 0 < $media_container.find( '.is-video, .js-media-native-video' ).length ) {
                        return 'video';
                    }
                    
                    return 'image';
                } )(),
                
                [
                    media_urls,
                    thumbnail_urls,
                ] = ( () => {
                    var media_urls = [],
                        thumbnail_urls = [];
                    
                    switch ( media_type ) {
                        case 'image' :
                            $media_container.find( 'a.js-media-image-link[rel="mediaPreview"]' ).each( function () {
                                var $element = $( this ),
                                    thumbnail_url = get_thumbnail_url( $element );
                                
                                if ( ! thumbnail_url ) {
                                    return;
                                }
                                
                                thumbnail_urls.push( thumbnail_url );
                                
                                var media_url =  change_image_url( thumbnail_url, 'orig' );
                                
                                if ( ! media_url ) {
                                    return;
                                }
                                media_urls.push( media_url );
                            } );
                            break;
                        
                        case 'gif' :
                            $media_container.find( '.js-media-gif-container, a.js-media-image-link[rel="mediaPreview"]' ).each( function () {
                                var $element = $( this ),
                                    thumbnail_url = get_thumbnail_url( $element );
                                
                                if ( ! thumbnail_url ) {
                                    return;
                                }
                                thumbnail_urls.push( thumbnail_url );
                                
                                var media_url = get_gif_video_url_from_thumbnail_url( thumbnail_url );
                                
                                if ( ! media_url ) {
                                    return;
                                }
                                media_urls.push( media_url );
                            } );
                            break;
                        
                        case 'video' :
                            $media_container.find( '.js-media-native-video, a.js-media-image-link[rel="mediaPreview"]' ).each( function () {
                                var $element = $( this ),
                                    thumbnail_url = get_thumbnail_url( $element );
                                
                                if ( ! thumbnail_url ) {
                                    return;
                                }
                                thumbnail_urls.push( thumbnail_url );
                            } );
                            break;
                    }
                    
                    return [
                        media_urls,
                        thumbnail_urls,
                    ];
                } )(),
                
                tweet_info = update_tweet_info( tweet_id, {
                    screen_name : tweet_id_info.screen_name,
                    timestamp_ms : tweet_id_info.timestamp_ms,
                    media_info : {
                        type : media_type,
                        thumbnail_urls : thumbnail_urls,
                        media_urls : media_urls,
                    },
                } );
            
            return {
                tweet_info : tweet_info,
                reaction_info : reaction_info,
            };
        }, // end of update_stored_tweet_info()
        
        get_stored_tweet_info = ( tweet_id ) => {
            return tweet_info_map[ tweet_id ];
        }, // end of get_stored_tweet_info()
        
        get_stored_reaction_info = ( key ) => {
            return reaction_info_map[ key ];
        }, // end of get_stored_reaction_info()
        
        is_open_image_mode = ( event ) => {
            return ( OPTIONS.OPEN_MEDIA_LINK_BY_DEFAULT ^ event.altKey );
        }, // end of is_open_image_mode()
        
        add_media_button_to_tweet = ( $tweet ) => {
            update_stored_tweet_info( $tweet );
            
            var tweet_id = $tweet.attr( 'data-tweet-id' ),
                tweet_info = get_stored_tweet_info( tweet_id );
            
            if ( ! tweet_info ) {
                return;
            }
            
            var is_tweet_detail = ( 0 < $tweet.find( '.tweet-detail' ).length ),
                $media_container = $tweet.find( '.js-media' ),
                $footer = $tweet.find( 'footer' ),
                $menu_container,
                $margin_tl,
                
                media_type = tweet_info.media_info.type,
                
                $media_button_container = ( () => {
                    var $media_button_container = $( is_tweet_detail ? '<div><button/></div>' : '<li><button/></li>' ).addClass( MEDIA_BUTTON_CLASS + ( is_tweet_detail ? '' : ' tweet-action-item pull-left margin-r--10' ) ).hide();
                    
                    switch ( media_type ) {
                        case 'image' :
                            if ( OPTIONS.IMAGE_DOWNLOAD_LINK ) {
                                $media_button_container.show();
                            }
                            break;
                        
                        case 'gif' :
                        case 'video' :
                            if ( OPTIONS.VIDEO_DOWNLOAD_LINK ) {
                                $media_button_container.show();
                            }
                            break;
                    }
                    
                    return $media_button_container;
                } )(),
                
                $media_button = ( () => {
                    var tooltip_title = ( OPTIONS.OPEN_MEDIA_LINK_BY_DEFAULT ) ? OPTIONS.OPEN_MEDIA_LINK : OPTIONS.DOWNLOAD_MEDIA_TITLE,
                        tooltip_alt_title = ( OPTIONS.OPEN_MEDIA_LINK_BY_DEFAULT ) ? OPTIONS.DOWNLOAD_MEDIA_TITLE : OPTIONS.OPEN_MEDIA_LINK,
                        
                        $media_button = $media_button_container.find( 'button' ).addClass( 'btn' ).attr( {
                            'title' : 'Click: ' + tooltip_title + ' / \n' + ( IS_MAC ? '[option]' : '[Alt]' ) + '+Click: ' + tooltip_alt_title,
                        } ).text( ( media_type == 'gif' || media_type == 'video' ) ? OPTIONS.VIDEO_DOWNLOAD_LINK_TEXT : OPTIONS.IMAGE_DOWNLOAD_LINK_TEXT );
                    
                    return $media_button;
                } )(),
                
                update_tweet_info = () => {
                    return {};
                },
                
                on_click_image = ( tweet_info, event ) => {
                    var media_urls = tweet_info.media_info.media_urls;
                    
                    if ( is_open_image_mode( event ) ) {
                        media_urls.slice( 0 ).reverse().forEach( ( media_url ) => {
                            w.open( media_url, '_blank' );
                        } );
                        return;
                    }
                    
                    if ( media_urls.length <= 0 ) {
                       return;
                    }
                    
                    $media_button.prop( 'disabled', true );
                    
                    Promise.all(
                        media_urls.map( ( media_url ) => {
                            return new Promise( ( resolve, reject ) => {
                                fetch( media_url )
                                .then( response  => response.arrayBuffer() )
                                .then( ( arraybuffer ) => {
                                    resolve( {
                                        media_url : media_url,
                                        success : true,
                                        arraybuffer : arraybuffer,
                                    } );
                                } )
                                .catch( ( error ) => {
                                    log_error( 'fetch() error:', error, 'media_url:', media_url );
                                    
                                    resolve( {
                                        media_url : media_url,
                                        success : false,
                                        arraybuffer : null,
                                        error : error,
                                    } );
                                } );
                            } );
                        } )
                    )
                    .then( ( results ) => {
                        var zip = new JSZip(),
                            tweet_id = tweet_info.id,
                            screen_name = tweet_info.screen_name,
                            timestamp_ms = tweet_info.timestamp_ms,
                            date = ( timestamp_ms ) ? new Date( timestamp_ms ) : new Date(),
                            zipdate = adjust_date_for_zip( date ),
                            timestamp = format_date( date, 'YYYYMMDD_hhmmss' ),
                            media_prefix = 'img';
                        
                        results.forEach( ( result, index ) => {
                            if ( ! result.success ) {
                                return;
                            }
                            
                            var image_index = index + 1,
                                img_extension = get_image_extension( result.media_url ),
                                image_filename = [ screen_name, tweet_id, timestamp, media_prefix + image_index ].join( '-' ) + '.' + img_extension;
                            
                            zip.file( image_filename, result.arraybuffer, { // Firefox だと blob を渡すとうまくいかない（Error: "The data of '<filename>' is in an unsupported format !"）
                                date : zipdate,
                            } );
                        } );
                        
                        zip.generateAsync( { type : 'blob' } )
                        .then( ( zip_content ) => {
                            var zip_filename = [ screen_name, tweet_id, timestamp, media_prefix ].join( '-' ) + '.zip';
                            
                            download_blob( zip_filename, zip_content );
                            $media_button.prop( 'disabled', false );
                            zip = null;
                        } )
                        .catch( ( error ) => {
                            log_error( 'Error in zip.generateAsync()', error );
                            alert( 'Sorry, ZIP download failed !' );
                            $media_button.prop( 'disabled', false );
                            zip = null;
                        } );
                    } );
                },
                
                on_click_gif = ( tweet_info, event ) => {
                    var media_urls = tweet_info.media_info.media_urls;
                    
                    if ( media_urls.length <= 0 ) {
                       return;
                    }
                    
                    var media_url = media_urls[ 0 ];
                    
                    if ( is_open_image_mode( event ) ) {
                        w.open( media_url, '_blank' );
                        return;
                    }
                    
                    var resolve = ( result ) => {
                            $media_button.prop( 'disabled', false );
                            
                            if ( ! result.success ) {
                                alert( 'Sorry, media download failed !' );
                                return;
                            }
                            
                            var tweet_id = tweet_info.id,
                                screen_name = tweet_info.screen_name,
                                timestamp_ms = tweet_info.timestamp_ms,
                                date = ( timestamp_ms ) ? new Date( timestamp_ms ) : new Date(),
                                timestamp = format_date( date, 'YYYYMMDD_hhmmss' ),
                                media_prefix = 'gif',
                                filename = [ screen_name, tweet_id, timestamp, media_prefix + '1' ].join( '-' ) + '.' + get_video_extension( media_url );
                            
                            download_blob( filename, result.blob );
                        };
                    
                    $media_button.prop( 'disabled', true );
                    
                    fetch( media_url )
                    .then( response  => response.blob() )
                    .then( ( blob ) => {
                        resolve( {
                            media_url : media_url,
                            success : true,
                            blob : blob,
                        } );
                    } )
                    .catch( ( error ) => {
                        log_error( 'fetch() error:', error, 'media_url:', media_url );
                        resolve( {
                            media_url : media_url,
                            success : false,
                            blob : null,
                            error : error,
                        } );
                    } );
                },
                
                on_click_video = ( tweet_info, event ) => {
                    var media_urls = tweet_info.media_info.media_urls,
                        
                        child_window = null,
                        
                        finish = () => {
                            if ( media_urls.length <= 0 ) {
                                $media_button.prop( 'disabled', false );
                               return;
                            }
                            
                            var media_url = media_urls[ 0 ];
                            
                            if ( is_open_image_mode( event ) ) {
                                if ( child_window ) {
                                    child_window.location.replace( media_url );
                                }
                                else {
                                    w.open( media_url, '_target' );
                                }
                                $media_button.prop( 'disabled', false );
                                return;
                            }
                            
                            var resolve = ( result ) => {
                                    $media_button.prop( 'disabled', false );
                                    
                                    if ( ! result.success ) {
                                        alert( 'Sorry, media download failed !' );
                                        return;
                                    }
                                    
                                    var tweet_id = tweet_info.id,
                                        screen_name = tweet_info.screen_name,
                                        timestamp_ms = tweet_info.timestamp_ms,
                                        date = ( timestamp_ms ) ? new Date( timestamp_ms ) : new Date(),
                                        timestamp = format_date( date, 'YYYYMMDD_hhmmss' ),
                                        media_prefix = 'vid',
                                        filename = [ screen_name, tweet_id, timestamp, media_prefix + '1' ].join( '-' ) + '.' + get_video_extension( media_url );
                                    
                                    download_blob( filename, result.blob );
                                };
                            
                            $media_button.prop( 'disabled', true );
                            
                            fetch( media_url )
                            .then( response  => response.blob() )
                            .then( ( blob ) => {
                                resolve( {
                                    media_url : media_url,
                                    success : true,
                                    blob : blob,
                                } );
                            } )
                            .catch( ( error ) => {
                                log_error( 'fetch() error:', error, 'media_url:', media_url );
                                resolve( {
                                    media_url : media_url,
                                    success : false,
                                    blob : null,
                                    error : error,
                                } );
                            } );
                        };
                    
                    $media_button.prop( 'disabled', true );
                    
                    if ( 0 < media_urls.length ) {
                        finish();
                        return;
                    }
                    
                    var thumbnail_urls = tweet_info.media_info.thumbnail_urls,
                        temporary_url = ( 0 < thumbnail_urls.length ) ? thumbnail_urls[ 0 ] : LOADING_IMAGE_URL;
                    
                    if ( is_open_image_mode( event ) ) {
                        child_window = w.open( temporary_url, '_blank' );
                    }
                    
                    fetch_tweet_video_url( tweet_info.id )
                    .then( ( video_url ) => {
                        media_urls.push( video_url );
                        finish();
                    } )
                    .catch( ( error ) => {
                        alert( 'Sorry, media information download failed !' );
                        finish();
                    } );
                };
            
            $media_button.on( 'click', ( event ) => {
                event.stopPropagation();
                event.preventDefault();
                
                switch ( media_type ) {
                    case 'image' :
                        on_click_image( tweet_info, event );
                        break;
                    
                    case 'gif' :
                        on_click_gif( tweet_info, event );
                        break;
                    
                    case 'video' :
                        on_click_video( tweet_info, event );
                        break;
                }
            } );
            
            if ( is_tweet_detail ) {
                $margin_tl = $tweet.find( '.margin-tl' );
                
                if ( 0 < $margin_tl.length ) {
                    $margin_tl.append( $media_button_container );
                }
                else {
                    $footer.prepend( $media_button_container );
                }
            }
            else {
                $menu_container = $footer.find( 'ul.tweet-actions' );
                $menu_container.append( $media_button_container );
            }
        }; // end of add_media_button_to_tweet()
    
    return add_media_button_to_tweet;
} )(); // end of add_media_button_to_tweet()


function check_media_tweets( node ) {
    if ( ( ! node ) || ( node.nodeType != 1 ) ) {
        return false;
    }
    
    var $node = $( node ),
        $tweets = $( 'article[data-tweet-id]' ).filter( function () {
            return ( $( this ).find( '.' + MEDIA_BUTTON_CLASS ).length <= 0 );
        } );
    
    $tweets = $tweets.filter( function ( index ) {
        var $tweet = $( this );
        
        return add_media_button_to_tweet( $tweet );
    } );
    
    return ( 0 < $tweets.length );
} // end of check_media_tweets()



function insert_media_buttons() {
    if ( ( ! OPTIONS.IMAGE_DOWNLOAD_LINK ) && ( ! OPTIONS.VIDEO_DOWNLOAD_LINK ) ) {
        return;
    }
    check_media_tweets( d.body );
} // end of insert_media_buttons()


function start_mutation_observer() {
    new MutationObserver( function ( records ) {
        log_debug( '*** MutationObserver ***', records );
        
        update_display_mode();
        
        if ( OPTIONS.IMAGE_DOWNLOAD_LINK || OPTIONS.VIDEO_DOWNLOAD_LINK ) {
            check_media_tweets( d.body );
        }
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
    
    if ( ( ! OPTIONS.OPERATION ) || ( ! OPTIONS.ENABLED_ON_TWEETDECK ) ) {
        return;
    }
    
    var initialize_global_variables = ( callback ) => {
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
        
        }, // end of initialize_global_variables()
        
        set_user_css = () => {
            var night_mode_selector = 'body[data-nightmode="true"]',
                media_button_container_selector = '.' + MEDIA_BUTTON_CLASS,
                media_button_selector = media_button_container_selector + ' button.btn',
                night_mode_media_button_selector = night_mode_selector + ' ' + media_button_selector,
                
                css_rule_lines = [
                    media_button_container_selector + ' {display: inline-block; float: none;}',
                    media_button_selector + ' {float: none; margin: 0; padding: 0 4px; color: #aab8c2; border-color: #aab8c2; border-radius: 12px; font-size: 11px; font-weight: normal; min-height: 16px;}',
                    
                    night_mode_media_button_selector + ' {background: transparent;}',
                    night_mode_media_button_selector + ':hover{background: #183142;}',
                ];
            
            $( 'style.' + SCRIPT_NAME + '-css-rule' ).remove();
            
            insert_css( css_rule_lines.join( '\n' ) );
        
        }, // end of set_user_css()
        
        start_main = ( name_value_map ) => {
            set_user_css();
            insert_media_buttons();
            start_mutation_observer();
        }; // end of start_main()
    
    initialize_global_variables( function ( name_value_map ) {
        start_main( name_value_map );
    } );
} // end of initialize()


function main() {
    // ユーザーオプション読み込み
    w.twMediaDownloader_chrome_init( function ( user_options ) {
        initialize( user_options );
    } );
} // end of main()

//}

main(); // エントリポイント

} )( window, document );
