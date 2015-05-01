# XhrFacade
Frontend utility for abstracting server-side endpoints.

## Documentation

### .ajax( request[, options] )
Performs async HTTP request(s). This method works similarly to [jQuery.ajax](http://api.jquery.com/jquery.ajax/) with a few key differences:

1. The request parameter can be an array of objects for making multiple calls in parallel.
2. By default, returns an [RSVP.Promise](https://github.com/tildeio/rsvp.js/) object that resolves after all requests have resolved. The array passed to the resolve callback will contain the responses in the same order that they were requested
2. Cached responses provided for multiple requests to a URL when "type" (GET, POST, etc) and "data" (the request payload) are the same

**.ajax( request )**

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

**.ajax( request, options )**

| Name | Type | Description |
| ---- | ---- | ----------- |
| **options** | Object | Configuration options for call. |

Configuration options:

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
### .create( type, url, response )
Configures virtual Ajax endpoints.

| Name | Type | Description |
| ---- | ---- | ----------- |
| **type** | String | The HTTP method for the virtual endpoint. |
| **url** | String or RegExp | The URL for the virtual endpoint. In addition to RegExp, URL patterns can be matched with a string value containing placeholders. See example below. |
| **response** | Function | The function that will respond to requests to the endpoint. The function will be passed ```req``` and ```res``` arguments. The ```req``` object contains info about the request and also inherits the facade's ```.ajax()``` method. The ```res``` object is used to respond to the request with a payload. |

```javascript
facade.create('GET', '/peas', function response(req, res){
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
function response( **req**, res )

| Property | Type | Description |
| ---- | ---- | ----------- |
| params | Object or Array | Contains URL fragments from the request. If the endpoint URL is defined as as a RegExp, it will be an array containing values from the capture groups. If the endpoint URL is defined as a String with placeholders, it will be an object where the placeholders act as keys. |
| query | Object | Contains key/value pairs representing URL parameters from the request. |
| ajax | Function | Same as ```facade.ajax``` above. |

```javascript
facade.create('GET', /\/food\/(\w+)/, function response(req, res){
        // req.params[0] === "peas"
        // req.query.dinner === "true"
});
$.ajax({ url: '/food/peas?dinner=true' });
```
The URL can be defined as a string with placeholders. In this case ```req.params``` will be an object with the placeholders acting as keys.
```javascript
facade.create('GET', '/food/:kind', function response(req, res){
        // req.params.kind === "peas"
        // req.query.dinner === "true"
});
$.ajax({ url: '/food/peas?dinner=true' });
```
#### res
function response( req, **res** )

| Property | Type | Description |
| ---- | ---- | ----------- |
| params | Object or Array | Contains URL fragments from the request. If the endpoint URL is defined as as a RegExp, it will be an array containing values from the capture groups. If the endpoint URL is defined as a String with placeholders, it will be an object where the placeholders act as keys. |
| send | Function | Responds to the XHR request with header Content-Type: 'plain/text'. Expects a String value argument that will be sent as the response payload. |
| json | Function | Responds to the XHR request with header Content-Type: 'application/json'. Expects an Object value argument that will be JSON stringified before being sent. |

### .destroy()
Restores the global XMLHttpRequest object.

### XhrFacade.getInstance()
A static method that returns a singleton instance.
