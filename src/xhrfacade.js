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

        function getEndpointId(url, method){
            return url.replace(/\?.*/, '') + '+' + method;
        }

        function getEndpointOptions(endpoints, id) {
            var endpoint = endpoints[id];
            return endpoint && endpoint.options || {};
        }

        function setEndpointOptions(endpoints, id, options) {
            var endpoint = endpoints[id] || {};
            endpoint.options = options;
            endpoints[id] = endpoint;
        }

        function getEndpointCache(endpoints, id, requestOptions, match) {
            var endpoint = endpoints[id] || {},
                cachedOptions = endpoint.options || {},
                cache = endpoint.cache;

            if (!cache)
                return null;

            return match(requestOptions, cachedOptions) ? cache : null;
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

        XhrFacade.prototype.create = function(configs) {
            var configLength,
                config;

            configs = isArray(configs) ? configs : configs ? [configs] : [];
            configLength = configs.length;

            for (var i = 0; i < configLength; i++) {
                config = configs[i];

                if (!config.url || (!isString(config.url) && !isRegExp(config.url)))
                    throw new Error(XhrFacade.ENDPOINT_URL_REQUIRED);

                if (!config.response)
                    throw new Error(XhrFacade.RESPONSE_REQUIRED);

                config.type = config.type || 'GET';
                config.id = config.url + '+' + config.type;

                setEndpointOptions(this.endpoints, config.id, config);

                this.server.respondWith(config.type, config.url, config.response);
            }
        };

        XhrFacade.match = function(a, b){
            return a.url === b.url && JSON.stringify(a.data) === JSON.stringify(b.data);
        };

        XhrFacade.prototype.ajax = function(requests, options) {
            var deferreds = [],
                deferred,
                requestsLength,
                request,
                cache,
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
                    request.id = getEndpointId(request.url, request.type);
                    request.cache = isBoolean(request.cache) ? request.cache : true;

                    if (request.cache)
                        cache = getEndpointCache(this.endpoints, request.id, request, settings.match);

                    if (cache) {
                        deferred = cache;
                        if(typeof request.success === 'function')
                            deferred.done(request.success);
                        if(typeof request.error === 'function')
                            deferred.fail(request.error);
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