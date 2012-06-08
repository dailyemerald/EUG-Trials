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
      "schedule": "schedule",
      "photos": "instagram",
      "twitter": "twitter",
      "*other": "gohome"
    },
    
    initialize: function(options){
      this.pageWidth = 800;//window.innerWidth;
    },
    
    show: function () {
      
      $('.page').css({"position": "absolute"});
      
      var direction_coefficient = 1;//this.options.back ? 1 : -1;
      
      if ($('.page').length) {
          var $old = $('.page').not(this.newView);

          // This fix was hard-won -
          // just doing .css(property, '') doesn't work!
          $old.get(0).style["margin-left"] = "";
          $old.get(0).style["-webkit-transform"] = "";

          console.log('in show', this.newView);

          this.newView.appendTo($('#main')).hide();
          
          this.newView.show().css({
            "margin-left": this.pageWidth * direction_coefficient
          });
          
          this.newView.anim({
            translate3d: -1*this.pageWidth * direction_coefficient +'px, 0, 0'
          }, 0.3, 'ease-out', function() {
            //new view is all the way in
          });
          
          $old.anim({
            translate3d: -1*this.pageWidth * direction_coefficient + 'px, 0, 0'
          }, 0.3, 'ease-out', function() {
            $old.remove();
            //$('.page').css({"position": "static"});
          });
          
      } else {
          console.log('only one, so we got...', this.newView);
          this.newView.appendTo($('#main')).hide();
          this.newView.show();
      }
      window.scrollTo(0, 0);
    },
    
    // http://coenraets.org/blog/2012/01/backbone-js-lessons-learned-and-improved-sample-app/
    showView: function(selector, view) {
      if (this.currentView) {
        //this.currentView.close();
      }
      
      //view.$el = selector;
      //view.render();
      //window.scrollTo(0,1
      this.newView = view.render().$el;
      console.log(this.newView, "is this.newView now");
      this.show();
      
      //console.log('newView', newView);
      //newView.appendTo( selector );
      //console.log(selector);
      
      //$("#loading").hide();
      
      //this.currentView = view;
      //return view;
    },
    
    list: function() {
      
      //$("#main").html("<h2>Loading stories...</h2>"); //TODO: make this better...
      var list = new Story.Views.List({ 
      });
      
      this.showView($('#main'), list);
    
    },
    
    detail: function(id) {
      //$("#main").html("<h2>Loading story view...</h2>"); //TODO: make this better...
      var detail = new Story.Views.Detail({
        id: id
      });
      
      this.showView($('#main'), detail);

      //setTimeout(function () { window.scrollTo(0,1); }, 1);
    },
    
    schedule: function() {      
      //$("#main").html(scheduleTemplate);
      $("#loading").hide();
    },
    
    instagram: function() {
      console.log('instagram');
      
    },
    twitter: function() {
      console.log('twitter');
    },
    
    gohome: function() {
      console.log('well, this is weird. to /!');
	  Backbone.history.navigate('/', true);
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

    $("#info").hide();

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
  
  // if we don't have a touchstart, make a click trigger a tap. because we're not on a mobile device that supports it. right?
  if (!('touchstart' in window)) {
    $(document).on('click', 'body', function(evt) {
      $(evt.target).trigger('tap');
      evt.preventDefault();
    });
  }

});
