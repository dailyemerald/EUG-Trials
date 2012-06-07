require([
  "app",

  // Libs
  "zepto",//"jquery",
  "backbone",
  //"masseuse",
  
  "text!templates/header.html",
  "text!templates/footer.html",
  "text!templates/schedule.html",
  "text!templates/loading.html",
  
  // Modules
  "modules/story"
],

function(app, $, Backbone, headerTemplate, footerTemplate, scheduleTemplate, loadingTemplate, Story) {

  // http://coenraets.org/blog/2012/01/backbone-js-lessons-learned-and-improved-sample-app/
  Backbone.View.prototype.close = function () {
      console.log('in our new close method...', this);
      if (this.beforeClose) {
          this.beforeClose();
      }
      this.remove();
      this.unbind();
  };

  app.pageHistory = [];

  // Defining the application router, you can attach sub routers here.
  var Router = Backbone.Router.extend({
    routes: {
      "": "list",
      "list": "list",
      "story/:id": "detail",
      "schedule": "schedule"
    },
    
    initialize: function(options){
    },
    
    // http://coenraets.org/blog/2012/01/backbone-js-lessons-learned-and-improved-sample-app/
    showView: function(selector, view) {
      if (this.currentView) {
        this.currentView.close();
      }
      
      //view.$el = selector;
      //view.render();
      //window.scrollTo(0,1);
      selector.html(view.render().el);
      
      $("#loading").hide();
      
      this.currentView = view;
      //return view;
    },
    
    list: function() {
      
      $("#main").html("<h2>Loading stories...</h2>"); //TODO: make this better...
      var list = new Story.Views.List({ 
      });
      
      this.showView($('#main'), list);
    
    },
    
    detail: function(id) {
      $("#main").html("<h2>Loading story view...</h2>"); //TODO: make this better...
      var detail = new Story.Views.Detail({
        id: id
      });
      
      this.showView($('#main'), detail);

      //setTimeout(function () { window.scrollTo(0,1); }, 1);
    },
    
    schedule: function() {      
      $("#main").html(scheduleTemplate);
      $("#loading").hide();
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
    $("body").append(loadingTemplate);
    $("#back-button").tap(function(evt) {
      if (app.pageHistory.length > 1) {
        //evt.preventDefault();
        window.history.back();
      }
    });

    // spin up the collection instance for stories. TODO: this feels like the wrong spot to have this. why?
    app.StoryCollectionInstance = new Story.Collection();
    app.StoryCollectionInstance.fetch();   
        
    app.router = new Router();
    
    Backbone.history.start({ pushState: true });
  });
  
  // All navigation that is relative should be passed through the navigate
  // method, to be processed by the router.  If the link has a data-bypass
  // attribute, bypass the delegation completely.
  //$(document).on(mobileTapEvent, "a:not([data-bypass])", function(evt) {
  $(document).on('tap', 'a:not([data-bypass])', function(evt) {
    //console.log('inside', mobileTapEvent, "handler");
 
    var href = $(this).attr("href");
    var protocol = this.protocol + "//";

    if (href && href.slice(0, protocol.length) !== protocol && href.indexOf("javascript:") !== 0) {
      //$("#loading").show();
      evt.preventDefault();
      app.pageHistory.push(href);
      
      console.log('pageHistory:',app.pageHistory);
      Backbone.history.navigate(href, true);
    } 
      
  });
  
  /*$('.story-detail').on('swipe', function() { //TODO: move to module
    Backbone.history.navigate('/', true);
  });*/
  
  if (!('touchstart' in window)) {
    $(document).on('click', 'body', function(evt) {
      $(evt.target).trigger('tap');
      evt.preventDefault();
    });
  }

});
