# XhrFacade
Frontend utility for abstracting server-side endpoints. XhrFacade makes it possible to create "virtual" endpoints on the client by intercepting XMLHTTPRequests and providing a promise-based API for proxying to one or more server-side endpoints before returning a customized payload to the original request. Useful for single-page apps that mashup data from disparate sources in order to display a unified resource, or to create a clean, custom REST API on the client.

## Documentation
### Constructor
```
var facade = new XhrFacade();
```
A singleton instance can also be accessed using a static method:
```
var facade = XhrFacade.getInstance();
```

### facade.ajax( request[, options] )
Performs async HTTP request(s). This method works similarly to [jQuery.ajax](http://api.jquery.com/jquery.ajax/) with a few key differences:

1. The request parameter can be an array of objects for making multiple calls in parallel.
2. By default, returns an [RSVP.Promise](https://github.com/tildeio/rsvp.js/) object that resolves after all requests have resolved. The array passed to the resolve callback will contain the responses in the same order that they were requested
2. Cached responses provided for multiple requests to a URL when "type" (GET, POST, etc) and "data" (the request payload) are the same

facade.ajax( **request** )

| Name | Type | Description |
| ---- | ---- | ----------- |
| **request** | Object, Array | A settings object for the request. Pass an array with multiple settings objects to perform multiple requests. The settings objects are passed to jQuery.ajax and therefore can contain any of [the properties supported by jQuery.ajax](http://api.jquery.com/jquery.ajax/#jQuery-ajax-settings). |

```javascript
var facade = new XhrFacade();
facade.ajax([{ url: '/peas' }, { url: '/carrots' }])
  .then(function(responses){
    // responses[0].state === "fulfilled"
    // responses[0].value == peas response...
    // responses[1].state === "fulfilled"
    // responses[1].value == carrots response...
  });
```
XhrFacade augments RSVP.Promise with a "spread" method that passes the response objects to the callback as separate arguments.
```javascript
facade.ajax([{ url: '/peas' }, { url: '/carrots' }])
  .spread(function(peas, carrots){
    // peas.value == peas response...
    // carrots.value == carrots response...
  });
```
```javascript
facade.ajax([{ url: '/peas' }, { url: '/carrots' }, 'hello!'] )
  .spread(function(peas, carrots, message){
    // message.value === 'hello!'
  });
```

facade.ajax( request, **options** )

An object containing configuration options for the request

| Name | Type | Required | Description |
| ---- | ---- | -------- | ----------- |
| aggregator | Function | No | A custom function for handling the jqXHR object(s) for the request(s). Defaults to RSVP.allSettled |
| proxyTo | Function | No | The function to use for making calls. Defaults to jQuery.ajax |
| match | Function | No | When making an Ajax request with facade.ajax(), this comparator function will be used to determine whether to respond to the request with a previously cached payload. The function takes the previous and current requests to the endpoint as arguments. Defaults to the static function ```XhrFacade.match``` |


```javascript
facade.ajax({url: '/peas'}, {
    aggregator: function(promises){
        return $.when.apply($, promises);
    }
}).done(function(response, textStatus, jqXHR){
    // response == peas response...
    // textStatus === "success"
    // jqXHR.status === 200
});
```
### facade.add( type, url, response )
Configures virtual Ajax endpoints.

| Name | Type | Description |
| ---- | ---- | ----------- |
| **type** | String | The HTTP method for the virtual endpoint. |
| **url** | String or RegExp | The URL for the virtual endpoint. In addition to RegExp, URL patterns can be matched with a string value containing placeholders. See example below. |
| **response** | Function | The function that will respond to requests to the endpoint. The function will be passed ```req``` and ```res``` arguments. The ```req``` object contains info about the request and also inherits the facade's ```.ajax()``` method. The ```res``` object is used to respond to the request with a payload. |

```javascript
facade.add('GET', '/peas', function response(req, res){
        res.json({
            latin: 'Pisum sativum',
            type: 'fruit',
            color: 'green'
        });
    }
});
$.ajax({
    url: '/peas',
    success: function(data){
        // data.latin === 'Pisum sativum' etc.
    }
});
```

#### req
facade.create(type, url, function( **req**, res ){ ...

| Property | Type | Description |
| ---- | ---- | ----------- |
| params | Object or Array | Contains URL fragments from the request. If the endpoint URL is defined as as a RegExp, it will be an array containing values from the capture groups. If the endpoint URL is defined as a String with placeholders, it will be an object where the placeholders act as keys. |
| query | Object | Contains key/value pairs representing URL parameters from the request. |
| ajax | Function | Same as ```facade.ajax``` above. |

```javascript
facade.add('GET', /\/food\/(\w+)/, function response(req, res){
        // req.params[0] === "peas"
        // req.query.dinner === "true"
});
$.ajax({ url: '/food/peas?dinner=true' });
```
The URL can be defined as a string with placeholders. In this case ```req.params``` will be an object with the placeholders acting as keys.
```javascript
facade.add('GET', '/food/:kind', function response(req, res){
        // req.params.kind === "peas"
        // req.query.dinner === "true"
});
$.ajax({ url: '/food/peas?dinner=true' });
```
#### res
facade.add(type, url, function( req, **res** ){ ...

| Property | Type | Description |
| ---- | ---- | ----------- |
| send | Function | Responds to the XHR request with header Content-Type: 'plain/text'. Expects a String value argument that will be sent as the response payload. |
| json | Function | Responds to the XHR request with header Content-Type: 'application/json'. Expects an Object value argument that will be JSON stringified before being sent. |
| sendStatus | Function | Responds to request with a status code and corresponding string value as response body. |

```
facade.add('GET', '/food/:kind', function(req, res){
  if( req.params.kind === 'apple' )
    res.sendStatus(403);
});
$.get('/food/apple').fail(function(jqXhr, textStatus, error){
  // error === 'Forbidden'
});
```
### facade.remove(endpoint)
Removes previously added virtual endpoints. Subsequent calls to the endpoint will not be intercepted by the facade and will instead pass through to the server.
```
var endpoint = facade.add('GET', '/food/:kind', function(req, res){});
facade.remove(endpoint);
```

### facade.destroy()
Removes any created endpoints and restores the global XMLHttpRequest object.

