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

        describe('.ajax()', function() {

            it('should be a function', function() {
                expect(facade.ajax).to.be.a('function');
            });

            it('should return an RSVP.Promise', function() {
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

            it('returned RSVP.Promise should be augmented with .spread() method', function(done){
                facade.ajax([{id: 1}, {id: 2}]).spread(function(o1, o2){
                    expect(o1.value.id).to.equal(1);
                    expect(o2.value.id).to.equal(2);
                    done();
                });
            });

            it('returned RSVP.Promise should be augmented with .done() method', function(done){
                facade.ajax([{id: 1}, {id: 2}]).done(function(response){
                    expect(response[0].value.id).to.equal(1);
                    expect(response[1].value.id).to.equal(2);
                    done();
                });
            });

            it('returned RSVP.Promise should be augmented with .always() method', function(done){
                facade.ajax([{url: '/error'}, {id: 2}]).always(function(response){
                    expect(response[0].state).to.equal('rejected');
                    expect(response[1].value.id).to.equal(2);
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
                        message = responses[0].value.message;
                    })
                    .finally(function(){
                        expect(message).to.equal('hello!');
                        done();
                    });
            });

            it('should return cached responses for duplicate requests', function(done) {
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

            it('should not return cached responses for calls to same endpoint when URL params differ', function(done) {
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
                    });
            });

            it('should not return cached responses for calls to same endpoint when URL fragments differ', function(done){
                RSVP.all([facade.ajax({
                    'url': '/custom/one'
                }), facade.ajax({
                    'url': '/custom/two'
                })]).spread(function(first, second){
                    expect(first[0].value.message).to.equal('one');
                    expect(second[0].value.message).to.equal('two');
                    expect(jQuery.ajax.callCount).to.equal(2);
                    done();
                });
            });

            it('should not return cache responses for calls to same endpoint when data options differ', function(done){
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

            it('should not return cached responses if "cache" option is false', function(done){
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

            it('should pass extra parameters into resolve/reject callbacks', function(done){
                facade.ajax([{'url': '/bonjour' }, 'extra', null, undefined])
                    .spread(function(french, extra, n, u){
                        expect(french.value.message).to.equal("bonjour!");
                        expect(n.value).to.equal(null);
                        expect(u.value).to.equal(undefined);
                        done();
                    });
            });

            it('calls can be chained', function(done){
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

            it('should invoke spread callback when calls partially fail', function(done){
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
                    expect(response[0].value.message).to.equal('blue!');
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
                    expect(response[0].value.message).to.equal('blue!');
                    done();
                });
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