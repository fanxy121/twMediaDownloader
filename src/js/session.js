( function () {

if ( /^https:\/\/twitter\.com/.test( location.href ) ) {
    return;
}

var SCRIPT_NAME = 'twMediaDownloader', // twMediaDownloader.user.js と合わせる
    OAUTH_CALLBACK_URL = 'https://nazo.furyutei.work/oauth/';

// Twitter OAuth 認証用ポップアップとして起動した場合は、Twitter.initialize() により tokens 取得用処理を実施（内部でTwitter.initializePopupWindow()を呼び出し）
// ※ユーザースクリプトでの処理（拡張機能の場合、session.jsにて実施）
Twitter.initialize( {
    callback_url : OAUTH_CALLBACK_URL,
    popup_window_name : SCRIPT_NAME + '-OAuthAuthorization'
} );

} )();
