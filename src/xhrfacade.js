(function() {

    function factory($, RSVP, sinon) {
        var slice = Array.prototype.slice;

        function isString(obj) {
            return typeof obj === 'string';
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

        function setEndpoint(endpoints, name, options, cache) {
            var endpoint = name && endpoints[name] || {};
            if (options)
                endpoint.options = options;
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

        function XhrFacade() {
        	var endpoints = this.endpoints = {},
        		server = sinon.fakeServer.create();

        	server.autoRespond = true;
        	server.xhr.useFilters = true;
        	server.xhr.defaultHeaders = {'Content-Type': 'application/json'};
            /**
             * Add a filter to allow requests to real REST endpoints
             * to pass through sinon untouched.
             */
            server.xhr.addFilter(function( method, requestedUrl ){
                var intercept = false,
                	endpointsLength = endpoints.length,
                	endpoint;

                for(var i = 0; i < endpointsLength; i++){
                	endpoint = endpoints[i];
                	if( endpoint.options.url.toString() === requestedUrl.toString() ){
                		// intercept = true;
                		// break;
                	}else if( isRegExp(endpoint.options.url) && isString(requestedUrl) ){
                		// intercept = endpoint.options.url.exec(requestedUrl);
                		// break;
                	}
                	// intercept = endpoint.options.url === /[^?]+/.exec(requestedUrl);
                	// break;
                }
                return !intercept;
                // return !_(virtualServices).any(function(service){
                //     serviceUrl = service.options.url;
                //     if( serviceUrl.toString() === requestedUrl.toString() ){
                //         return true;
                //     }else if( _.isRegExp(serviceUrl) && _.isString(requestedUrl) ){
                //         return serviceUrl.exec(requestedUrl);
                //     }
                //     return serviceUrl === /[^?]+/.exec(requestedUrl);
                // });
            });

            this.server = server;
            this.endpoints = {};
        }

        XhrFacade.prototype.add = function() {
        // 	function( options, callback ){
        //     var virtualServices = this.virtualServices,
        //         name = options.name;
        //     if( !_.isString(name) || !name )
        //         throw new Error('Cannot create virtual service without name');
        //     if( !virtualServices[name] ){
        //         delete options.name;
        //         virtualServices[name] = {
        //             'options': options
        //         };
        //         server.respondWith(options.type || 'GET', options.url, callback);
        //     }
        // }
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

                cache = getEndpointCache(this.endpoints, request.name);

                if (cache && useCache(options, request)) {
                    deferred = cache;
                } else if (options.url) {
                    deferred = $.ajax(options);
                    setEndpoint(this.endpoints, request.name, options, deferred);
                } else {
                    deferred = null;
                }
                deferreds.push(deferred);
            }

            return new RSVP.Promise(function(resolve, reject) {
                $.when.apply($, deferreds)
                    .done(function() {
                        resolve.apply(this, arguments);
                    }, function() {
                        reject.apply(this, arguments);
                    });
            });
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