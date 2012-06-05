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
      console.log('list:', Story);
      var list = new Story.Views.List();
      list.$el = $("#main");
      list.render();
    },
    
    detail: function(id) {
      var detail = new Story.Views.Detail({
        id: id
      });
      detail.$el = $("#main");
      detail.render();
    },
    
    wildcard: function() {
      console.log('wildcard route');
    }
    
  });

  //console.log('Masseuse:', Masseuse);

  // Treat the jQuery ready function as the entry point to the application.
  // Inside this function, kick-off all initialization, everything up to this
  // point should be definitions.
  $(function() {
    console.log('inside $');
   
     // spin up the collection instance for stories. TODO: this feels like the wrong spot to have this. why?
        app.StoryCollectionInstance = new Story.Collection();
        console.log(app.StoryCollectionInstance, "app.StoryCollectionInstance in main.js $");
        app.StoryCollectionInstance.fetch();   
        console.log(app.StoryCollectionInstance, "app.StoryCollectionInstance in main.js $ (after)");
     
   
   
    // Define your master router on the application namespace and trigger all
    // navigation from this instance.
    app.router = new Router();
    console.log('post app.router spinup');

    // Trigger the initial route and enable HTML5 History API support
    Backbone.history.start({ pushState: true });
    console.log('post history');
   
   
  });

  // All navigation that is relative should be passed through the navigate
  // method, to be processed by the router.  If the link has a data-bypass
  // attribute, bypass the delegation completely.
  $(document).on("click", "a:not([data-bypass])", function(evt) {
    // Get the anchor href and protcol
    var href = $(this).attr("href");
    var protocol = this.protocol + "//";

    // Ensure the protocol is not part of URL, meaning its relative.
    if (href && href.slice(0, protocol.length) !== protocol && href.indexOf("javascript:") !== 0) {
      // Stop the default event to ensure the link will not cause a page
      // refresh.
      evt.preventDefault();

      // `Backbone.history.navigate` is sufficient for all Routers and will
      // trigger the correct events.  The Router's internal `navigate` method
      // calls this anyways.
      Backbone.history.navigate(href, true);
    }
  });

});
