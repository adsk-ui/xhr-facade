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

**.ajax( request, options )**

| Name | Type | Description |
| ---- | ---- | ----------- |
| **options** | Object | Configuration options for call. See below. |

Ajax configuration settings:

| Name | Type | Required | Description |
| ---- | ---- | -------- | ----------- |
| aggregator | Function | No | A custom function for handling the jqXHR object(s) for the request(s). |


```javascript
facade.ajax([{ url: '/peas' }, { url: '/carrots' }, 'hello!'] )
  .spread(function(peas, carrots, message){
    // message.value === 'hello!'
  });
```

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
### .create( options )
Configures virtual Ajax endpoints.

**.create( options )**

| Name | Type | Description |
| ---- | ---- | ----------- |
| **options** | Object, Array | The configuration settings for the virtual endpoint. Pass an array of objects to configure multiple endpoints at once. |

Options for configuration settings:

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
Restores the global XMLHttpRequest object.

### XhrFacade.getInstance()
A static method that returns a singleton instance.
