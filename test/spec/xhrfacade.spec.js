/* global describe, it */

(function() {
    'use strict';

    describe('XhrFacade', function() {
        var facade,
            server;
        beforeEach(function() {
            sinon.spy(jQuery, 'ajax');
            facade = new XhrFacade();
            server = sinon.fakeServer.create();
            server.autoRespond = true;
            server.respondWith('/abc', function(request) {
                request.respond(200, {
                    'Content-Type': 'application/json'
                }, JSON.stringify({
                    "message": "hello!"
                }));
            });
        });
        afterEach(function() {
            jQuery.ajax.restore();
            server.restore();
        });
        it('should be a constructor function', function() {
            expect(facade instanceof XhrFacade).to.be.true;
        });
        describe('.add()', function() {
            it('should be a function', function() {
                expect(facade.add).to.be.a('function');
            });
        });
        describe('.get()', function() {
            it('should be a function', function() {
                expect(facade.get).to.be.a('function');
            });
            it('should return a promise', function() {
                expect(facade.get() instanceof RSVP.Promise).to.be.true;
            });
            it('should allow calls to regular endpoints to pass through', function(done) {
                facade.get({
                        'url': '/abc'
                    })
                    .then(function(abc) {
                        expect(abc.message).to.equal('hello!');
                        done();
                    }, function(err) {
                        expect('not to error').to.be.false;
                        done();
                    });
            });
            it('should return cached responses for duplicate requests', function(done) {
                var options = {
                    'name': 'abc',
                    'url': '/abc'
                };
                RSVP.all([facade.get(options), facade.get(options)])
                    .then(function(responses) {
                        try {
                            expect(responses[0].message).to.equal('hello!');
                            expect(responses[1].message).to.equal('hello!');
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
        });
    });
})();