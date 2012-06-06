require([
  "app",

  // Libs
  "zepto",//"jquery",
  "backbone",
  //"masseuse",
  
  "text!templates/header.html",
  "text!templates/footer.html",
  "text!templates/schedule.html",
  
  // Modules
  "modules/example",
  "modules/story"
],

function(app, $, Backbone, headerTemplate, footerTemplate, scheduleTemplate, Example, Story) {

  // Defining the application router, you can attach sub routers here.
  var Router = Backbone.Router.extend({
    routes: {
      "": "list",
      "list": "list",
      "story/:id": "detail",
      "schedule": "schedule",
      "*var": "wildcard"
    },
    
    list: function() {
      $("#main").html("<h2>Loading stories...</h2>"); //TODO: make this better...
      var list = new Story.Views.List();
      list.$el = $("#main");
      list.render();
      setTimeout(function () { window.scrollTo(0,1); }, 1);
    },
    
    detail: function(id) {
      $("#main").html("<h2>Loading story view...</h2>"); //TODO: make this better...
      var detail = new Story.Views.Detail({
        id: id
      });
      detail.$el = $("#main");
      detail.render();
      setTimeout(function () { window.scrollTo(0,1); }, 1);
    },
    
    schedule: function() {
      $("#main").html(scheduleTemplate);
    },
    
    wildcard: function() {
      //console.log('wildcard route');
    }
    
  });

  // Treat the jQuery ready function as the entry point to the application.
  // Inside this function, kick-off all initialization, everything up to this
  // point should be definitions.
  $(function() {

    $("header").html(headerTemplate);
    $("footer").html(footerTemplate);
    $("#back-button").tap(function(evt) {
      window.history.back();
    });

    // spin up the collection instance for stories. TODO: this feels like the wrong spot to have this. why?
    app.StoryCollectionInstance = new Story.Collection();
    app.StoryCollectionInstance.fetch();   
        
    app.router = new Router();
    
    Backbone.history.start({ pushState: true });
  });



  // bounce clicks to taps if we're a browers and don't make taps.
  // http://getintothis.com/blog/2012/03/04/triggering-zepto-tap-event-using-click/
/*
  if (!(mobileTapEvent in window)) {
    //console.log('not mobile');
    $(document).delegate('body', 'click', function(evt){
      //console.log('about to manually trigger', mobileTapEvent);
      $(evt.target).trigger( mobileTapEvent );
      evt.preventDefault();
    });
  } else {
    //console.log('mobile');
  }
  */
  
  // All navigation that is relative should be passed through the navigate
  // method, to be processed by the router.  If the link has a data-bypass
  // attribute, bypass the delegation completely.
  //$(document).on(mobileTapEvent, "a:not([data-bypass])", function(evt) {
  $(document).on('tap', 'a:not([data-bypass])', function(evt) {
    //console.log('inside', mobileTapEvent, "handler");
 
      var href = $(this).attr("href");
      var protocol = this.protocol + "//";

      if (href && href.slice(0, protocol.length) !== protocol && href.indexOf("javascript:") !== 0) {
        evt.preventDefault();
        Backbone.history.navigate(href, true);
      } else {
        //console.log('boo')
        //evt.preventDefault();
      } 
    
  });
  $(document).on('click', 'body', function(evt) {
    $(evt.target).trigger('tap');
    evt.preventDefault();
  });

});
