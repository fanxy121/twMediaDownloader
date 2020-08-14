( () => {

'use strict';

var USERAGENT =  window.navigator.userAgent.toLowerCase(),
    IS_FIREFOX = ( typeof browser != 'undefined' ) || ( 0 <= USERAGENT.indexOf( 'firefox' ) );
        // TODO: GoodTwitter等を併用していると、User-Agent では判別できなくなる（"Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; AS; rv:11.0) Waterfox/56.2"のようになる）
        // → browser が定義されているかで判別

window.IS_FIREFOX = IS_FIREFOX;

} )();