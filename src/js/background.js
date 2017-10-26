chrome.webRequest.onBeforeSendHeaders.addListener(
    function ( details ) {
        var requestHeaders = details.requestHeaders.filter( function ( element, index, array ) {
                return ( element.name.toLowerCase() != 'cookie' );
            } );
        
        return { requestHeaders: requestHeaders };
    }
,   { urls : [ '*://api.twitter.com/oauth2/token' ] }
,   [ 'blocking', 'requestHeaders' ]
);
