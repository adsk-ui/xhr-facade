(function() {

    function factory($, RSVP, sinon) {
        var slice = Array.prototype.slice;

        function isString(obj) {
            return typeof obj === 'string';
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

        function getEndpointOptions(endpoints, name) {
            var endpoint = name && endpoints[name];
            return endpoint && endpoint.options || {};
        }

        function getEndpointCache(endpoints, name) {
            var endpoint = name && endpoints[name];
            return endpoint && endpoint.cache || null;
        }

        function setEndpointOptions(endpoints, name, options) {
            var endpoint;
            if (!name) return;
            endpoint = name && endpoints[name] || {};
            if (options)
                endpoint.options = options;
            endpoints[name] = endpoint;
        }

        function setEndpointCache(endpoints, name, cache) {
            var endpoint;
            if (!name) return;
            endpoint = name && endpoints[name] || {};
            if (cache)
                endpoint.cache = cache;
            endpoints[name] = endpoint;
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

        XhrFacade.prototype.add = function(options) {
            var endpoints = this.endpoints;
            options = options || {};
            if (!options.name || !isString(options.name))
                throw new Error('Cannot create endpoint without name');
            if (!options.url || (!isString(options.url) && !isRegExp(options.url)))
                throw new Error('Cannot create endpoint without url');
            setEndpointOptions(endpoints, options.name, options);
            if(options.response)
                this.server.respondWith(options.type || 'GET', options.url, options.response);
        };

        XhrFacade.prototype.get = function() {
            var deferreds = [],
                deferred,
                requests = [].slice.call(arguments),
                requestsLength = requests.length,
                request,
                options,
                cache;

            for (var i = 0; i < requestsLength; i++) {
                requests[i] = isString(requests[i]) ? {
                    name: requests[i]
                } : requests[i];
                request = requests[i];

                options = getEndpointOptions(this.endpoints, request.name);
                options = extend({}, options, request);

                cache = getEndpointCache(this.endpoints, options.name);

                if (cache && useCache(options, request)) {
                    deferred = cache;
                } else if (options.url) {
                    setEndpointOptions(this.endpoints, options.name, options);
                    deferred = $.ajax(options);
                    setEndpointCache(this.endpoints, options.name, deferred);

                } else {
                    deferred = null;
                }
                deferreds.push(deferred);
            }

            return new RSVP.Promise(function(resolve, reject) {
                $.when.apply($, deferreds).then(resolve, reject);
            });
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