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
                'name': 'hola',
                'url': '/test/data/hola.json'
            });
            facade.add({
                'name': 'bonjour',
                'url': '/bonjour',
                'response': function(request, id){
                    request.respond(JSON.stringify({
                        message: 'bonjour!'
                    }));
                }
            });
            facade.add({
                'name': 'custom',
                'url': /\/custom\/(.+)/,
                'response': function(request, greeting){
                    request.respond(JSON.stringify({
                        message: greeting
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

            it('should throw error if name is not provided for endpoint', function(){
                var err = {};
                try{
                    facade.add({});
                }catch(e){
                    err = e;
                }finally{
                    expect(err.message).to.equal(XhrFacade.ENDPOINT_NAME_REQUIRED);
                }
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
                    'name': 'blue',
                    'url': '/blue',
                    'response': function(request){
                        request.respond(JSON.stringify({
                            message: 'blue!'
                        }));
                    }
                }]);
                facade.get(['blue']).spread(function(blue){
                    expect(blue.message).to.equal('blue!');
                    done();
                });
            });
            it('should allow an object as input', function(done){
                facade.add({
                    'name': 'blue',
                    'url': '/blue',
                    'response': function(request){
                        request.respond(JSON.stringify({
                            message: 'blue!'
                        }));
                    }
                });
                facade.get(['blue']).spread(function(blue){
                    expect(blue.message).to.equal('blue!');
                    done();
                });
            });
            it('should allow real endpoints to be called by name', function(done){
                facade.get(['hola'])
                    .then(function(responses){
                        expect(responses[0].message).to.equal('hola!');
                        done();
                    });
            });

            it('should allow virtual endpoints to be called by name', function(done){
                facade.get([{
                    'name': 'bonjour'
                }])
                .then(function(responses){
                    expect(responses[0].message).to.equal('bonjour!');
                    done();
                });
            });

            it('should allow urls to be specified as regular expressions with capture groups', function(done){
                facade.get([{
                    'name': 'custom',
                    'url': '/custom/aloha!'
                }])
                .then(function(responses){
                    expect(responses[0].message).to.equal("aloha!");
                    done();
                });
            });

            it('should register seperate default options for each endpoint HTTP method', function(done){
                facade.add({
                    'name': 'method-man',
                    'url': '/method-man',
                    'type': 'GET',
                    'response': function(request){
                        request.respond(JSON.stringify({
                            message: 'you got it'
                        }));
                    }
                });
                facade.add({
                    'name': 'method-man',
                    'url': '/method-man',
                    'type': 'POST',
                    'response': function(request){
                        request.respond(JSON.stringify({
                            message: 'poster boy'
                        }));
                    }
                });
                facade.get([{
                    'name': 'method-man',
                    'type': 'GET'
                }, {
                    'name': 'method-man',
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

            it('should throw an error when omitting the URL while requesting an endpoint defined as a regular expresion', function(done){
                var err = {};
                try{
                    facade.get(['custom']);
                }catch(e){
                    err = e;
                }finally{
                    expect(err.message).to.equal(XhrFacade.REGEXP_ENDPOINT_URL_REQUIRED);
                    done();
                }
            });

            it('should return a promise', function() {
                expect(facade.get([]) instanceof RSVP.Promise).to.be.true;
            });

            it('should allow calls to regular endpoints to pass through', function(done) {
                facade
                    .get([{
                        'url': '/test/data/hello.json'
                    }])
                    .then(function(responses) {
                        expect(responses[0].message).to.equal('hello!');
                        done();
                    });
            });

            it('should return cached responses for duplicate requests', function(done) {
                RSVP.all([facade.get(['hola']), facade.get(['hola'])])
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
                    'name': 'custom',
                    'url': '/custom/one'
                }]), facade.get([{
                    'name': 'custom',
                    'url': '/custom/two'
                }])]).spread(function(first, second){
                    expect(first[0].message).to.equal('one');
                    expect(second[0].message).to.equal('two');
                    expect(jQuery.ajax.callCount).to.equal(2);
                    done();
                });
            });

            it('should pass extra parameters into resolve/reject callbacks', function(done){
                facade.get(['bonjour'], 'extra', 'params')
                    .spread(function(french, extra, params){
                        expect(french.message).to.equal("bonjour!");
                        expect(extra).to.equal('extra');
                        expect(params).to.equal('params');
                        done();
                    });
            });

            it('calls can be chained', function(done){
                facade.get(['hola'])
                    .spread(function(spanish){
                        return facade.get(['bonjour'], spanish);
                    })
                    .spread(function(french, spanish){
                        return facade.get([{
                            'name': 'custom',
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