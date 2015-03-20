(function() {
    'use strict';
    function factory($, RSVP, sinon) {

        RSVP.Promise.prototype.spread = function(resolve, reject, label) {
            return this.then(function(array) {
                return resolve.apply(void 0, array);
            }, reject, label);
        };

        RSVP.Promise.prototype.done = function(){
            var callbacks = Array.prototype.slice.call(arguments);
            for(var i = 0; i < callbacks.length; i++ )
                this.then(callbacks[i]);
            return this;
        };

        RSVP.Promise.prototype.always = function(){
            var callbacks = Array.prototype.slice.call(arguments);
            for(var i = 0; i < callbacks.length; i++ ){
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

        function getUrlParams(url){
            var params = url.match(/\?([^#]*)/);
            // just the params, no ?
            params = params && params.length && params[1];
            return params || '';
        }

        function matchUrlParams(url1, url2){
            return getUrlParams(url1) === getUrlParams(url2);
        }

        function matchData(data1, data2){
            return data1 === data2;
        }

        function matchOptions(cachedOptions, request){
            var match = matchUrlParams(cachedOptions.url, request.url);
            return match && matchData(cachedOptions.data, JSON.stringify(request.data));
        }

        function getEndpointId(url, method){
            return url.replace(/\?.*/, '') + '+' + method;
        }

        function getEndpointOptions(endpoints, id) {
            var endpoint = endpoints[id];
            return endpoint && endpoint.options || {};
        }

        function setEndpointOptions(endpoints, id, options) {
            var endpoint = endpoints[id] || {};
            endpoint.options = {
                url: options.url,
                data: JSON.stringify(options.data),
                response: options.response
            };
            endpoints[id] = endpoint;
        }

        function getEndpointCache(endpoints, id, request) {
            var endpoint = endpoints[id] || {},
                endpointOptions = endpoint.options || {},
                endpointCache = endpoint.cache,
                match;

            if (!endpointCache)
                return null;

            match = matchOptions(endpointOptions, request);
            return match ? endpointCache : null;
        }

        function setEndpointCache(endpoints, id, cache) {
            var endpoint = endpoints[id] || {};
            endpoint.cache = cache;
            endpoints[id] = endpoint;
        }

        function XhrFacade(options) {
            var self = this;
            var endpoints = this.endpoints = {};
            var server = sinon.fakeServer.create();
            options = options || {};
            server.autoRespond = true;
            server.xhr.useFilters = true;
            server.xhr.defaultHeaders = options.defaultHeaders || {
                'Content-Type': 'application/json'
            };
            /**
             * Add filter to allow requests to real REST endpoints
             * to pass through sinon untouched.
             */
            var filter = function() {
                return (function(method, requestedUrl) {
                    var intercept = false,
                        endpoints = this.endpoints,
                        endpoint;
                    for (var name in endpoints) {
                        endpoint = endpoints[name];
                        if (!endpoint.options.response)
                            continue;
                        if (endpoint.options.url.toString() === requestedUrl.toString()) {
                            intercept = true;
                        } else if (isRegExp(endpoint.options.url) && isString(requestedUrl)) {
                            intercept = endpoint.options.url.exec(requestedUrl);
                        } else {
                            intercept = endpoint.options.url === /[^?]+/.exec(requestedUrl);
                        }
                        if (intercept)
                            break;
                    }
                    return !intercept;
                }).apply(self, arguments);
            };
            server.xhr.addFilter(filter);
            this.server = server;
        }

        XhrFacade.RESPONSE_REQUIRED = 'You must provide a response function when creating an endpoint.';
        XhrFacade.ENDPOINT_URL_REQUIRED = 'You must provide a URL when creating an endpoint.';

        XhrFacade.prototype.create = function(config) {
            var configLength,
                options;

            config = isArray(config) ? config : config ? [config] : [];
            configLength = config.length;

            for (var i = 0; i < configLength; i++) {
                options = config[i];

                if (!options.url || (!isString(options.url) && !isRegExp(options.url)))
                    throw new Error(XhrFacade.ENDPOINT_URL_REQUIRED);

                if (!options.response)
                    throw new Error(XhrFacade.RESPONSE_REQUIRED);

                options.type = options.type || 'GET';
                options.id = options.url + '+' + options.type;

                setEndpointOptions(this.endpoints, options.id, options);

                this.server.respondWith(options.type, options.url, options.response);
            }
        };

        XhrFacade.prototype.ajax = function(requests, options) {
            var deferreds = [],
                deferred,
                requestsLength,
                request,
                cache,
                settings;

            settings = extend({
                proxyTo: $.ajax,
                aggregator: RSVP.allSettled
            }, options);

            requests = !requests ? [] : isArray(requests) ? requests : [requests];
            requestsLength = requests.length;

            for (var i = 0; i < requestsLength; i++) {
                request = requests[i];

                if (request.url) {
                    request.type = request.type || 'GET';
                    request.id = getEndpointId(request.url, request.type);
                    request.cache = isBoolean(request.cache) ? request.cache : true;

                    if (request.cache)
                        cache = getEndpointCache(this.endpoints, request.id, request);

                    if (cache) {
                        deferred = cache;
                    } else {
                        deferred = settings.proxyTo(request);
                        setEndpointCache(this.endpoints, request.id, deferred);
                        setEndpointOptions(this.endpoints, request.id, request);
                    }
                } else {
                    deferred = request;
                }

                deferreds.push(deferred);
            }

            return settings.aggregator(deferreds);
        };

        XhrFacade.prototype.destroy = function() {
            this.server.restore();
            this.server.xhr.filters = [];
        };


        /**
         * Static API
         * --------------------------------
         */
        var singleton;

        XhrFacade.getInstance = function(){
            singleton = singleton || new XhrFacade();
            return singleton;
        };

        return XhrFacade;
    }
    if (typeof define === 'function' && define.amd) {
        define(['jquery', 'rsvp', 'sinon'], function() {
            return factory.apply(this, arguments);
        });
    } else if (typeof this !== 'undefined') {
        this.XhrFacade = factory.call(this, jQuery, RSVP, sinon);
    }
}).call(this);