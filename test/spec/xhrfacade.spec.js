/* global describe, it */

(function() {
    'use strict';
    describe('XhrFacade', function() {
        var facade,
            server,
            requestA,
            requestB;

        beforeEach(function() {
            sinon.spy(jQuery, 'ajax');
            facade = new XhrFacade();
            facade.add('/bonjour', function(req, res){
                res.json({
                    message: 'bonjour!'
                });
            });
            facade.add(/\/custom\/([^\?]+)/, function(req, res){
                res.json({
                    message: req.params[0],
                    param: req.query.param
                });
            });
            facade.add(/\/error/, [404, null, '']);
            requestA = {
                url: 'abc',
                data: {
                    message: 'yo'
                }
            };
            requestB = {
                url: 'abc',
                data: {
                    message: 'yo'
                }
            };
        });

        afterEach(function() {
            jQuery.ajax.restore();
            facade.destroy();
        });

        it('should be a constructor function', function() {
            expect(facade instanceof XhrFacade).to.be.true;
        });

        it('should add an XHR filter', function(){
            expect(sinon.FakeXMLHttpRequest.filters.length).to.equal(1);
        });

        describe('.getInstance()', function(){
            it('should be a static method', function(){
                expect(XhrFacade.getInstance).to.be.a('function');
            });

            it('should return a singleton instance', function(){
                var instance1 = XhrFacade.getInstance(),
                    instance2 = XhrFacade.getInstance();
                expect(instance1).to.equal(instance2);
            });
        });

        describe('.match()', function(){
            it('should be a static method', function(){
                expect(XhrFacade.match).to.be.a('function');
            });
            it('should accept two arguments', function(){
                expect(XhrFacade.match.length).to.equal(2);
            });
            it('should return true if url and data properties of arguments match', function(){
                expect(XhrFacade.match(requestA, requestB)).to.be.true;
            });
            it('should return false if url properties of arguments differ', function(){
                requestA.url = 'xyz';
                expect(XhrFacade.match(requestA, requestB)).to.be.false;
            });
            it('should return false if data properties of arguments differ', function(){
                requestA.data.message = 'hi';
                expect(XhrFacade.match(requestA, requestB)).to.be.false;
            });
        });

        describe('.ajax()', function() {

            it('is a function', function() {
                expect(facade.ajax).to.be.a('function');
            });

            it('returns an RSVP.Promise', function() {
                expect(facade.ajax() instanceof RSVP.Promise).to.be.true;
            });

            it('accepts an object as input for a single request', function(done){
                facade.ajax({id: 1}).then(function(response){
                    expect(response[0].value.id).to.equal(1);
                    done();
                });
            });

            it('accepts an array as input for parallel requests', function(done){
                facade.ajax([{id: 1}, {id: 2}]).then(function(response){
                    expect(response[0].value.id).to.equal(1);
                    expect(response[1].value.id).to.equal(2);
                    done();
                });
            });

            it('returns an RSVP.Promise augmented with .spread() method', function(done){
                facade.ajax([{id: 1}, {id: 2}]).spread(function(o1, o2){
                    expect(o1.value.id).to.equal(1);
                    expect(o2.value.id).to.equal(2);
                    done();
                });
            });

            it('returns RSVP.Promise augmented with .done() method', function(done){
                facade.ajax([{id: 1}, {id: 2}]).done(function(response){
                    expect(response[0].value.id).to.equal(1);
                    expect(response[1].value.id).to.equal(2);
                    done();
                });
            });

            it('returns RSVP.Promise augmented with .always() method', function(done){
                facade.ajax([{url: '/error'}, {id: 2}]).always(function(response){
                    expect(response[0].state).to.equal('rejected');
                    expect(response[1].value.id).to.equal(2);
                    done();
                });
            });

            it('allows calls to regular endpoints to pass through', function(done) {
                var message;
                facade
                    .ajax({
                        'url': '/test/data/hello.json'
                    })
                    .then(function(responses) {
                        message = responses[0].value.message;
                    })
                    .finally(function(){
                        expect(message).to.equal('hello!');
                        done();
                    });
            });

            it('returns cached responses for duplicate requests', function(done) {
                var options1 = {
                        url: '/test/data/hola.json'
                    },
                    options2 = {
                        url: '/test/data/hola.json'
                    };
                RSVP.all([facade.ajax(options1), facade.ajax(options2)])
                    .spread(function(first, second) {
                        expect(first[0].value.message).to.equal('hola!');
                        expect(second[0].value.message).to.equal('hola!');
                        expect(jQuery.ajax.calledOnce).to.be.true;
                        done();
                    });
            });

            it('makes separate calls to an endpoint when URL params differ', function(done) {
                var options1 = {
                        url: '/test/data/hola.json'
                    },
                    options2 = {
                        url: '/test/data/hola.json?x=y'
                    };
                RSVP.all([facade.ajax(options1), facade.ajax(options2)])
                    .spread(function(first, second) {
                        expect(first[0].value.message).to.equal('hola!');
                        expect(second[0].value.message).to.equal('hola!');
                        expect(jQuery.ajax.calledTwice).to.be.true;
                        done();
                    })
                    ['catch'](function(a){
                        arguments;
                        console.error(a);
                    });
            });

            it('makes separate calls to an endpoint when URL fragments differ', function(done){
                RSVP.all([facade.ajax({
                    'url': '/custom/one'
                }), facade.ajax({
                    'url': '/custom/two'
                })]).spread(function(first, second){
                    expect(first[0].value.message).to.equal('one');
                    expect(second[0].value.message).to.equal('two');
                    expect(jQuery.ajax.callCount).to.equal(2);
                    done();
                })
                ['catch'](function(){
                    arguments;
                });
            });

            it('makes separate calls to an endpoint when data options differ', function(done){
                facade.ajax([{
                    url: '/custom/pinot',
                    data: {
                        param: "noir"
                    }
                }, {
                    url: '/custom/pinot',
                    data: {
                        param: "grigio"
                    }
                }]).spread(function(first, second){
                    expect(first.value.message).to.equal('pinot');
                    expect(first.value.param).to.equal('noir');
                    expect(second.value.message).to.equal('pinot');
                    expect(second.value.param).to.equal('grigio');
                    done();
                });
            });

            it('forces new call if "cache" option is false', function(done){
                var options = {
                    url: '/test/data/hola.json'
                };
                facade.ajax(options)
                    .spread(function(first) {
                        options.cache = false;
                        return facade.ajax([options, first.value]);
                    })
                    .spread(function(second, first){
                        expect(first.value.message).to.equal('hola!');
                        expect(second.value.message).to.equal('hola!');
                        expect(jQuery.ajax.calledTwice).to.be.true;
                        done();
                    });
            });

            it('passes extra parameters into resolve/reject callbacks', function(done){
                facade.ajax([{'url': '/bonjour' }, 'extra', null, undefined])
                    .spread(function(french, extra, n, u){
                        expect(french.value.message).to.equal("bonjour!");
                        expect(n.value).to.equal(null);
                        expect(u.value).to.equal(undefined);
                        done();
                    });
            });

            it('allows calls to be chained', function(done){
                facade.ajax({
                    url: '/test/data/hola.json'
                })
                .spread(function(spanish){
                    return facade.ajax([{url: '/bonjour'}, spanish.value]);
                })
                .spread(function(french, spanish){
                    return facade.ajax({
                        'url': '/custom/' + spanish.value.message + ' and ' + french.value.message
                    });
                })
                .spread(function(response){
                    expect(response.value.message).to.equal('hola! and bonjour!');
                    done();
                });
            });

            it('invokes spread callback when calls partially fail', function(done){
                facade.ajax([{
                    url: '/test/data/hola.json'
                },{
                    url: '/error'
                }]).spread(function(response1, response2){
                    expect(response1.state).to.equal('fulfilled');
                    expect(response1.value.message).to.equal('hola!');
                    expect(response2.state).to.equal('rejected');
                    expect(response2.reason.statusText).to.equal('Not Found');
                    done();
                });
            });

            it('invokes success/error callbacks for requests that receive cached responses', function(done){
                var callbacks = {
                    success: sinon.spy(),
                    error: sinon.spy()
                };
                facade.ajax([{
                    url: '/test/data/hola.json'
                }, {
                    url: '/test/data/hola.json',
                    success: callbacks.success
                }, {
                    url: '/bad-url'
                }, {
                    url: '/bad-url',
                    error: callbacks.error
                }]).done(function(){
                    expect(callbacks.success.calledOnce).to.be.true;
                    expect(callbacks.error.calledOnce).to.be.true;
                    expect(jQuery.ajax.calledTwice).to.be.true;
                    done();
                });
            });

            it('provides option for specifying custom aggregator', function(done){
                facade.ajax({url: '/test/data/hola.json'}, {
                    aggregator: function(promises){
                        return $.when.apply($, promises);
                    }
                }).done(function(response, textStatus, jqXHR){
                    expect(response.message).to.equal('hola!');
                    expect(textStatus).to.equal('success');
                    expect(jqXHR.status).to.equal(200);
                    done();
                });
            });

            it('provides option for proxying to a specified function', function(done){
                var options = {url: '/test/data/hola.json'};
                facade.ajax(options, {
                    proxyTo: function(request){
                        expect(request).to.equal(options);
                        done();
                    }
                });
            });

            it('updates existing endpoint after making fresh call', function(){
                facade.destroy();
                facade = new XhrFacade();
                facade.ajax({url: '/abc'});
                facade.ajax({url: '/abc?msg=hi'});
                expect(facade.endpoints.length).to.equal(1);
            });
        });

        describe('.add()', function() {

            it('should be a function', function() {
                expect(facade.add).to.be.a('function');
            });

            it('should throw error if url is not provided for endpoint', function(){
                var err = {};
                try{
                    facade.add();
                }catch(e){
                    err = e;
                }finally{
                    expect(err.message).to.equal(XhrFacade.ENDPOINT_URL_REQUIRED);
                }
            });

            it('should allow urls to be specified as regular expressions with capture groups', function(done){
                facade.ajax({
                    'url': '/custom/aloha!'
                })
                .then(function(responses){
                    expect(responses[0].value.message).to.equal("aloha!");
                    done();
                });
            });

            it('should register seperate default options for each endpoint HTTP method', function(done){
                facade.add('GET', '/method-man', function(req, res){
                    res.json({
                        message: 'you got it'
                    });
                });
                facade.add('POST', '/method-man', function(req, res){
                    res.json({
                        message: 'poster boy'
                    });
                });
                facade.ajax([{
                    'url': '/method-man',
                    'type': 'GET'
                }, {
                    'url': '/method-man',
                    'type': 'POST'
                }]).then(function(response){
                    expect(response[0].value.message).to.equal('you got it');
                    expect(response[1].value.message).to.equal('poster boy');
                    done();
                });
            });

            it('makes endpoint available to XmlHttpRequest directly', function(done){
                $.ajax({
                    url: '/bonjour',
                    success: function(response){
                        expect(response.message).to.equal('bonjour!');
                        done();
                    },
                    error: function(err){
                        done(err);
                    }
                });
            });

            describe('arguments to handler (request, response)', function(){
                describe('request.params', function(){
                    describe('when route definition is a regular expression', function(){
                        it('is an array containing capture groups', function(done){
                            facade.add('GET', /a\/(.*)\/(.*)\/?(.*)/, function(req){
                                expect(req.params.length).to.equal(3);
                                expect(req.params[0]).to.equal('b');
                                expect(req.params[1]).to.equal('c');
                                expect(req.params[2]).to.equal('');
                                done();
                            });
                            $.ajax({url: '/a/b/c'});
                        });
                    });
                    describe('when route definition is a path pattern', function(){
                        it('is an object containing properties mapped the named route "parameters"', function(done){
                            facade.add('GET', '/1/:b/:c', function(req){
                                expect(req.params.b).to.equal('2');
                                expect(req.params.c).to.equal('3');
                                done();
                            });
                            $.ajax({url: '/1/2/3'});
                        });
                    });
                });
                describe('request.query', function(){
                    it('is an key/value representation of the query parameters in the request', function(done){
                        facade.add('/a/b', function(req, res){
                            expect(req.query.r).to.equal('s');
                            expect(req.query.t).to.equal('u');
                            done();
                        });
                        $.get('/a/b?r=s&t=u');
                    });
                });
                describe('request.cache', function(){
                    it("is true when cache setting of ajax request is true", function(done){
                        facade.add('/a/b', function(req, res){
                            expect(req.cache).to.be.true;
                            done();
                        });
                        $.ajax({
                            url: '/a/b'
                        });
                    });
                    it("is false when cache setting of ajax request is false", function(done){
                        facade.add('/a/b', function(req, res){
                            expect(req.cache).to.be.false;
                            done();
                        });
                        $.ajax({
                            url: '/a/b',
                            cache: false
                        });
                    });
                });
                describe('request.ajax()', function(){
                    it("acts as a proxy to facade.ajax()", function(done){
                        sinon.spy(facade, 'ajax');
                        facade.add('/a/b', function(req, res){
                            req.ajax('hello');
                            expect(facade.ajax.calledOnce).to.be.true;
                            expect(facade.ajax.calledWith('hello')).to.be.true;
                            done();
                        });
                        $.get('/a/b');
                    });
                });
                describe('response', function(){
                    describe('.send()', function(){
                        it('is a function', function(done){
                            facade.add('/abc', function(req, res){
                                expect(res.send).to.be.a('function');
                                done();
                            });
                            $.get('/abc');
                        });
                        it('sends raw text input as response to request', function(done){
                            facade.add('/abc', function(req, res){
                                res.send('hi!');
                            });
                            $.get('/abc').done(function(response){
                                expect(response).to.equal('hi!');
                                done();
                            });
                        });
                    });
                    describe('.json()', function(){
                        it('is a function', function(done){
                            facade.add('/abc', function(req, res){
                                expect(res.json).to.be.a('function');
                                done();
                            });
                            $.get('/abc');
                        });
                        it('stringifies json input before sending it as response to request', function(done){
                            facade.add('/abc', function(req, res){
                                res.json({msg:'hi!'});
                            });
                            $.get('/abc').done(function(response){
                                expect(response.msg).to.equal('hi!');
                                done();
                            });
                        });
                    });
                    describe('.sendStatus()', function(){
                        it('sends HTTP status code and corresponding string representation as the response body', function(done){
                            facade.add('/abc', function(req, res){
                                res.sendStatus(400);
                            });
                            $.get('/abc').fail(function(jqXHR, textStatus, err){
                                expect(textStatus).to.equal('error');
                                expect(err).to.equal('Bad Request');
                                done();
                            });
                        });
                    });
                });
            });

        });
        describe('.remove()', function(){
            it('removes previously added virtual endpoints', function(done){
                var endpoint = facade.add('/xyz', function(req, res){
                    res.json({status: 'ok'});
                });
                $.get('/xyz').done(function(data){
                    expect(data.status).to.equal('ok');
                    facade.remove(endpoint);
                    $.get('/xyz').fail(function(jqXHR, textStatus){
                        expect(textStatus).to.equal('error');
                        done();
                    });
                });
            });
        });
        describe('.destroy()', function(){
            it('should be a function', function(){
                expect(facade.destroy).to.be.a('function');
            });
            it('should restore XmlHttpRequest global', function(){
                facade.destroy();
                expect(new XMLHttpRequest() instanceof sinon.FakeXMLHttpRequest).to.be.false;
            });
            it('should clear all XHR filters', function(){
                facade.destroy();
                expect(sinon.FakeXMLHttpRequest.filters.length).to.equal(0);
            });
            it('should nullify the singleton', function(){
                var singleton = XhrFacade.getInstance();
                singleton.destroy();
                expect(singleton == XhrFacade.getInstance()).to.be.false;
            });
        });
    });
})();