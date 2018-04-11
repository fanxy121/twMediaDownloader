/*
twitter-api.js
--------------

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
        
        return function ( name_value_map, callback ) {
            var $deferred = new $.Deferred(),
                $promise = $deferred.promise();
            
            Object.keys( name_value_map ).forEach( function ( name ) {
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
        return new URL( url ).origin;
    }; // end of get_origin()


var TemplateTwitterAPI = {
    config : {
        api_url_base : 'https://api.twitter.com',
        api_version : '1.1',
        
        consumer_key : '',
        consumer_secret : '',
        
        screen_name : '', // binded to oauth_token / oauth_token_secret
        
        oauth_token : '',
        oauth_token_secret : '',
        
        callback_url : '',
        
        popup_window_name : 'OAuthAuthorization',
        
        use_cache : true,
        auto_reauth : true,
        use_separate_popup_window : true,
        
        popup_initial_timeout : 30000,
        popup_closecheck_interval : 100,
        popup_healthcheck_interval : 3000,
    },
    
    popup_info : null,
    
    
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
            $promise = $deferred.promise(),
            
            popup = function () {
                self.config.oauth_token_secret = '';
                self.config.oauth_token = '';
                
                self.api( 'oauth/request_token', 'POST', { twauth_auto_reauth : false } )
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
                        
                        var initial_popup_url = self.config.api_url_base + '/oauth/authenticate?oauth_token=' + self.config.oauth_token,
                            parent_origin = get_origin( location.href ),
                            popup_origin_api = get_origin( self.config.api_url_base ),
                            popup_origin_callback = get_origin( self.config.callback_url ),
                            popup_window_name = self.config.popup_window_name + '.' + parent_origin,
                            popup_window_option = ( self.config.use_separate_popup_window ) ? [
                                'width=' + popup_window_width,
                                'height=' + popup_window_height,
                                'top=' + popup_window_top,
                                'left=' + popup_window_left,
                                'toolbar=0,scrollbars=1,status=1,resizable=1,location=1,menuBar=0'
                            ].join( ',' ) : null,
                            
                            popup_window = window.open( initial_popup_url, popup_window_name, popup_window_option ),
                            
                            initial_timeout_timer_id = setTimeout( function () {
                                console.error( new Date().toISOString(), 'connection timeout' );
                                finish();
                            }, self.config.popup_initial_timeout ),
                            
                            closecheck_timer_id = setInterval( function () {
                                try {
                                    if ( popup_window.closed ) {
                                        console.error( new Date().toISOString(), 'popup window closed' );
                                        finish();
                                        return;
                                    }
                                }
                                catch ( error ) {
                                }
                            }, self.config.popup_closecheck_interval ),
                            
                            healthcheck_timer_id = null,
                            healthcheck_counter = 0,
                            last_healthcheck_counter = 0,
                            
                            message_handler = function ( event ) {
                                if ( ( event.origin != popup_origin_api ) && ( event.origin != popup_origin_callback ) ) {
                                    console.error( new Date().toISOString(), 'origin error:', event.origin );
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
                                        
                                        healthcheck_timer_id = setInterval( function () {
                                            healthcheck_handler();
                                        }, self.config.popup_healthcheck_interval );
                                        break;
                                    
                                    case 'AUTH_RESULT' :
                                        popup_window.postMessage( {
                                            type : 'CLOSE_REQUEST'
                                        }, popup_origin_callback );
                                        
                                        finish( message.value.session );
                                        break;
                                    
                                    default :
                                        console.error( new Date().toISOString(), 'message error:', message );
                                        return;
                                }
                            },
                            
                            healthcheck_handler = function () {
                                if ( healthcheck_counter == last_healthcheck_counter ) {
                                    console.error( new Date().toISOString(), 'healthcheck timeout' );
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
                                    $deferred.reject( 'Authorization failure' );
                                    return;
                                }
                                
                                var session_params = self.deparam( session );
                                
                                if ( typeof session_params.denied != 'undefined' ) {
                                    $deferred.reject( 'Authorization refused' );
                                    return;
                                }
                                
                                // Get access tokens again.
                                session_params.twauth_auto_reauth = false;
                                self.api( 'oauth/access_token', 'POST', session_params )
                                .done( function ( result ) {
                                    var tokens = self.deparam( result );
                                    
                                    self.setOAuthTokens( tokens )
                                    .done( function () {
                                        $deferred.resolve( function () {
                                            return self.api.apply( self, arguments );
                                        } );
                                    } )
                                    .fail( function ( error ) {
                                        $deferred.reject( 'Authorization failure (oauth/access_token) : ' + error );
                                    } );
                                } )
                                .fail( function ( result ) {
                                    $deferred.reject( 'Authorization failure (oauth/access_token)' );
                                } );
                            };
                        
                        window.addEventListener( 'message', message_handler );
                    } );
                } )
                .fail( function ( result ) {
                    $deferred.reject( 'Authorization failure (oauth/request_token)' );
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
        
        return $promise;
    }, // end of authenticate()
    
    
    logout : function ( callback ) {
        var self = this,
            $deferred = new $.Deferred(),
            $promise = $deferred.promise();
        
        self.config.oauth_token = '';
        self.config.oauth_token_secret = '';
        
        remove_values( [ 'oauth_token', 'oauth_token_secret' ] )
        .done( function () {
            if ( typeof callback == 'function' ) {
                $deferred
                .done( function () {
                    callback();
                } );
            }
            
            $deferred.resolve();
        } );
        
        return $promise;
    }, // end of logout()
    
    
    getCachedTokens : function ( callback ) {
        var self = this,
            $deferred = new $.Deferred(),
            $promise = $deferred.promise(),
            name_suffix = ( self.config.screen_name ) ? ( '.' + self.config.screen_name ) : '';
        
        get_values( [ 'oauth_token' + name_suffix, 'oauth_token_secret' + name_suffix ] )
        .done( function ( tokens ) {
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
                oauth_token_secret = tokens[ 'oauth_token_secret' + name_suffix ];
            
            if ( ( ! oauth_token ) || ( ! oauth_token_secret ) ) {
                $deferred.reject( 'tokens not found' );
                return;
            }
            
            self.config.oauth_token = oauth_token;
            self.config.oauth_token_secret = oauth_token_secret;
            
            self.api( 'account/verify_credentials', 'GET', { twauth_auto_reauth : false } )
            .done( function ( json ) {
                if ( ( self.config.screen_name ) && ( self.config.screen_name != json.screen_name ) ) {
                    $deferred.reject( 'screen_name mismatch' );
                    return;
                }
                $deferred.resolve( 'OK' );
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
        
        var name_suffix = ( self.config.screen_name ) ? ( '.' + self.config.screen_name ) : '';
        
        self.config.oauth_token = tokens.oauth_token;
        self.config.oauth_token_secret = tokens.oauth_token_secret;
        
        set_values( {
            [ 'oauth_token' + name_suffix ] : tokens.oauth_token,
            [ 'oauth_token_secret' + name_suffix ] : tokens.oauth_token_secret
        } )
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
            auto_reauth = self.config.auto_reauth;
        
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
            } ).join( '&' ),
            $api = $[ method.toLowerCase() ]( self.config.api_url_base + path, query );
        
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
            var popup_info = {
                    name : RegExp.$1,
                    parent_origin : RegExp.$2
                };
            
            if ( popup_info.name != self.config.popup_window_name ) {
                return null;
            }
            
            return popup_info;
        }
    }, // end of getPopupInfo()
    
    
    initializePopupWindow : function () {
        var self = this,
            api_url_base = self.config.api_url_base,
            callback_url = self.config.callback_url,
            parent_window = window.opener,
            parent_origin = self.popup_info.parent_origin,
            healthcheck_timer_id;
        
        if ( callback_url && ( location.href.indexOf( callback_url ) == 0 ) ) {
            parent_window.postMessage( {
                type : 'AUTH_RESULT',
                value : {
                    session : location.search.substr( 1 )
                }
            }, parent_origin );
        }
        else if ( api_url_base && ( location.href.indexOf( api_url_base ) == 0 ) ) {
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
                console.error( new Date().toISOString(), 'origin error:', event.origin );
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
                    console.error( new Date().toISOString(), 'message error:', message );
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


based.Twitter = object_extender( TemplateTwitterAPI );

} )();
