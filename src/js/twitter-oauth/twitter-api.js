/*
This script is based on  
> [chrome-extension-twitter-oauth-example/twitter.js](https://github.com/lambtron/chrome-extension-twitter-oauth-example/blob/master/js/lib/twitter.js)  
and  
> [oauth-js/oauth.js](https://github.com/oauth-io/oauth-js/blob/master/dist/oauth.js) 
is also referenced.  
*/


/*
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
*/


( function () {

'use strict';

if ( typeof browser == 'undefined' ) { window.browser = ( typeof chrome != 'undefined' ) ? chrome : null; }

var based = ( typeof exports != 'undefined' ) ? exports : window,
    
    set_values = ( function () {
        if ( browser &&  browser.storage ) {
            return function ( name_value_map, callback ) {
                browser.storage.local.set( name_value_map, function () {
                    if ( typeof callback == 'function' ) {
                        callback();
                    }
                } );
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
            Object.keys( name_value_map ).forEach( function ( name ) {
                set_value( name, name_value_map[ name ] );
            } );
            
            if ( typeof callback == 'function' ) {
                callback();
            }
        };
    } )(), // end of set_values()
    
    get_values = ( function () {
        if ( browser &&  browser.storage ) {
            return function ( name_list, callback ) {
                if ( typeof name_list == 'string' ) {
                    name_list = [ name_list ];
                }
                
                browser.storage.local.get( name_list, function ( name_value_map ) {
                    name_list.forEach( function ( name ) {
                        if ( name_value_map[ name ] === undefined ) {
                            name_value_map[ name ] = null;
                        }
                    } );
                    
                    callback( name_value_map );
                } );
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
            var name_value_map = {};
            
            name_list.forEach( function ( name ) {
                name_value_map[ name ] = get_value( name );
            } );
            callback( name_value_map );
        };
    } )(), // end of get_values()
    
    remove_values = ( function () {
        if ( browser &&  browser.storage ) {
            return function ( name_list, callback ) {
                if ( typeof name_list == 'string' ) {
                    name_list = [ name_list ];
                }
                
                browser.storage.local.remove( name_list, function () {
                    if ( typeof callback == 'function' ) {
                        callback();
                    }
                } );
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
        
        return function ( name_value_map, callback ) {
            Object.keys( name_value_map ).forEach( function ( name ) {
                remove_value( name );
            } );
            
            if ( typeof callback == 'function' ) {
                callback();
            }
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
    } )(); // end of object_extender()


var TemplateTwitterAPI = {
    API_URL : 'https://api.twitter.com',
    API_VERSION : '1.1',
    API_WINDOW_NAME : 'OAuthAuthorization',
    
    callback_url : '',
    
    consumer_key : '',
    consumer_secret : '',
    
    oauth_token : '',
    oauth_token_secret : '',
    
    config : {
        use_cache : true,
        auto_reauth : true,
        use_separate_popup_window : true,
        popup_check_interval : 100,
        popup_check_timeout : 3000
    },
    
    initialize : function ( params ) {
        var self = this;
        
        if ( ! params ) {
            params = {};
        }
        
        [ 'consumer_key', 'consumer_secret', 'oauth_token', 'oauth_token_secret', 'callback_url' ].forEach( function ( name ) {
            if ( typeof params[ name ] != 'undefined' ) {
                self[ name ] = params[ name ];
            }
        } );
        
        Object.keys( self.config ).forEach( function ( name ) {
            if ( typeof params[ name ] != 'undefined' ) {
                self.config[ name ] = params[ name ];
            }
        } );
        
        return self;
    }, // end of initialize()
    
    authenticate : function ( options ) {
        var self = this,
            $deferred = new $.Deferred(),
            
            popup = function () {
                self.oauth_token_secret = '';
                self.oauth_token = '';
                
                self.api( 'oauth/request_token', 'POST', { twauth_auto_reauth : false } )
                .done( function ( response ) {
                    var params = self.deparam( response ),
                        healthcheck_counter = 0,
                        check_interval = self.config.popup_check_interval,
                        remain_time = self.config.popup_check_timeout;
                    
                    self.oauth_token_secret = params.oauth_token_secret;
                    self.oauth_token = params.oauth_token;
                    
                    set_values( {
                        oauth_token_secret : '',
                        oauth_token : '',
                        type : '',
                        session : '',
                        callback_url : self.callback_url,
                        healthcheck_counter : healthcheck_counter
                    }, function () {
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
                        
                        var url = self.API_URL + '/oauth/authenticate?oauth_token=' + self.oauth_token,
                            popup_window_option = ( self.config.use_separate_popup_window ) ? [
                                'width=' + popup_window_width,
                                'height=' + popup_window_height,
                                'top=' + popup_window_top,
                                'left=' + popup_window_left,
                                'toolbar=0,scrollbars=1,status=1,resizable=1,location=1,menuBar=0'
                            ].join( ',' ) : null,
                            
                            popup_window = window.open( url, self.API_WINDOW_NAME, popup_window_option ),
                            
                            watch_popup_timer_id = setInterval( function () {
                                try {
                                    if ( ! popup_window.closed ) { // "TypeError: no access" may occur depending on the situation
                                        return;
                                    }
                                    
                                    clearInterval( watch_popup_timer_id );
                                    finish();
                                    return;
                                }
                                catch ( error ) {
                                }
                                
                                remain_time -= check_interval;
                                
                                if ( remain_time <= 0 ) {
                                    get_values( [ 'healthcheck_counter' ], function ( params ) {
                                        var healthcheck_counter_updated = parseInt( params.healthcheck_counter, 10 );
                                        
                                        if ( isNaN( healthcheck_counter_updated ) ) {
                                            healthcheck_counter_updated = 0;
                                        }
                                        
                                        if ( healthcheck_counter < healthcheck_counter_updated ) {
                                            healthcheck_counter = healthcheck_counter_updated;
                                            remain_time = self.config.popup_check_timeout;
                                            return;
                                        }
                                        
                                        clearInterval( watch_popup_timer_id );
                                        finish();
                                    } );
                                }
                            }, self.config.popup_check_interval );
                    } );
                } )
                .fail( function ( result ) {
                    $deferred.reject( 'Authorization failure (oauth/request_token)' );
                } );
            },
            
            finish = function () {
                get_values( [ 'type', 'session' ], function ( params ) {
                    if ( ( params.type != 'auth' ) || ( ! params.session ) ) {
                        $deferred.reject( 'Authorization failure' );
                        return;
                    }
                    
                    var session_params = self.deparam( params.session );
                    
                    if ( typeof session_params.denied != 'undefined' ) {
                        $deferred.reject( 'Authorization refused' );
                        return;
                    }
                    
                    // Get access tokens again.
                    session_params.twauth_auto_reauth = false;
                    self.api( 'oauth/access_token', 'POST', session_params )
                    .done( function ( result ) {
                        var tokens = self.deparam( result );
                        
                        self.setOAuthTokens( tokens, function () {
                            $deferred.resolve( function () {
                                return self.api.apply( self, arguments );
                            } );
                        } );
                    } )
                    .fail( function ( result ) {
                        $deferred.reject( 'Authorization failure (oauth/access_token)' );
                    } );
                } );
            };
        
        if ( ! options ) {
            options = {};
        }
        
        var use_cache = ( typeof options.use_cache != 'undefined' ) ? options.use_cache : self.config.use_cache;
        
        if ( use_cache ) {
            self.isAuthenticated()
            .done( function ( result ) {
                $deferred.resolve( function () {
                    return self.api.apply( self, arguments );
                } );
            } )
            .fail( function ( result ) {
                popup();
            } );
        }
        else {
            popup();
        }
        
        return $deferred.promise();
    }, // end of authenticate()
    
    logout : function ( callback ) {
        var self = this;
        
        self.oauth_token = '';
        self.oauth_token_secret = '';
        
        remove_values( [ 'oauth_token', 'oauth_token_secret' ], callback );
        
        return self;
    }, // end of logout()
    
    
    getCachedTokens : function ( callback ) {
        var self = this;
        
        get_values( [ 'oauth_token', 'oauth_token_secret' ], callback );
        
        return self;
    }, // end of getCachedTokens()
    
    
    isLoggedIn : function ( callback ) {
        var self = this;
        
        return self.getCachedTokens( callback );
    }, // end of isLoggedIn()
    
    
    isAuthenticated : function () {
        var self = this,
            $deferred = new $.Deferred();
        
        self.getCachedTokens( function ( tokens ) {
            if ( ( ! tokens.oauth_token ) || ( ! tokens.oauth_token_secret ) ) {
                $deferred.reject( 'tokens not found' );
                return;
            }
            
            self.oauth_token = tokens.oauth_token;
            self.oauth_token_secret = tokens.oauth_token_secret;
            
            self.api( 'account/verify_credentials', 'GET', { twauth_auto_reauth : false } )
            .done( function () {
                $deferred.resolve( 'OK' );
            } )
            .fail( function () {
                self.logout( function () {
                    $deferred.reject( 'invalid tokens' );
                } );
            } );
        } );
        
        return $deferred.promise();
    }, // end of isAuthenticated()
    
    setOAuthTokens : function ( tokens, callback ) {
        var self = this;
        
        self.oauth_token = tokens.oauth_token;
        self.oauth_token_secret = tokens.oauth_token_secret;
        
        set_values( {
            oauth_token : tokens.oauth_token,
            oauth_token_secret : tokens.oauth_token_secret
        }, callback );
        
        return self;
    }, // end of setOAuthTokens()
    
    api : function ( path ) { // ( path, params, callback )
        var self = this,
            $deferred = new $.Deferred(),
            api_arguments = arguments,
            args = Array.prototype.slice.call( api_arguments, 1 ),
            path_parts = path.replace( /#.*$/, '' ).split( '?' ),
            callback = null,
            params = {},
            method = 'GET',
            auto_reauth = self.config.auto_reauth;
        
        path = path_parts[ 0 ].replace( /^https?:\/\/[^\/]+/, '' );
        
        if ( path.charAt( 0 ) != '/' ) {
            path = '/' + path;
        }
        
        // Add API version and .json if its not an authorization request
        if ( ! /^\/oauth/.test( path ) ) {
            if ( ! /^\/[\d.]+\//.test( path ) ) {
                path = '/' + self.API_VERSION + path;
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
                        switch ( key ) {
                            case 'twauth_auto_reauth' :
                                if ( arg[ key ] !== undefined ) {
                                    auto_reauth = arg[ key ];
                                }
                                return;
                        }
                        
                        params[ key ] = arg[ key ];
                    } );
                    break;
                
                case 'string':
                    method = arg.toUpperCase();
                    break;
            }
        } );
        
        // Add an oauth token if it is an api request
        if ( self.oauth_token ) {
            params.oauth_token = self.oauth_token;
        }
        
        var accessor = {
                consumerSecret : self.consumer_secret,
                tokenSecret : self.oauth_token_secret
            },
            message = {
                action : self.API_URL + path,
                method : method,
                parameters : [ [ 'oauth_consumer_key', self.consumer_key ], [ 'oauth_signature_method', 'HMAC-SHA1' ] ]
            };
        
        Object.keys( params ).forEach( function ( key ) {
            OAuth.setParameter( message, key, params[ key ] );
        } );
        
        OAuth.completeRequest( message, accessor );
        
        var parameter_map = OAuth.getParameterMap( message.parameters ),
            query = Object.keys( parameter_map ).map( function ( key ) {
                return key + '=' + OAuth.percentEncode( parameter_map[ key ] );
            } ).join( '&' ),
            $api = $[ method.toLowerCase() ]( self.API_URL + path, query );
        
        $api
        .done( function ( data, textStatus, jqXHR ) {
            if ( typeof callback == 'function' ) {
                callback.apply( self, arguments );
            }
            $deferred.resolve.apply( $deferred, arguments );
        } )
        .fail( function ( jqXHR, textStatus, errorThrown ) {
            var fail_arguments = arguments;
            
            if ( ! auto_reauth ) {
                $deferred.reject.apply( $deferred, fail_arguments );
                return;
            }
            
            if ( jqXHR && jqXHR.responseText && /(?::\s*89\s*[,}]|(?:invalid|expired).*?token)/i.test( jqXHR.responseText ) ) {
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
        
        return $deferred.promise();
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
    } // end of deparam()

}; // end of TemplateTwitterAPI


based.Twitter = object_extender( TemplateTwitterAPI );


if ( window.name != TemplateTwitterAPI.API_WINDOW_NAME ) {
    return;
}

get_values( [ 'callback_url' ], function ( params ) {
    if ( params.callback_url && ( location.href.indexOf( params.callback_url ) == 0 ) ) {
        var session = location.search.substr( 1 );
        
        set_values( {
            type : 'auth',
            session : session
        }, function () {
            // When close the window immediately after setting the value, it may not be set correctly.
            var timer_id = setInterval( function () {
                get_values( [ 'type', 'session' ], function ( params ) {
                    if ( params.session != session ) {
                        return;
                    }
                    clearInterval( timer_id );
                    
                    window.open( '', '_self', '' );
                    window.close();
                } );
            }, 100 );
        } );
        return;
    }
    
    if ( location.href.indexOf( TemplateTwitterAPI.API_URL ) == 0 ) {
        setInterval( function () {
            get_values( [ 'healthcheck_counter' ], function ( params ) {
                var healthcheck_counter = parseInt( params.healthcheck_counter, 10 );
                
                if ( isNaN( healthcheck_counter ) ) {
                    healthcheck_counter = 0;
                }
                
                healthcheck_counter++;
                
                set_values( {
                    healthcheck_counter : healthcheck_counter
                } );
            } );
        }, 100 );
        return;
    }
} );

} )();
