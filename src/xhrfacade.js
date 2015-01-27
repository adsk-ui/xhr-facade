(function() {

    function factory($, RSVP, sinon) {
        var slice = Array.prototype.slice;

        function isString(obj) {
            return typeof obj === 'string';
        }

        function isArray(obj){
            return obj instanceof Array;
        }

        function isRegExp(obj) {
            return obj instanceof RegExp;
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

        function getEndpointOptions(endpoints, name, type) {
            var endpoint;
            type = type || 'GET';
            endpoint = name && endpoints[name + type];
            return endpoint && endpoint.options || {};
        }

        function getEndpointCache(endpoints, name, type) {
            var endpoint;
            type = type || 'GET';
            endpoint = name && endpoints[name + type];
            return endpoint && endpoint.cache || null;
        }

        function setEndpointOptions(endpoints, name, type, options) {
            var endpoint, id;
            if (!name || !type) return;
            id = name + type;
            endpoint = endpoints[id] || {};
            endpoint.options = options;
            endpoints[id] = endpoint;
        }

        function setEndpointCache(endpoints, name, type, cache) {
            var endpoint, id;
            if (!name || !type) return;
            id = name + type;
            endpoint = name && endpoints[id] || {};
            if (endpoint && cache)
                endpoint.cache = cache;
            endpoints[id] = endpoint;
        }

        function useCache(options1, options2) {
            var sameType = options1.type === options2.type,
                sameUrl = options1.url === options2.url,
                sameData;
            options1.data = options1.data || '';
            options2.data = options2.data || '';
            sameData = options1.data.toString() === options2.data.toString();
            return sameType && sameUrl && sameData;
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
                        }else{
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

        XhrFacade.REQUEST_ARRAY_REQUIRED = 'You must pass a request array to XhrFacade.get() method.';
        XhrFacade.REGEXP_ENDPOINT_URL_REQUIRED = 'Requests to endpoints registered as regular expresions must provide a URLs.';
        XhrFacade.ENDPOINT_NAME_REQUIRED = 'You must provide a name when adding an endpoint.';
        XhrFacade.ENDPOINT_URL_REQUIRED = 'You must provide a URL when adding an endpoint.';

        XhrFacade.prototype.add = function(config) {
            var configLength,
                options;

            config = isArray(config) ? config : config ? [config] : [];
            configLength = config.length;

            for(var i = 0; i < configLength; i++){
                options = config[i];
                options.type = options.type || 'GET';

                if (!options.name || !isString(options.name))
                    throw new Error(XhrFacade.ENDPOINT_NAME_REQUIRED);
                if (!options.url || (!isString(options.url) && !isRegExp(options.url)))
                    throw new Error(XhrFacade.ENDPOINT_URL_REQUIRED);

                setEndpointOptions(this.endpoints, options.name, options.type, options);

                if(options.response)
                    this.server.respondWith(options.type, options.url, options.response);
            }
        };

        XhrFacade.prototype.get = function() {
            var deferreds = [],
                deferred,
                requests,
                requestsLength,
                request,
                defaults,
                options,
                cache;

            if(!arguments.length || !isArray(arguments[0]))
                throw new Error(XhrFacade.REQUEST_ARRAY_REQUIRED);

            requests = arguments.length ? arguments[0] : [];
            requestsLength = requests.length;

            for (var i = 0; i < requestsLength; i++) {
                request = isString(requests[i]) ? {
                    name: requests[i]
                } : requests[i];

                defaults = getEndpointOptions(this.endpoints, request.name, request.type);
                options = extend({}, defaults, request);

                if(isRegExp(options.url))
                    throw new Error(XhrFacade.REGEXP_ENDPOINT_URL_REQUIRED);

                cache = getEndpointCache(this.endpoints, options.name, options.type);

                if (cache && useCache(defaults, options)) {
                    deferred = cache;
                } else if (options.url) {
                    deferred = $.ajax(options);
                    setEndpointCache(this.endpoints, options.name, options.type, deferred);

                } else {
                    deferred = requests[i];
                }
                deferreds.push(deferred);
            }

            deferreds = deferreds.concat(Array.prototype.slice.call(arguments, 1));

            return RSVP.all(deferreds);
        };

        XhrFacade.prototype.restore = function() {
            this.server.restore();
            this.server.xhr.filters = [];
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