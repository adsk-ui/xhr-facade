# xhrfacade
Frontend utility for abstracting server-side endpoints.

## Documentation

### .ajax( options[, args] )
##### Description
Performs async HTTP request(s). Returns an RSVP.Promise that resolves after all requests have resolved.

Name | Type | Description
options | Array | An array containing settings objects for each request. Pass multiple settings objects to perform multiple requests. The array passed to the resolve callback will contain the responses in the same order that they were requested.

**options**
Type: Array 

An array containing settings objects for each request. Pass multiple settings objects to perform multiple requests. The array passed to the resolve callback will contain the responses in the same order that they were requested.

```javascript
var facade = new XhrFacade();
facade.ajax([{ url: '/peas' }, { url: '/carrots' }])
  .then(function(responses){
    // responses[0] === peas response
    // responses[1] === carrots response
  });
```
XhrFacade augments RSVP.Promise with a "spread" method that passes the response objects to the call back as separate arguments.
```javascript
facade.ajax([{ url: '/peas' }, { url: '/carrots' }])
  .spread(function(peas, carrots){
    //...
  });
```

**args**
Any additional arguments will be passed on to the resolve callback.

```javascript
facade.ajax([{ url: '/peas' }, { url: '/carrots' }], 'hello!')
  .spread(function(peas, carrots, message){
    // message === 'hello!'
  });
```
### .create( options )
##### Description
Configures virtual Ajax endpoints.

**options**

Type: Array | Object

An object (or array of objects) containing configuration for the endpoint.
