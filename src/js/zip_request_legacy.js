( function () {

'use strict';

if ( typeof browser == 'undefined' ) { window.browser = chrome; }

var USER_AGENT = navigator.userAgent.toLowerCase(),
    IS_EDGE = ( 0 <= USER_AGENT.indexOf( 'edge' ) ),
    IS_FIREFOX = ( 0 <= USER_AGENT.indexOf( 'firefox' ) ),
    IS_CHROME = ( ( ! IS_EDGE ) && ( 0 <= USER_AGENT.indexOf( 'chrome' ) ) );


window.ZipRequestLegacy = ( function () {
    function ZipRequestLegacy() {
        var self = this;
        
        self.__init__();
    } // end of ZipRequestLegacy()
    
    
    ZipRequestLegacy.prototype.open = function ( callback ) {
        var self = this;
        
        self.__init__();
        
        self.opened = true;
        
        browser.runtime.sendMessage( {
            type : 'ZIP_OPEN'
        }, function ( response ) {
            if ( response.error ) {
                self.__error__( 'ZIP_OPEN', response.error, callback );
                return;
            }
            
            if ( ! self.opened ) {
                self.__error__( 'ZIP_OPEN', 'not opened', callback );
                return;
            }
            self.zip_id = response.zip_id;
            
            self.__success__( response, callback );
            
            self.__flush__();
        } );
        
        return self;
    }; // end of open()
    
    
    ZipRequestLegacy.prototype.file = function ( file_info, callback ) {
        var self = this;
        
        if ( ! self.opened ) {
            self.__error__( 'file()', 'not opened', callback );
            return self;
        }
        
        if ( callback ) {
            file_info.callback = callback;
        }
        
        self.waiting_file_infos.push( file_info );
        self.__flush__();
        
        return self;
    }; // end of file()
    
    
    ZipRequestLegacy.prototype.generate = function ( url_scheme, callback ) {
        var self = this;
        
        if ( ! self.opened ) {
            self.__error__( 'generate()', 'not opened', callback );
            return self;
        }
        
        if ( url_scheme ) {
            self.url_scheme = url_scheme;
        }
        self.generate_callback = callback;
        self.download_request = true;
        self.__flush__();
        
        return self;
    }; // end of download()
    
    
    ZipRequestLegacy.prototype.close = function ( callback ) {
        var self = this;
        
        if ( ! self.opened  ) {
            self.__error__( 'close()', 'not opened', callback );
            return self;
        }
        self.opened = false;
        
        if ( self.zip_id ) {
            browser.runtime.sendMessage( {
                type : 'ZIP_CLOSE',
                zip_id : self.zip_id
            }, function ( response ) {
                if ( response.error ) {
                    self.__error__( 'ZIP_CLOSE', response.error, callback );
                    return;
                }
                self.__success__( response, callback );
            } );
            self.zip_id = null;
        }
        else {
            self.__success__( { result : 'OK' }, callback );
        }
        
        return self;
    }; // end of open()
    
    
    ZipRequestLegacy.prototype.__init__ = function () {
        var self = this;
        
        self.zip_id = null;
        self.opened = false;
        self.last_error = null;
        self.url_scheme = 'blob';
        self.file_counter = 0;
        self.waiting_file_infos = [];
        self.download_request = false;
        
        return self;
    }; // end of __init__()
    
    
    ZipRequestLegacy.prototype.__success__ = function ( response, callback ) {
        var self = this;
        
        if ( typeof callback == 'function' ) {
            callback( response );
        }
    }; // end of __success__()
    
    
    ZipRequestLegacy.prototype.__error__ = function ( message, error, callback ) {
        var self = this;
        
        console.error( message, error );
        
        self.last_error = error;
        
        if ( typeof callback == 'function' ) {
            callback( {
                message : message,
                error : error
            } );
        }
    }; // end of __error__()
    
    
    ZipRequestLegacy.prototype.__flush__ = function () {
        var self = this;
        
        if ( self.zip_id === null ) {
            return self;
        }
        
        
        function send_zip_file_request( file_info ) {
            var callback = file_info.callback;
            if ( callback ) {
                // Firefox では、sendMessage() の引数に関数が含まれているとメッセージが送信されない
                delete file_info.callback;
            }
            
            if ( ( file_info.zip_options ) && ( file_info.zip_options.date ) && ( typeof file_info.zip_options.date.getTime == 'function' ) ) {
                // sendMessage() では、JSON シリアライズ不可なオブジェクトは送信できないので（例外もあり？）、変換が必要
                file_info.zip_options.date = file_info.zip_options.date.getTime();
            }
            
            browser.runtime.sendMessage( {
                type : 'ZIP_FILE',
                zip_id : self.zip_id,
                file_info : file_info
            }, function ( response ) {
                self.file_counter --;
                
                if ( response.error ) {
                    self.__error__( 'ZIP_FILE', response.error, callback );
                    return;
                }
                
                self.__success__( response, callback );
                self.__flush__();
            } );
        } // end of send_zip_file_request()
        
        var file_info;
        
        while ( 0 < self.waiting_file_infos.length ) {
            self.file_counter ++;
            
            file_info = self.waiting_file_infos.shift();
            
            send_zip_file_request( file_info );
        }
        
        if ( ! self.download_request ) {
            return self;
        }
        
        if ( 0 < self.file_counter ) {
            return self;
        }
        
        self.download_request = false;
        
        browser.runtime.sendMessage( {
            type : 'ZIP_GENERATE',
            zip_id : self.zip_id,
            zip_parameters : {
                url_scheme : self.url_scheme
            }
        }, function ( response ) {
            var zip_url,
                zip_content;
            
            if ( response.error ) {
                self.__error__( 'ZIP_GENERATE', response.error, self.generate_callback );
                return;
            }
            
            if ( response.zip_url ) {
                // Chrome や Edge の場合、Blob オブジェクトの受け渡しは不可
                // → background(zip_worker.js) 側で予め変換しておく
                
                // TODO: Edge の場合、Blob URL にすると content_scripts 側でダウンロードできない
                zip_url = response.zip_url;
                
                if ( IS_FIREFOX && ( self.url_scheme == 'blob' ) ) {
                    // background(zip_worker.js) 側で Blob URL に変換した場合、Firefox ではダウンロードできなくなってしまう
                    // → Blob URL を Blob として取得しなおしてから、再度 Blob URL に変換すると、ダウンロードできるようになる
                    var xhr = new XMLHttpRequest();
                    
                    xhr.open( 'GET', zip_url, true );
                    xhr.responseType = 'blob';
                    xhr.onload = function () {
                        if ( xhr.readyState != 4 ) {
                            return;
                        }
                        self.__success__( {
                            zip_url : URL.createObjectURL( xhr.response )
                        }, self.generate_callback );
                    };
                    xhr.onerror = function () {
                        self.__error__( 'ZIP_GENERATE: XMLHttpRequest()', 'error: ' + xhr.status + xhr.statusText, self.generate_callback );
                    };
                    xhr.send();
                    return;
                }
            }
            else {
                // background(zip_worker.js) 側で Blob URL に変換した場合、Firefox ではダウンロードできなくなってしまう
                // → content_scripts 側で変換
                zip_content = response.zip_content;
                zip_url = ( self.url_scheme == 'data' ) ? ( 'data:application/octet-stream;base64,' + zip_content ) : URL.createObjectURL( zip_content );
            }
            
            self.__success__( {
                zip_url : zip_url,
                zip_content : zip_content
            }, self.generate_callback );
        } );
        
        return self;
    }; // end of __flush__()
    
    return ZipRequestLegacy;
} )(); // end of ZipRequestLegacy()

window.ZipRequest = window.ZipRequestLegacy;

} )();
