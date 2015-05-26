(function() {
    'use strict';

    function factory($, RSVP, sinon, deparam) {

        RSVP.Promise.prototype.spread = function(resolve, reject, label) {
            return this.then(function(array) {
                array = array instanceof Array ? array : [];
                return resolve.apply(void 0, array);
            }, reject, label);
        };

        RSVP.Promise.prototype.done = function() {
            var callbacks = Array.prototype.slice.call(arguments);
            for (var i = 0; i < callbacks.length; i++)
                this.then(callbacks[i]);
            return this;
        };

        RSVP.Promise.prototype.always = function() {
            var callbacks = Array.prototype.slice.call(arguments);
            for (var i = 0; i < callbacks.length; i++) {
                this.then(callbacks[i], callbacks[i]);
            }
            return this;
        };

        var slice = Array.prototype.slice;

        function isString(obj) {
            return typeof obj === 'string';
        }

        function isArray(obj) {
            return obj instanceof Array;
        }

        function isFunction(obj) {
            return typeof obj === 'function';
        }

        function isRegExp(obj) {
            return obj instanceof RegExp;
        }

        function isBoolean(obj) {
            return typeof obj === 'boolean';
        }

        function extend(obj) {
            var sources = slice.call(arguments, 1),
                sourcesLength = sources.length,
                source;
            for (var i = 0; i < sourcesLength; i++) {
                source = sources[i];
                if (source) {
                    for (var prop in source) {
                        obj[prop] = source[prop];
                    }
                }
            }
            return obj;
        }

        function bind(f, _this){
            return function(){
                return f.apply(_this, arguments);
            }
        }

        function getEndpoint(endpoints, request) {
            var i = 0,
                l = endpoints.length,
                endpoint;
            for( ; i < l; i++){
                endpoint = endpoints[i];
                if(endpoint.type === request.type && endpoint.url.exec(baseUrl(request.url)))
                    return endpoints[i];
            }
            return null;
        }

        function setEndpoint(endpoints, endpoint){
            endpoints.push(endpoint);
            return endpoint;
        }

        function removeEndpoint(endpoints, endpoint){
            var i = 0,
                l = endpoints.length;
            for( ; i < l; i++){
                if( endpoints[i] === endpoint ){
                    return endpoints.splice(i, 1);
                }
            }
        }

        function useCachedResponse(endpoint, request, match){
            if(!endpoint || !endpoint.cache || !request.cache)
                return false;
            return !!match(endpoint.previousRequest, request);
        }

        function baseUrl(url){
            return url.replace(/\?.*/, '');
        }


        /**
         * XhrFacade constructor function. Creates a sinon fake server
         * which overrides the browser's native global XMLHttpRequest object so
         * that XHRs can be intercepted and responded to client-side.
         * @param {[type]} options [description]
         */
        function XhrFacade(options) {
            var self = this,
                endpoints = this.endpoints = [],
                server = sinon.fakeServer.create();

            options = options || {};
            server.autoRespond = true;
            server.xhr.useFilters = true;

            /**
             * Add filter to allow requests to real REST endpoints
             * to pass through sinon untouched.
             */
            var filter = function() {
                return (function(method, requestedUrl) {
                    var intercept = false,
                        endpoints = this.endpoints,
                        endpointsL = endpoints.length,
                        endpoint,
                        i = 0;
                    for ( ; i < endpointsL; i++) {
                        endpoint = endpoints[i];
                        if (!endpoint.response)
                            continue;

                        intercept = !!endpoint.url.exec(baseUrl(requestedUrl));
                        // if (endpoint.url.exec(baseUrl(requestedUrl))) {
                        //     intercept = endpoint.options.url.exec(requestedUrl);
                        // } else {
                        //     intercept = endpoint.options.url === /[^?]+/.exec(requestedUrl);
                        // }
                        if (intercept)
                            break;
                    }
                    return !intercept;
                }).apply(self, arguments);
            };
            server.xhr.addFilter(filter);
            this.server = server;
        }

        /**
         * Creates a new vitual XHR endpoint.
         * @param  {String} method   The HTTP method for this endpoint; defaults to GET if omitted
         * @param  {String|RegExp} url      XHR calls to this URL will be intercepted by the facade.
         * @param  {Function} response The handler that will be invoked when this endpoint is requested.
         * @return {[type]}          [description]
         */
        XhrFacade.prototype.add = function(method, url, response) {
            var self = this,
                urlParamKeys;


            if (arguments.length === 2) {
                response = url;
                url = method;
                method = 'GET';
            }

            if (!url || (!isString(url) && !isRegExp(url)))
                throw new Error(XhrFacade.ENDPOINT_URL_REQUIRED);

            if (!response)
                throw new Error(XhrFacade.RESPONSE_REQUIRED);


            if(isString(url)){
                urlParamKeys = url.match(/:\w+/g);
                url = url.replace(/:\w+/g, '(\\w+)').replace(/\)/g, ')?');
            }

            url = new RegExp(url);

            this.server.respondWith(method, url, !isFunction(response) ? response : function(request) {
                var captureGroups = Array.prototype.slice.call(arguments, 1),
                    query = deparam(request.url.replace(/[^\?]*\?/, '')),
                    params;

                if(urlParamKeys && captureGroups.length){
                    params = {};
                    for(var i =0; i < urlParamKeys.length; i++)
                        params[urlParamKeys[i].slice(1)] = captureGroups[i];
                }else{
                    params = Array.prototype.slice.call(arguments, 1);
                }

                return response({
                    params: params || {},
                    query: query,
                    cache: !query._,
                    ajax: bind(self.ajax, self)
                }, {
                    send: function(payload) {
                        request.respond(200, {
                            'Content-Type': 'text/plain',
                        }, payload);
                    },
                    json: function(payload) {
                        request.respond(200, {
                            'Content-Type': 'application/json'
                        }, JSON.stringify(payload));
                    },
                    sendStatus: function(statusCode){
                        request.respond(statusCode);
                    }
                });
            });

            return setEndpoint(this.endpoints, {
                    type: method,
                    url: url,
                    response: response
                });
        };

        XhrFacade.prototype.remove = function(endpoint){
            return removeEndpoint(this.endpoints, endpoint);
        };

        /**
         * The default algorithm for testing whether to respond to a request
         * with a previously cached payload. Basically, if the URL params or request
         * payload are different, make a fresh call. This is intended to be overriden
         * to meet domain-specific requirements.
         * @param  {Object} a The Ajax settings representing the request
         * @param  {Object} b The Ajax settings representing the previous request to this endpoint.
         * @return {Boolean}   If true, a cached response from the previous request will be used to respond to the current request.
         */
        XhrFacade.match = function(previousRequest, request) {
            var urlsMatch,
                dataMatch;

            if(!previousRequest)
                return false;

            urlsMatch = previousRequest.url === request.url,
            dataMatch = JSON.stringify(previousRequest.data) === JSON.stringify(request.data);
            return urlsMatch && dataMatch;
        };

        /**
         * Makes AJAX requests, proxying to jQuery.ajax by default
         * @param  {Object} requests An object (or array of objects) representing jQuery Ajax request settings
         * @param  {Object} options  Can be used to override default settings for the request(s)
         * @return {RSVP.Promise}          A promise that resolves once all requested calls resolve.
         */
        XhrFacade.prototype.ajax = function(requests, options) {
            var deferreds = [],
                deferred,
                requestsLength,
                request,
                endpoint,
                useCache,
                defaults,
                settings;


            defaults = {
                proxyTo: $.ajax,
                aggregator: RSVP.allSettled,
                match: XhrFacade.match
            };

            settings = extend(defaults, options);

            requests = !requests ? [] : isArray(requests) ? requests : [requests];
            requestsLength = requests.length;

            for (var i = 0; i < requestsLength; i++) {
                request = requests[i];

                if (request && request.url) {
                    request.type = request.type || 'GET';
                    request.cache = isBoolean(request.cache) ? request.cache : true;

                    endpoint = getEndpoint(this.endpoints, request);
                    useCache = useCachedResponse(endpoint, request, settings.match);

                    if (useCache) {
                        endpoint.previousRequest = request;
                        deferred = endpoint.cache;
                        if (typeof request.success === 'function')
                            deferred.done(request.success);
                        if (typeof request.error === 'function')
                            deferred.fail(request.error);
                    } else {
                        deferred = settings.proxyTo(request);
                        if(endpoint){
                            endpoint.cache = deferred;
                            endpoint.previousRequest = request;
                        }else{
                            setEndpoint(this.endpoints, {
                                type: request.type,
                                url: new RegExp(baseUrl(request.url)),
                                cache: deferred,
                                previousRequest: request
                            });
                        }
                    }
                } else {
                    deferred = request;
                }

                deferreds.push(deferred);
            }

            return settings.aggregator(deferreds);
        };

        /**
         * Restores the browser's normal XMLHttpRequest object which allows
         * all XHRs to pass through to the server.
         * @return {[type]} [description]
         */
        XhrFacade.prototype.destroy = function() {
            this.server.restore();
            this.server.xhr.filters = [];
            this.endpoints = [];
            if(this === singleton)
                singleton = null;
        };

        /**
         * Static method used to retreive a singleton instance of XhrFacade
         * @return {XhrFacade} The singleton instance.
         */
        var singleton;

        XhrFacade.getInstance = function() {
            singleton = singleton || new XhrFacade();
            return singleton;
        };


        XhrFacade.RESPONSE_REQUIRED = 'You must provide a response function when creating an endpoint.';
        XhrFacade.ENDPOINT_URL_REQUIRED = 'You must provide a URL when creating an endpoint.';
        XhrFacade.StatusCodes = {};
        return XhrFacade;
    }
    if (typeof define === 'function' && define.amd) {
        define(['jquery', 'rsvp', 'sinon', 'deparam'], function() {
            return factory.apply(this, arguments);
        });
    } else if (typeof this !== 'undefined') {
        this.XhrFacade = factory.call(this, jQuery, RSVP, sinon, deparam);
    }
}).call(this);
