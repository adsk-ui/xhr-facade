# xhrfacade
Frontend utility for abstracting server-side endpoints.

## Documentation

### .ajax( options[, args] )
Performs async HTTP request(s). Returns an RSVP.Promise that resolves after all requests have resolved. 

**.ajax( options )**

| Name | Type | Description |
| ---- | ---- | ----------- |
| **options** | Array | An array containing settings objects for each request. Pass multiple settings objects to perform multiple requests. The array passed to the resolve callback will contain the responses in the same order that they were requested. The settings can be anything supported by jQuery.ajax. See: http://api.jquery.com/jquery.ajax/#jQuery-ajax-settings. Cached responses will be provided for multiple requests to a URL when type and data settings are the same.|

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

**.ajax( options, args )**

| Name | Type | Description |
| ---- | ---- | ----------- |
| **args** | n/a | Any additional arguments will be passed on to the resolve callback. |

```javascript
facade.ajax([{ url: '/peas' }, { url: '/carrots' }], 'hello!')
  .spread(function(peas, carrots, message){
    // message === 'hello!'
  });
```

### .create( options )
Configures virtual Ajax endpoints.

**.create( options )**

| Name | Type | Description |
| ---- | ---- | ----------- |
| **options** | Object, Array | The configuration settings for the virtual endpoint. Pass an array of objects to configure multiple endpoints at once. |

The each endpoint configuration must include:

| Name | Type | Required | Description |
| ---- | ---- | -------- | ----------- |
| url | String, RegExp | Yes | The URL for the endpoint. |
| response | Function | Yes | The response function is invoked for each request made to the endpoint. An object representing the request is passed to the function as an argument. To respond to the request, you must call the request object's "respond" method, passing it the stringified payload. |
| type | String | No | The request method. Defaults to "GET" |

```javascript
facade.create({
    url: '/peas',
    response: function(request){
        request.respond(JSON.stringify({
            latin: 'Pisum sativum',
            type: 'fruit',
            color: 'green'
        }));
    }
});
$.ajax({
    url: '/peas',
    success: function(data){
        // data.latin === 'Pisum sativum' etc.
    }
});
```
The URL can also be defined as a regular expression. Any capture groups will be passed into the response function.
```javascript
facade.create({
    url: /\/food\/(\w+)/,
    response: function(request, food){
        // food === "peas"
    }
});
$.ajax({ url: '/food/peas' });
```
### .destroy()
Restores the global XMLHttpRequest. 
