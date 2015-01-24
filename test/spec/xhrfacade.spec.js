/* global describe, it */

(function() {
    'use strict';

    describe('XhrFacade', function() {
        var facade,
            server;

        beforeEach(function() {
            sinon.spy(jQuery, 'ajax');
            facade = new XhrFacade();
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
                    expect(err.message).to.equal('Cannot create endpoint without name');
                }
            });
            it('should throw error if url is not provided for endpoint', function(){
                var err = {};
                try{
                    facade.add({'name': 'abc'});
                }catch(e){
                    err = e;
                }finally{
                    expect(err.message).to.equal('Cannot create endpoint without url');
                }
            });
            it('should allow real endpoints to be called by name', function(done){
                facade.add({
                    'name': 'hola',
                    'url': '/test/data/hola.json'
                });
                facade.get('hola')
                    .then(function(response){
                        expect(response.message).to.equal('hola!');
                        done();
                    });
            });
            it('should allow virtual endpoints to be called by name', function(done){
                facade.add({
                    'name': 'bonjour',
                    'url': '/bonjour',
                    'response': function(request){
                        request.respond(JSON.stringify({
                            message: 'bonjour!'
                        }));
                    }
                });
                facade.get('bonjour')
                    .then(function(response){
                        expect(response.message).to.equal('bonjour!');
                        done();
                    });
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
                facade
                    .get({
                        'url': '/test/data/hello.json'
                    })
                    .then(function(response) {
                        expect(response.message).to.equal('hello!');
                        done();
                    });
            });
            it('should return cached responses for duplicate requests', function(done) {
                var options = {
                    'name': 'hello',
                    'url': '/test/data/hello.json'
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