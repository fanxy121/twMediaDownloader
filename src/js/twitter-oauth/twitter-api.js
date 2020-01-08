/*
twitter-api.js
==============
The MIT License (MIT)

Copyright (c) 2018 furyu <furyutei@gmail.com>

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


Required
--------
- [jQuery (>=1.5)](https://github.com/jquery/jquery)  
    [License | jQuery Foundation](https://jquery.org/license/)  
    The MIT License  

- [sha1.js](http://pajhome.org.uk/crypt/md5/sha1.html)  
    Copyright Paul Johnston 2000 - 2009
    The BSD License

- [oauth.js](http://code.google.com/p/oauth/source/browse/code/javascript/oauth.js)(^1)  
    Copyright 2008 Netflix, Inc.
    [The Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0)  
    (^1) archived: [oauth.js](https://web.archive.org/web/20130921042751/http://code.google.com/p/oauth/source/browse/code/javascript/oauth.js)  


Usage
-----
### In the web page using Twitter API

#### 1. Initialization
##### Case A) When used within User Script or Browser Extension
```JavaScript
Twitter
.initialize( {
    // Use parameters described on your [Twitter Application Management](https://apps.twitter.com/).
    consumer_key : 'Your "Consumer Key"',
    consumer_secret : 'Your "Consumer Secret"',
    callback_url : 'Your "Callback URL"',
} );
```

##### Case B) When used with the script tag of the web page
```JavaScript
Twitter
.initialize( {
    // Use parameters described on your [Twitter Application Management](https://apps.twitter.com/).
    consumer_key : 'Your "Consumer Key"',
    consumer_secret : 'Your "Consumer Secret"',
    callback_url : 'Your "Callback URL"',
    
    // Since you cannot inject scripts on pages such as [authorization page](https://api.twitter.com/oauth/*) and [login verification page](https://twitter.com/account/login_verification), 
    // disable healthcheck.
    popup_healthcheck_interval : 0,
} );
```


#### 2. Authorization
```JavaScript
Twitter
.authenticate()
.done( function ( api ) {
    // do some stuff with api
    // Example)
    //  api( 'account/verify_credentials', 'GET' )
    //  .done( function( result ) {
    //       console.log( result );
    //  } );
} )
.fail( function( error ){
    // do some stuff with error string
    // Example)
    //  if ( /refused/i.test( error ) ) {
    //      console.log( 'Authorization refused by user' )
    //  }
    //  else {
    //      console.error( error );
    //  }
});
```

### In the popup window ([authorization page](https://api.twitter.com/oauth/*), [login verification page](https://twitter.com/account/login_verification) and your callback page)

```JavaScript
Twitter.initialize();
```

References
----------
This script is based on  

- [chrome-extension-twitter-oauth-example/twitter.js](https://github.com/lambtron/chrome-extension-twitter-oauth-example/blob/master/js/lib/twitter.js)  
    Copyright (c) 2017 Andy Jiang  
    The MIT Licence  

and  

- [oauth-js/oauth.js](https://github.com/oauth-io/oauth-js/blob/master/dist/oauth.js) 
    The Apache2 License

is also referenced.  


*/

( function () {

'use strict';

( function ( factory ) {
    if ( ( typeof define == 'function' ) && ( define.amd ) ) {
        // AMD. Register as anonymous module.
        define( [], factory );
    }
    else if ( ( typeof exports == 'object' ) && ( typeof module != 'undefined' ) ) {
        // CommonJS
        module.exports = factory();
    }
    else {
        // Browser globals.
        var global_object;
        
        if ( typeof window != 'undefined' ) {
            global_object = window;
        }
        else if ( typeof global != 'undefined' ) {
            global_object = global;
        }
        else if ( typeof self != 'undefined' ) {
            global_object = self;
        }
        else {
            global_object = this;
        }
        
        global_object.Twitter = factory();
    }
} )( function () {

if ( ( typeof browser == 'undefined' ) && ( typeof window != 'undefined' ) ) {
    window.browser = ( typeof chrome != 'undefined' ) ? chrome : null;
}

var DEBUG = false,
    SCRIPT_NAME = 'twitter-api',
    USERAGENT =  window.navigator.userAgent.toLowerCase(),
    IS_FIREFOX = ( window.IS_FIREFOX ) || ( 0 <= USERAGENT.indexOf( 'firefox' ) );


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
    
    console.log.apply( console, arg_list.concat( Array.from( arguments ) ) );
} // end of log_debug()


function log_info() {
    var arg_list = [ '[' + SCRIPT_NAME + ']', '(' + ( new Date().toISOString() ) + ')' ];
    
    console.info.apply( console, arg_list.concat( Array.from( arguments ) ) );
} // end of log_info()


function log_error() {
    var arg_list = [ '[' + SCRIPT_NAME + ']', '(' + ( new Date().toISOString() ) + ')' ];
    
    console.error.apply( console, arg_list.concat( Array.from( arguments ) ) );
} // end of log_error()


var set_values = ( function () {
        if ( browser &&  browser.storage ) {
            return function ( name_value_map, callback ) {
                var $deferred = new $.Deferred(),
                    $promise = $deferred.promise();
                
                browser.storage.local.set( name_value_map, function () {
                    if ( typeof callback == 'function' ) {
                        $deferred
                        .done( function () {
                            callback();
                        } );
                    }
                    $deferred.resolve();
                } );
                
                return $promise;
            };
        }
        
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
        
        return function ( name_value_map, callback ) {
            var $deferred = new $.Deferred(),
                $promise = $deferred.promise();
            
            Object.keys( name_value_map ).forEach( function ( name ) {
                set_value( name, name_value_map[ name ] );
            } );
            
            if ( typeof callback == 'function' ) {
                $deferred
                .done( function () {
                    callback();
                } );
            }
            
            $deferred.resolve();
            
            return $promise;
        };
    } )(), // end of set_values()
    
    get_values = ( function () {
        if ( browser &&  browser.storage ) {
            return function ( name_list, callback ) {
                var $deferred = new $.Deferred(),
                    $promise = $deferred.promise();
                
                if ( typeof name_list == 'string' ) {
                    name_list = [ name_list ];
                }
                
                browser.storage.local.get( name_list, function ( name_value_map ) {
                    name_list.forEach( function ( name ) {
                        if ( name_value_map[ name ] === undefined ) {
                            name_value_map[ name ] = null;
                        }
                    } );
                    
                    if ( typeof callback == 'function' ) {
                        $deferred
                        .done( function () {
                            callback( name_value_map );
                        } );
                    }
                    
                    $deferred.resolve( name_value_map );
                } );
                
                return $promise;
            };
        }
        
        var get_value = ( function () {
            if ( typeof GM_getValue != 'undefined' ) {
                return function ( name ) {
                    var value = GM_getValue( name );
                    
                    return ( value === undefined ) ? null : value;
                };
            }
            return function ( name ) {
                return localStorage.getItem( name );
            };
        } )(); // end of get_value()
        
        return function ( name_list, callback ) {
            var $deferred = new $.Deferred(),
                $promise = $deferred.promise(),
                name_value_map = {};
            
            if ( typeof name_list == 'string' ) {
                name_list = [ name_list ];
            }
            
            name_list.forEach( function ( name ) {
                name_value_map[ name ] = get_value( name );
            } );
            
            if ( typeof callback == 'function' ) {
                $deferred
                .done( function () {
                    callback( name_value_map );
                } );
            }
            
            $deferred.resolve( name_value_map );
            
            return $promise;
        };
    } )(), // end of get_values()
    
    remove_values = ( function () {
        if ( browser &&  browser.storage ) {
            return function ( name_list, callback ) {
                var $deferred = new $.Deferred(),
                    $promise = $deferred.promise();
                
                if ( typeof name_list == 'string' ) {
                    name_list = [ name_list ];
                }
                
                browser.storage.local.remove( name_list, function () {
                    if ( typeof callback == 'function' ) {
                        $deferred
                        .done( function () {
                            callback();
                        } );
                    }
                    
                    $deferred.resolve();
                } );
                
                return $promise;
            };
        }
        
        var remove_value = ( function () {
            if ( typeof GM_deleteValue != 'undefined' ) {
                return function ( name ) {
                    return GM_deleteValue( name );
                };
            }
            return function ( name ) {
                return localStorage.removeItem( name );
            };
        } )(); // end of remove_value()
        
        return function ( name_list,  callback ) {
            var $deferred = new $.Deferred(),
                $promise = $deferred.promise();
            
            if ( typeof name_list == 'string' ) {
                name_list = [ name_list ];
            }
            
            name_list.forEach( function ( name ) {
                remove_value( name );
            } );
            
            if ( typeof callback == 'function' ) {
                if ( typeof callback == 'function' ) {
                    $deferred
                    .done( function () {
                        callback();
                    } );
                }
            }
            
            $deferred.resolve();
            
            return $promise;
        };
    } )(), // end of remove_values()
    
    object_extender = ( function () {
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
    } )(), // end of object_extender()
    
    get_origin = function ( url ) {
        try {
            return new URL( url ).origin;
        }
        catch ( error ) {
            log_error( 'get_origin()', url, error );
            return 'https://api.twitter.com';
        }
    }; // end of get_origin()


var TemplateTwitterAPI = {
    version : '0.1.2',
    
    config : {
        api_version : '1.1',
        api_url_base : 'https://api.twitter.com',
        login_verification_url : 'https://twitter.com/account/login_verification',
        
        consumer_key : '',
        consumer_secret : '',
        callback_url : '',
        
        screen_name : '', // binded to oauth_token / oauth_token_secret
        
        oauth_token : '',
        oauth_token_secret : '',
        
        popup_window_name : 'OAuthAuthorization',
        
        use_cache : true,
        auto_reauth : true,
        use_separate_popup_window : true,
        user_specified_window : null,
        
        popup_closecheck_interval : 100, // milliseconds (0: disabled)
        popup_initial_timeout : 30000, // milliseconds (0: disabled)
        popup_healthcheck_interval : 3000, // milliseconds (0: disabled and ignore popup_initial_timeout)
    },
    
    popup_info : null,
    
    current_user : {
        user_id : '',
        screen_name : ''
    },
    
    initialize : function ( params ) {
        var self = this;
        
        if ( ! params ) {
            params = {};
        }
        
        Object.keys( self.config ).forEach( function ( name ) {
            if ( typeof params[ name ] != 'undefined' ) {
                self.config[ name ] = params[ name ];
            }
        } );
        
        self.popup_info = self.getPopupInfo();
        
        if ( self.popup_info ) {
            self.initializePopupWindow();
        }
        
        return self;
    }, // end of initialize()
    
    
    authenticate : function ( options ) {
        var self = this,
            $deferred = new $.Deferred(),
            $promise = $deferred.promise();
        
        if ( ! options ) {
            options = {};
        }
        
        var force_login = ( typeof options.force_login != 'undefined' ) ? options.force_login : false,
            use_cache = ( ( ! force_login ) && ( typeof options.use_cache != 'undefined' ) ) ? options.use_cache : self.config.use_cache,
            
            popup = function () {
                var post_parameters = {
                        parameters : {
                            oauth_callback : self.config.callback_url
                        },
                        api_options : {
                            auto_reauth : false
                        }
                    };
                
                self.config.oauth_token_secret = '';
                self.config.oauth_token = '';
                self.current_user = {
                    user_id : '',
                    screen_name : ''
                };
                
                self.api( 'oauth/request_token', 'POST', post_parameters )
                .done( function ( response ) {
                    var params = self.deparam( response );
                    
                    self.config.oauth_token_secret = params.oauth_token_secret;
                    self.config.oauth_token = params.oauth_token;
                    
                    set_values( {
                        oauth_token_secret : '',
                        oauth_token : '',
                        type : '',
                        session : ''
                    } )
                    .done(  function () {
                        var popup_window_width = Math.floor( window.outerWidth * 0.8 ),
                            popup_window_height = Math.floor( window.outerHeight * 0.5 ),
                            popup_window_top = 0,
                            popup_window_left = 0;
                            
                        
                        if ( popup_window_width < 1000 ) {
                            popup_window_width = 1000;
                        }
                        
                        if ( popup_window_height < 700 ) {
                            popup_window_height = 700;
                        }
                        
                        popup_window_top = Math.floor( window.screenY + ( window.outerHeight - popup_window_height ) / 8 );
                        popup_window_left = Math.floor( window.screenX + ( window.outerWidth - popup_window_width ) / 2 );
                        
                        var authenticate_params = {
                                oauth_token : self.config.oauth_token
                            };
                        
                        if ( force_login ) {
                            authenticate_params.force_login = 'true';
                        }
                        
                        if ( self.config.screen_name ) {
                            authenticate_params.screen_name = self.config.screen_name;
                        }
                        
                        var initial_popup_url = self.config.api_url_base + '/oauth/authenticate?' + Object.keys( authenticate_params ).map( function ( name ) {
                                    return name + '=' + encodeURIComponent( authenticate_params[ name ] );
                                } ).join( '&' ),
                            parent_origin = get_origin( location.href ),
                            popup_origin_api = get_origin( self.config.api_url_base ),
                            popup_origin_login_verification = get_origin( self.config.login_verification_url ),
                            popup_origin_callback = get_origin( self.config.callback_url ),
                            popup_window_name = self.config.popup_window_name + '.' + JSON.stringify( {
                                parent_origin : parent_origin,
                                callback_url : self.config.callback_url
                            } ),
                            popup_window_option = ( self.config.use_separate_popup_window ) ? [
                                'width=' + popup_window_width,
                                'height=' + popup_window_height,
                                'top=' + popup_window_top,
                                'left=' + popup_window_left,
                                'toolbar=0,scrollbars=1,status=1,resizable=1,location=1,menuBar=0'
                            ].join( ',' ) : null,
                            
                            popup_window = ( function () {
                                if ( ! self.config.user_specified_window ) {
                                    return window.open( initial_popup_url, popup_window_name, popup_window_option );
                                }
                                
                                var popup_window = self.config.user_specified_window;
                                
                                try {
                                    popup_window.name = popup_window_name;
                                }
                                catch ( error ) {
                                    log_error( 'popup window name is not changed: ', error );
                                }
                                
                                popup_window.location.href = initial_popup_url;
                                
                                return popup_window;
                            } )(),
                            
                            initial_timeout_timer_id = ( self.config.popup_initial_timeout && self.config.popup_healthcheck_interval ) ? setTimeout( function () {
                                log_error( new Date().toISOString(), 'connection timeout' );
                                finish();
                            }, self.config.popup_initial_timeout ) : null,
                            
                            closecheck_timer_id = ( self.config.popup_closecheck_interval ) ? setInterval( function () {
                                try {
                                    if ( popup_window.closed ) {
                                        log_error( new Date().toISOString(), 'popup window closed' );
                                        finish();
                                        return;
                                    }
                                }
                                catch ( error ) {
                                }
                            }, self.config.popup_closecheck_interval ) : null,
                            
                            healthcheck_timer_id = null,
                            healthcheck_counter = 0,
                            last_healthcheck_counter = 0,
                            
                            message_handler = function ( event ) {
                                if ( ( event.origin != popup_origin_api ) && ( event.origin != popup_origin_login_verification ) && ( event.origin != popup_origin_callback ) ) {
                                    log_error( new Date().toISOString(), 'origin error:', event.origin );
                                    return;
                                }
                                
                                var message = event.data;
                                
                                switch ( message.type ) {
                                    case 'NOTIFICATION' :
                                        if ( ! initial_timeout_timer_id ) {
                                            healthcheck_counter ++;
                                            break;
                                        }
                                        
                                        clearTimeout( initial_timeout_timer_id );
                                        initial_timeout_timer_id = null;
                                        
                                        healthcheck_timer_id = ( self.config.popup_healthcheck_interval ) ? setInterval( function () {
                                            healthcheck_handler();
                                        }, self.config.popup_healthcheck_interval ) : null;
                                        break;
                                    
                                    case 'AUTH_RESULT' :
                                        popup_window.postMessage( {
                                            type : 'CLOSE_REQUEST'
                                        }, popup_origin_callback );
                                        
                                        finish( message.value.session );
                                        break;
                                    
                                    default :
                                        log_debug( new Date().toISOString(), 'message error:', message );
                                        return;
                                }
                            },
                            
                            healthcheck_handler = function () {
                                if ( healthcheck_counter == last_healthcheck_counter ) {
                                    log_error( new Date().toISOString(), 'healthcheck timeout' );
                                    finish();
                                    return;
                                }
                                
                                last_healthcheck_counter = healthcheck_counter;
                            },
                            
                            finish = function ( session ) {
                                window.removeEventListener( 'message', message_handler );
                                
                                if ( initial_timeout_timer_id ) {
                                    clearTimeout( initial_timeout_timer_id );
                                    initial_timeout_timer_id = null;
                                }
                                
                                if ( closecheck_timer_id ) {
                                    clearInterval( closecheck_timer_id );
                                    closecheck_timer_id = null;
                                }
                                
                                if ( healthcheck_timer_id ) {
                                    clearInterval( healthcheck_timer_id );
                                    healthcheck_timer_id = null;
                                }
                                
                                if ( ! session ) {
                                    $deferred.reject( 'Authorization failure (process interrupted)' );
                                    return;
                                }
                                
                                var session_params = self.deparam( session );
                                
                                if ( typeof session_params.denied != 'undefined' ) {
                                    $deferred.reject( 'Authorization refused', session_params );
                                    return;
                                }
                                
                                // Get access tokens again.
                                post_parameters = {
                                    parameters : session_params,
                                    api_options : {
                                        auto_reauth : false
                                    }
                                };
                                
                                self.api( 'oauth/access_token', 'POST', post_parameters )
                                .done( function ( result ) {
                                    var tokens = self.deparam( result );
                                    
                                    self.setOAuthTokens( tokens )
                                    .done( function () {
                                        $deferred.resolve( function () {
                                            return self.api.apply( self, arguments );
                                        } );
                                    } )
                                    .fail( function ( error ) {
                                        $deferred.reject( 'Authorization failure (oauth/access_token) : ' + error, tokens );
                                    } );
                                } )
                                .fail( function ( result ) {
                                    $deferred.reject( 'Authorization failure (oauth/access_token)', session_params );
                                } );
                            };
                        
                        window.addEventListener( 'message', message_handler );
                    } );
                } )
                .fail( function ( result ) {
                    $deferred.reject( 'Authorization failure (oauth/request_token)', post_parameters.parameters );
                } );
            };
            
        
        if ( use_cache ) {
            self.isAuthenticated()
            .done( function ( api, result ) {
                $deferred.resolve( api );
            } )
            .fail( function ( result ) {
                popup();
            } );
        }
        else {
            popup();
        }
        
        return $promise;
    }, // end of authenticate()
    
    
    logout : function ( callback ) {
        var self = this,
            $deferred = new $.Deferred(),
            $promise = $deferred.promise(),
            name_suffix = ( self.config.screen_name ) ? ( '.' + self.config.screen_name ) : '';
        
        self.config.oauth_token = '';
        self.config.oauth_token_secret = '';
        
        get_values( [
            'oauth_screen_name',
        ] )
        .done ( ( cached_values ) => {
            var remove_keys = [ 'oauth_token' + name_suffix, 'oauth_token_secret' + name_suffix, 'oauth_user_id' + name_suffix, 'oauth_screen_name' + name_suffix ];
            
            if ( cached_values.oauth_screen_name == self.config.screen_name ) {
                remove_keys = remove_keys.concat( [ 'oauth_token', 'oauth_token_secret', 'oauth_user_id', 'oauth_screen_name' ] );
            }
            
            remove_values( remove_keys )
            .done( function () {
                if ( typeof callback == 'function' ) {
                    $deferred
                    .done( function () {
                        callback();
                    } );
                }
                
                $deferred.resolve();
            } );
        } );
        
        return $promise;
    }, // end of logout()
    
    
    getCachedTokens : function ( callback ) {
        var self = this,
            $deferred = new $.Deferred(),
            $promise = $deferred.promise(),
            name_suffix = ( self.config.screen_name ) ? ( '.' + self.config.screen_name ) : '';
        
        get_values( [
            'oauth_token' + name_suffix,
            'oauth_token_secret' + name_suffix,
            'oauth_user_id' + name_suffix,
            'oauth_screen_name' + name_suffix,
            'oauth_token',
            'oauth_token_secret',
            'oauth_user_id',
            'oauth_screen_name',
        ] )
        .done( function ( tokens ) {
            if ( name_suffix && ( ! tokens[ 'oauth_screen_name' + name_suffix ] ) && ( tokens[ 'oauth_screen_name' ] == self.config.screen_name ) ) {
                Object.assign( tokens, {
                    [ 'oauth_token' + name_suffix ] : tokens[ 'oauth_token' ],
                    [ 'oauth_token_secret' + name_suffix ] : tokens[ 'oauth_token_secret' ],
                    [ 'oauth_user_id' + name_suffix ] : tokens[ 'oauth_user_id' ],
                    [ 'oauth_screen_name' + name_suffix ] : tokens[ 'oauth_screen_name' ],
                } );
            }
            if ( typeof callback == 'function' ) {
                $deferred
                .done( function () {
                    callback( tokens );
                } );
            }
            
            $deferred.resolve( tokens );
        } );
        
        return $promise;
    }, // end of getCachedTokens()
    
    
    isLoggedIn : function ( callback ) {
        var self = this;
        
        return self.getCachedTokens( callback );
    }, // end of isLoggedIn()
    
    
    isAuthenticated : function () {
        var self = this,
            $deferred = new $.Deferred(),
            $promise = $deferred.promise(),
            name_suffix = ( self.config.screen_name ) ? ( '.' + self.config.screen_name ) : '';
        
        self.getCachedTokens()
        .done( function ( tokens ) {
            var oauth_token = tokens[ 'oauth_token' + name_suffix ],
                oauth_token_secret = tokens[ 'oauth_token_secret' + name_suffix ],
                oauth_user_id = tokens[ 'oauth_user_id' + name_suffix ],
                oauth_screen_name = tokens[ 'oauth_screen_name' + name_suffix ];
            
            if ( ( ! oauth_token ) || ( ! oauth_token_secret ) ) {
                $deferred.reject( 'tokens not found' );
                return;
            }
            
            self.config.oauth_token = oauth_token;
            self.config.oauth_token_secret = oauth_token_secret;
            
            self.current_user = {
                user_id : oauth_user_id,
                screen_name : oauth_screen_name
            };
            
            self.api( 'account/verify_credentials', 'GET', {
                api_options : {
                    auto_reauth : false
                }
            } )
            .done( function ( json ) {
                if ( ( self.config.screen_name ) && ( self.config.screen_name != json.screen_name ) ) {
                    $deferred.reject( 'screen_name mismatch' );
                    return;
                }
                
                $deferred.resolve( function () {
                    return self.api.apply( self, arguments );
                }, json );
            } )
            .fail( function () {
                self.logout()
                .done( function () {
                    $deferred.reject( 'invalid tokens' );
                } );
            } );
        } );
        
        return $promise;
    }, // end of isAuthenticated()
    
    
    setOAuthTokens : function ( tokens, callback ) {
        var self = this,
            $deferred = new $.Deferred(),
            $promise = $deferred.promise(),
            callback_result = 'OK';
        
        if ( ( self.config.screen_name ) && ( self.config.screen_name != tokens.screen_name ) ) {
            callback_result = 'screen_name mismatch';
            
            if ( typeof callback == 'function' ) {
                $deferred.fail( function () {
                    callback( callback_result );
                } );
            }
            
            $deferred.reject( callback_result );
            
            return $promise;
        }
        
        var name_suffix = ( self.config.screen_name ) ? ( '.' + self.config.screen_name ) : '',
            tokens_to_save = {
                [ 'oauth_token' + name_suffix ] : tokens.oauth_token,
                [ 'oauth_token_secret' + name_suffix ] : tokens.oauth_token_secret,
                [ 'oauth_user_id' + name_suffix ] : tokens.user_id,
                [ 'oauth_screen_name' + name_suffix ] : tokens.screen_name
            },
            name_suffix_to_save;
        
        if ( ! self.config.screen_name ) {
            name_suffix_to_save = '.' + tokens.screen_name;
            
            Object.assign( tokens_to_save, {
                [ 'oauth_token' + name_suffix_to_save ] : tokens.oauth_token,
                [ 'oauth_token_secret' + name_suffix_to_save ] : tokens.oauth_token_secret,
                [ 'oauth_user_id' + name_suffix_to_save ] : tokens.user_id,
                [ 'oauth_screen_name' + name_suffix_to_save ] : tokens.screen_name
            } );
        }
        
        self.config.oauth_token = tokens.oauth_token;
        self.config.oauth_token_secret = tokens.oauth_token_secret;
        
        self.current_user = {
            user_id : tokens.user_id,
            screen_name : tokens.screen_name
        };
        
        set_values( tokens_to_save )
        .done( function () {
            if ( typeof callback == 'function' ) {
                $deferred.done( function () {
                    callback( callback_result );
                } );
            }
            
            $deferred.resolve( callback_result );
        } );
        
        return $promise;
    }, // end of setOAuthTokens()
    
    
    getCurrentUser : function () {
        var self = this;
        
        return self.current_user;
    }, // end of getCurrentUser()
    
    
    getCachedUser : function ( callback ) {
        var self = this,
            $deferred = new $.Deferred(),
            $promise = $deferred.promise(),
            name_suffix = ( self.config.screen_name ) ? ( '.' + self.config.screen_name ) : '';
        
        self.getCachedTokens()
        .done( function ( tokens ) {
            var oauth_user_id = tokens[ 'oauth_user_id' + name_suffix ],
                oauth_screen_name = tokens[ 'oauth_screen_name' + name_suffix ];
            
            $deferred.resolve( {
                user_id : oauth_user_id,
                screen_name : oauth_screen_name
            } );
        } );
        
        return $promise;
    }, // end of getCachedUser()
    
    
    api : function ( path ) { // ( path, params, callback )
        var self = this,
            $deferred = new $.Deferred(),
            $promise = $deferred.promise(),
            api_arguments = arguments,
            args = Array.prototype.slice.call( api_arguments, 1 ),
            path_parts = path.replace( /#.*$/, '' ).split( '?' ),
            callback = null,
            params = {},
            method = 'GET',
            api_options = {
                auto_reauth : self.config.auto_reauth
            };
        
        path = path_parts[ 0 ].replace( /^https?:\/\/[^\/]+/, '' );
        
        if ( path.charAt( 0 ) != '/' ) {
            path = '/' + path;
        }
        
        // Add API version and .json if its not an authorization request
        if ( ! /^\/oauth/.test( path ) ) {
            if ( ! /^\/[\d.]+\//.test( path ) ) {
                path = '/' + self.config.api_version + path;
            }
            
            if ( ! /\.json$/.test( path ) ) {
                path = path + '.json';
            }
        }
        
        if ( 1 < path_parts.length ) {
            params = self.deparam( path_parts[ 1 ] );
        }
        
        // Parse arguments to their appropriate position
        args.forEach( function ( arg ) {
            switch ( typeof arg ) {
                case 'function' :
                    callback = arg;
                    break;
                
                case 'object' :
                    Object.keys( arg ).forEach( function ( key ) {
                        var value = arg[ key ];
                        
                        switch ( typeof value ) {
                            case 'object' :
                                if ( key == 'api_options' ) {
                                    Object.keys( value ).forEach( function ( option_name ) {
                                        var option_value = value[ option_name ];
                                        
                                        if ( typeof option_value == 'undefined' ) {
                                            return;
                                        }
                                        
                                        switch ( option_name ) {
                                            case 'auto_reauth' :
                                                api_options.auto_reauth = option_value;
                                                return;
                                        }
                                    } );
                                }
                                else if ( key == 'parameters' ) {
                                    Object.keys( value ).forEach( function ( param_key ) {
                                        var param_value = value[ param_key ];
                                        
                                        if ( typeof param_value != 'undefined' ) {
                                            params[ param_key ] = param_value;
                                        }
                                    } );
                                }
                                return;
                            
                            case 'string' :
                                params[ key ] = value;
                                return;
                        }
                    } );
                    break;
                
                case 'string' :
                    method = arg.toUpperCase();
                    break;
            }
        } );
        
        // Add an oauth token if it is an api request
        if ( self.config.oauth_token ) {
            params.oauth_token = self.config.oauth_token;
        }
        
        var accessor = {
                consumerSecret : self.config.consumer_secret,
                tokenSecret : self.config.oauth_token_secret
            },
            message = {
                action : self.config.api_url_base + path,
                method : method,
                parameters : [ [ 'oauth_consumer_key', self.config.consumer_key ], [ 'oauth_signature_method', 'HMAC-SHA1' ] ]
            };
        
        Object.keys( params ).forEach( function ( key ) {
            OAuth.setParameter( message, key, params[ key ] );
        } );
        
        OAuth.completeRequest( message, accessor );
        
        var parameter_map = OAuth.getParameterMap( message.parameters ),
            query = Object.keys( parameter_map ).map( function ( key ) {
                return key + '=' + OAuth.percentEncode( parameter_map[ key ] );
            } ).join( '&' );
        
        if ( 
            ( ! ( window.is_chrome_extension || window.is_web_extension ) ) ||
            IS_FIREFOX ||
            method.toLowerCase() != 'get' ||
            ( ! /\.json$/.test( path ) )
        ) {
            $[ method.toLowerCase() ]( self.config.api_url_base + path, query )
            .done( function ( data, textStatus, jqXHR ) {
                if ( typeof callback == 'function' ) {
                    callback.apply( self, arguments );
                }
                $deferred.resolve.apply( $deferred, arguments );
            } )
            .fail( function ( jqXHR, textStatus, errorThrown ) {
                var fail_arguments = arguments;
                
                if ( ! api_options.auto_reauth ) {
                    $deferred.reject.apply( $deferred, fail_arguments );
                    return;
                }
                
                if ( jqXHR && jqXHR.responseText && /(?:[{,]\s*"code"\s*:\s*89\s*[,}]|(?:invalid|expired).*?token)/i.test( jqXHR.responseText ) ) {
                    // {"errors":[{"code":89, "message":"Invalid or expired token."}]}
                    
                    self.logout( function () {
                        self.authenticate()
                        .done( function () {
                            self.api.apply( self, api_arguments )
                            .then( $deferred.resolve );
                        } )
                        .fail( function () {
                            $deferred.reject.apply( $deferred, fail_arguments );
                        } );
                    } );
                    
                    return;
                }
                $deferred.reject.apply( $deferred, fail_arguments );
            } );
            
            return $promise;
        }
        
        browser.runtime.sendMessage( {
            type : 'FETCH_JSON',
            url : self.config.api_url_base + path + '?' + query,
            options : {
                method : 'GET',
                mode: 'cors',
                credentials: 'include',
            },
        }, function ( response ) {
            log_debug( 'FETCH_JSON => response', response );
            
            if ( response.error ) {
                $deferred.reject( { status : response.error, statusText : '' }, 'fetch error' );
                return;
            }
            
            $deferred.resolve( response.json, '', {} );
        } );
        
        return $promise;
    }, // end of api()
    
    
    deparam : function ( query ) {
        var self = this,
            params = {};
        
        if ( ! query ) {
            return params;
        }
        
        query.split( '&' ).forEach( function ( param ) {
            var parts = param.split( '=' );
            
            params[ parts[ 0 ] ] = OAuth.decodePercent( parts[ 1 ] );
        } );
        
        return params;
    }, // end of deparam()
    
    
    getPopupInfo : function () {
        var self = this;
        
        if ( ( ! window.opener ) || ( ! window.name ) || ( ! window.name.match( /^([^.]+)\.(.*?)$/ ) ) ) {
            return null;
        }
        else {
            var popup_window_name = RegExp.$1,
                popup_info_json_string = RegExp.$2;
            
            if ( popup_window_name != self.config.popup_window_name ) {
                return null;
            }
            
            var popup_info;
            
            try {
                popup_info = JSON.parse( popup_info_json_string );
                
                if ( ! popup_info ) {
                    return null;
                }
            }
            catch ( error ) {
                return null;
            }
            
            return popup_info;
        }
    }, // end of getPopupInfo()
    
    
    initializePopupWindow : function () {
        var self = this,
            api_url_base = self.config.api_url_base,
            login_verification_url = self.config.login_verification_url,
            parent_window = window.opener,
            parent_origin = self.popup_info.parent_origin,
            callback_url = self.popup_info.callback_url,
            healthcheck_timer_id;
        
        if ( callback_url && ( location.href.indexOf( callback_url ) == 0 ) ) {
            parent_window.postMessage( {
                type : 'AUTH_RESULT',
                value : {
                    session : location.search.substr( 1 )
                }
            }, parent_origin );
        }
        else if ( ( api_url_base && ( location.href.indexOf( api_url_base ) == 0 ) ) || ( login_verification_url && location.href.indexOf( login_verification_url ) == 0 ) ) {
            healthcheck_timer_id = setInterval( function () {
                parent_window.postMessage( {
                    type : 'NOTIFICATION',
                    value : {
                        status : 'alive'
                    }
                }, parent_origin );
            }, 100 );
        }
        else {
            return self;
        }
        
        window.addEventListener( 'message', function ( event ) {
            if ( event.origin != parent_origin ) {
                log_error( new Date().toISOString(), 'origin error:', event.origin, event );
                return;
            }
            
            var message = event.data;
            
            switch ( message.type ) {
                case 'CLOSE_REQUEST' :
                    if ( healthcheck_timer_id ) {
                        clearInterval( healthcheck_timer_id );
                    }
                    healthcheck_timer_id = null;
                    
                    window.open( '', '_self', '' );
                    window.close();
                    break;
                
                default :
                    log_debug( new Date().toISOString(), 'message error:', message, event );
                    return;
            }
        } );
        
        parent_window.postMessage( {
            type : 'NOTIFICATION',
            value : {
                status : 'alive'
            }
        }, parent_origin );
        
        return self;
    } // end of initializePopupWindow()
    
}; // end of TemplateTwitterAPI

return object_extender( TemplateTwitterAPI );

} );

} )();
