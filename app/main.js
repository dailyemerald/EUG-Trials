require([
  "app",

  // Libs
  "jquery",
  "backbone",
  "masseuse",
  
  // Modules
  "modules/example",
  "modules/story"
],

function(app, $, Backbone, Masseuse, Example, Story) {

  // Defining the application router, you can attach sub routers here.
  var Router = Backbone.Router.extend({
    routes: {
      "": "list",
      "list": "list",
      "story/:id": "detail",
      "*var": "wildcard"
    },
    
    list: function() {
      $("#main").html("<h2>Loading stories...</h2>"); //TODO: make this better...
      var list = new Story.Views.List();
      list.$el = $("#main");
      list.render();
      //setTimeout(function () { window.scrollTo(0,1); }, 1);
    },
    
    detail: function(id) {
      $("#main").html("<h2>Loading story view...</h2>"); //TODO: make this better...
      var detail = new Story.Views.Detail({
        id: id
      });
      detail.$el = $("#main");
      detail.render();
      //setTimeout(function () { window.scrollTo(0,1); }, 1);
    },
    
    wildcard: function() {
      console.log('wildcard route');
    }
    
  });

  // Treat the jQuery ready function as the entry point to the application.
  // Inside this function, kick-off all initialization, everything up to this
  // point should be definitions.
  $(function() {

    // spin up the collection instance for stories. TODO: this feels like the wrong spot to have this. why?
    app.StoryCollectionInstance = new Story.Collection();
    app.StoryCollectionInstance.fetch();   
        
    // Define your master router on the application namespace and trigger all
    // navigation from this instance.
    app.router = new Router();
    
    Backbone.history.start({ pushState: true });
  });


  var mobileTapEvent = 'touchstart';

  // bounce clicks to taps if we're a browers and don't make taps.
  // http://getintothis.com/blog/2012/03/04/triggering-zepto-tap-event-using-click/
  
  if (!(mobileTapEvent in window)) {
    console.log('not mobile');
    $(document).delegate('body', 'click', function(evt){
      console.log('about to manually trigger', mobileTapEvent);
      $(evt.target).trigger( mobileTapEvent );
      evt.preventDefault();
      //return false;
    });
  } else {
    console.log('mobile');
  }
  
  /*$(document).on('touchstart', 'a', function(evt) {
    console.log('>> touchstart');
  });
  */

  // All navigation that is relative should be passed through the navigate
  // method, to be processed by the router.  If the link has a data-bypass
  // attribute, bypass the delegation completely.
  //$(document).on(mobileTapEvent, "a:not([data-bypass])", function(evt) {
    $(document).on(mobileTapEvent, "a:not([data-bypass])", function(evt) {
      
    console.log('inside', mobileTapEvent, "handler");
    
      // Get the anchor href and protcol
    //if ($(this).attr("href") !== undefined) {
    //  console.log('using $(this)');
      var href = $(this).attr("href");
      var protocol = this.protocol + "//";
    //} else {
      //console.log('using evt.target');
      //var href = $(evt.target).attr("href");
    //  var protocol = evt.target.protocol + "//";
    //}
    
    //console.log(href, protocol);

    // Ensure the protocol is not part of URL, meaning its relative.
    if (href && href.slice(0, protocol.length) !== protocol && href.indexOf("javascript:") !== 0) {
      // Stop the default event to ensure the link will not cause a page
      // refresh.
      evt.preventDefault();
      //alert('caught');
      // `Backbone.history.navigate` is sufficient for all Routers and will
      // trigger the correct events.  The Router's internal `navigate` method
      // calls this anyways.
      Backbone.history.navigate(href, true);

    } else {
      alert('oops');
      evt.preventDefault();
    }
  });
  
});
