/* global describe, it */

(function() {
    'use strict';

    describe('XhrFacade', function() {
        var facade,
            server;

        beforeEach(function() {
            sinon.spy(jQuery, 'ajax');
            facade = new XhrFacade();
            facade.create({
                'url': '/bonjour',
                'response': function(request, id){
                    request.respond(JSON.stringify({
                        message: 'bonjour!'
                    }));
                }
            });
            facade.create({
                'url': /\/custom\/([^\?]+)/,
                'response': function(request, message){
                    request.respond(JSON.stringify({
                        message: message,
                        param: request.getUrlParam('param')
                    }));
                }
            });
            facade.create({
                url: /\/error/,
                response: [404, null, '']
            });
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

        describe('.create()', function() {

            it('should be a function', function() {
                expect(facade.create).to.be.a('function');
            });

            it('should throw error if url is not provided for endpoint', function(){
                var err = {};
                try{
                    facade.create({'name': 'abc'});
                }catch(e){
                    err = e;
                }finally{
                    expect(err.message).to.equal(XhrFacade.ENDPOINT_URL_REQUIRED);
                }
            });
            it('should allow an array as input', function(done){
                facade.create([{
                    'url': '/blue',
                    'response': function(request){
                        request.respond(JSON.stringify({
                            message: 'blue!'
                        }));
                    }
                }]);
                facade.ajax({url:'/blue'}).then(function(response){
                    expect(response[0].message).to.equal('blue!');
                    done();
                });
            });
            it('should allow an object as input', function(done){
                facade.create({
                    'url': '/blue',
                    'response': function(request){
                        request.respond(JSON.stringify({
                            message: 'blue!'
                        }));
                    }
                });
                facade.ajax({url:'/blue'}).then(function(response){
                    expect(response[0].message).to.equal('blue!');
                    done();
                });
            });

            it('should allow urls to be specified as regular expressions with capture groups', function(done){
                facade.ajax({
                    'url': '/custom/aloha!'
                })
                .then(function(responses){
                    expect(responses[0].message).to.equal("aloha!");
                    done();
                });
            });

            it('should register seperate default options for each endpoint HTTP method', function(done){
                facade.create({
                    'url': '/method-man',
                    'type': 'GET',
                    'response': function(request){
                        request.respond(JSON.stringify({
                            message: 'you got it'
                        }));
                    }
                });
                facade.create({
                    'url': '/method-man',
                    'type': 'POST',
                    'response': function(request){
                        request.respond(JSON.stringify({
                            message: 'poster boy'
                        }));
                    }
                });
                facade.ajax({
                    'url': '/method-man',
                    'type': 'GET'
                }, {
                    'url': '/method-man',
                    'type': 'POST'
                }).then(function(response){
                    expect(response[0].message).to.equal('you got it');
                    expect(response[1].message).to.equal('poster boy');
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
        });
        describe('.ajax()', function() {

            it('should be a function', function() {
                expect(facade.ajax).to.be.a('function');
            });

            it('should return an RSVP.Promise', function() {
                expect(facade.ajax() instanceof RSVP.Promise).to.be.true;
            });

            it('returned RSVP.Promise should be augmented with .spread() method', function(done){
                facade.ajax({id: 1}, {id: 2}).spread(function(o1, o2){
                    expect(o1.id).to.equal(1);
                    expect(o2.id).to.equal(2);
                    done();
                });
            });

            it('returned RSVP.Promise should be augmented with .done() method', function(done){
                facade.ajax({id: 1}, {id: 2}).done(function(response){
                    expect(response[0].id).to.equal(1);
                    expect(response[1].id).to.equal(2);
                    done();
                });
            });

            it('returned RSVP.Promise should be augmented with .fail() method', function(done){
                facade.ajax({url: '/error'}).fail(function(jqXhr){
                    expect(jqXhr.status).to.equal(404);
                    done();
                });
            });

            it('returned RSVP.Promise should be augmented with .always() method', function(done){
                facade.ajax({url: '/error'}, {id: 2}).always(function(response){
                    expect(response[0].id).to.equal(1);
                    expect(response[1].id).to.equal(2);
                    done();
                });
            });

            it('should allow calls to regular endpoints to pass through', function(done) {
                var message;
                facade
                    .ajax({
                        'url': '/test/data/hello.json'
                    })
                    .then(function(responses) {
                        message = responses[0].message;
                    })
                    .finally(function(){
                        expect(message).to.equal('hello!');
                        done();
                    });
            });

            it('should return cached responses for duplicate requests', function(done) {
                var options = {
                    'url': '/test/data/hola.json'
                };
                RSVP.all([facade.ajax(options), facade.ajax(options)])
                    .spread(function(first, second) {
                        expect(first[0].message).to.equal('hola!');
                        expect(second[0].message).to.equal('hola!');
                        expect(jQuery.ajax.calledOnce).to.be.true;
                        done();
                    });
            });

            it('should not return cached responses for calls to same endpoint when URL fragments differ', function(done){
                RSVP.all([facade.ajax({
                    'url': '/custom/one'
                }), facade.ajax({
                    'url': '/custom/two'
                })]).spread(function(first, second){
                    expect(first[0].message).to.equal('one');
                    expect(second[0].message).to.equal('two');
                    expect(jQuery.ajax.callCount).to.equal(2);
                    done();
                });
            });

            it('should not return cached responses if "cache" option is false', function(done){
                var options = {
                    url: '/test/data/hola.json'
                };
                facade.ajax(options)
                    .spread(function(first) {
                        options.cache = false;
                        return facade.ajax(options, first);
                    })
                    .spread(function(second, first){
                        expect(first.message).to.equal('hola!');
                        expect(second.message).to.equal('hola!');
                        expect(jQuery.ajax.calledTwice).to.be.true;
                        done();
                    });
            });

            it('should not return cache responses for calls to same endpoint with different request payloads', function(done){
                facade.ajax({
                    url: '/custom/wine',
                    data: {
                        param: "cheese"
                    }
                }, {
                    url: '/custom/beer',
                    data: {
                        param: "pretzels"
                    }
                }).spread(function(first, second){
                    expect(first.message).to.equal('wine');
                    expect(first.param).to.equal('cheese');
                    expect(second.message).to.equal('beer');
                    expect(second.param).to.equal('pretzels');
                    done();
                });
            });

            it('should pass extra parameters into resolve/reject callbacks', function(done){
                facade.ajax({'url': '/bonjour' }, 'extra', 'params')
                    .spread(function(french, extra, params){
                        expect(french.message).to.equal("bonjour!");
                        expect(extra).to.equal('extra');
                        expect(params).to.equal('params');
                        done();
                    });
            });

            it('calls can be chained', function(done){
                facade.ajax({
                    url: '/test/data/hola.json'
                })
                .spread(function(spanish){
                    return facade.ajax({url: '/bonjour'}, spanish);
                })
                .spread(function(french, spanish){
                    return facade.ajax({
                        'url': '/custom/' + spanish.message + ' and ' + french.message
                    });
                })
                .spread(function(response){
                    expect(response.message).to.equal('hola! and bonjour!');
                    done();
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
        });
    });
})();