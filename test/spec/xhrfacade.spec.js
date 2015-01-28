/* global describe, it */

(function() {
    'use strict';

    describe('XhrFacade', function() {
        var facade,
            server;

        beforeEach(function() {
            sinon.spy(jQuery, 'ajax');
            facade = new XhrFacade();
            facade.add({
                'url': '/bonjour',
                'response': function(request, id){
                    request.respond(JSON.stringify({
                        message: 'bonjour!'
                    }));
                }
            });
            facade.add({
                'url': /\/custom\/(.+)/,
                'response': function(request, greeting){
                    request.respond(JSON.stringify({
                        message: greeting
                        // body: facade.utils.urlParam(request.url, 'food')
                    }));
                }
            });
        });

        afterEach(function() {
            jQuery.ajax.restore();
            facade.restore();
        });

        it('should be a constructor function', function() {
            expect(facade instanceof XhrFacade).to.be.true;
        });

        describe('.add()', function() {

            it('should be a function', function() {
                expect(facade.add).to.be.a('function');
            });

            it('should throw error if url is not provided for endpoint', function(){
                var err = {};
                try{
                    facade.add({'name': 'abc'});
                }catch(e){
                    err = e;
                }finally{
                    expect(err.message).to.equal(XhrFacade.ENDPOINT_URL_REQUIRED);
                }
            });
            it('should allow an array as input', function(done){
                facade.add([{
                    'url': '/blue',
                    'response': function(request){
                        request.respond(JSON.stringify({
                            message: 'blue!'
                        }));
                    }
                }]);
                facade.get([{url:'/blue'}]).spread(function(blue){
                    expect(blue.message).to.equal('blue!');
                    done();
                });
            });
            it('should allow an object as input', function(done){
                facade.add({
                    'url': '/blue',
                    'response': function(request){
                        request.respond(JSON.stringify({
                            message: 'blue!'
                        }));
                    }
                });
                facade.get([{url:'/blue'}]).spread(function(blue){
                    expect(blue.message).to.equal('blue!');
                    done();
                });
            });

            it('should allow urls to be specified as regular expressions with capture groups', function(done){
                facade.get([{
                    'url': '/custom/aloha!'
                }])
                .then(function(responses){
                    expect(responses[0].message).to.equal("aloha!");
                    done();
                });
            });

            it('should register seperate default options for each endpoint HTTP method', function(done){
                facade.add({
                    'url': '/method-man',
                    'type': 'GET',
                    'response': function(request){
                        request.respond(JSON.stringify({
                            message: 'you got it'
                        }));
                    }
                });
                facade.add({
                    'url': '/method-man',
                    'type': 'POST',
                    'response': function(request){
                        request.respond(JSON.stringify({
                            message: 'poster boy'
                        }));
                    }
                });
                facade.get([{
                    'url': '/method-man',
                    'type': 'GET'
                }, {
                    'url': '/method-man',
                    'type': 'POST'
                }]).spread(function(get, post){
                    expect(get.message).to.equal('you got it');
                    expect(post.message).to.equal('poster boy');
                    done();
                });
            });
        });
        describe('.get()', function() {

            it('should be a function', function() {
                expect(facade.get).to.be.a('function');
            });

            it('should throw an error when omitting request array', function(){
                var err = {};
                try{
                    facade.get();
                }catch(e){
                    err = e;
                }finally{
                    expect(err.message).to.equal(XhrFacade.REQUEST_ARRAY_REQUIRED);
                }
            });

            it('should return a promise', function() {
                expect(facade.get([]) instanceof RSVP.Promise).to.be.true;
            });

            it('should allow calls to regular endpoints to pass through', function(done) {
                var message;
                facade
                    .get([{
                        'url': '/test/data/hello.json'
                    }])
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
                RSVP.all([facade.get([options]), facade.get([options])])
                    .spread(function(first, second) {
                        try {
                            expect(first[0].message).to.equal('hola!');
                            expect(second[0].message).to.equal('hola!');
                            expect(jQuery.ajax.calledOnce).to.be.true;
                        } catch (e) {
                            done(e);
                        } finally {
                            done();
                        }
                    }, function() {
                        expect('not to error').to.be.false;
                        done();
                    });
            });

            it('should not return cached responses for calls to same endpoint when URL fragments differ', function(done){
                RSVP.all([facade.get([{
                    'url': '/custom/one'
                }]), facade.get([{
                    'url': '/custom/two'
                }])]).spread(function(first, second){
                    expect(first[0].message).to.equal('one');
                    expect(second[0].message).to.equal('two');
                    expect(jQuery.ajax.callCount).to.equal(2);
                    done();
                });
            });

            it('should not return cache responses for calls to same endpoint with different request payloads', function(){
                facade.get([{
                    url: '/custom/wine',
                    data: {
                        food: "cheese"
                    }
                }, {
                    url: '/custom/beer',
                    data: {
                        food: "pretzels"
                    }
                }]).spread(function(first, second){

                });
            });

            it('should pass extra parameters into resolve/reject callbacks', function(done){
                facade.get([{
                    'url': '/bonjour'
                }], 'extra', 'params')
                    .spread(function(french, extra, params){
                        expect(french.message).to.equal("bonjour!");
                        expect(extra).to.equal('extra');
                        expect(params).to.equal('params');
                        done();
                    });
            });

            it('calls can be chained', function(done){
                facade.get([{
                    url: '/test/data/hola.json'
                }])
                    .spread(function(spanish){
                        return facade.get([{url: '/bonjour'}], spanish);
                    })
                    .spread(function(french, spanish){
                        return facade.get([{
                            'url': '/custom/' + spanish.message + ' and ' + french.message
                        }]);
                    })
                    .spread(function(response){
                        expect(response.message).to.equal('hola! and bonjour!');
                        done();
                    });
            });
        });
    });
})();