( function () {

var SCRIPT_NAME = 'twMediaDownloader',
    OAUTH_POPUP_WINDOW_NAME = SCRIPT_NAME + '-OAuthAuthorization'; // twMediaDownloader.user.js と合わせる

// Twitter OAuth 認証用ポップアップとして起動した場合は、Twitter.initialize() により tokens 取得用処理を実施（内部でTwitter.initializePopupWindow()を呼び出し）
// ※ユーザースクリプトでの処理（拡張機能の場合、session.jsにて実施）
Twitter.initialize( {
    popup_window_name : OAUTH_POPUP_WINDOW_NAME
} );

} )();
