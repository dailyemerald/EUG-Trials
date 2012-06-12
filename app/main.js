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
  "modules/story",
  "modules/instagram",
  "modules/schedule"
],

function(app, $, Backbone, headerTemplate, footerTemplate, scheduleTemplate, loadingTemplate, Story, Instagram, Schedule) {

  // http://coenraets.org/blog/2012/01/backbone-js-lessons-learned-and-improved-sample-app/
  Backbone.View.prototype.close = function () {
      console.log('close()-ing view:', this);
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
      "": "storyMaster",
      "list": "storyMaster",
      "story/:id": "storyDetail",
      "schedule": "schedule",
      "photos": "instagram",
      "twitter": "twitter",
      "*other": "gohome"
    },
    
    initialize: function(options){
      this.main = $('#main'); // cache the selector. is this useful?
      //this.pageWidth = window.innerWidth;
      //this.pageDirection = 1;
    },
    
    // http://coenraets.org/blog/2012/01/backbone-js-lessons-learned-and-improved-sample-app/
    showView: function(view) {
      
      var path = window.location.pathname;
      
      if (this.currentView) {
        this.currentView.close();
      }
      
      this.newView = view.render().$el;
      
      window.viewCache = null;
      window.viewCache = this.newView;
          
      $('#main').html( this.newView ).hide();
      setTimeout(function() {
        $("#main").show();
      },1);
      /*$('img').css({opacity: 0});
      $('#main').css({opacity: 0}).show();
      
      $('#main').animate(  {translate3d: '0,0,0', opacity: 0}, 0,  'linear', function() {
        $('#main:not(img)').animate({translate3d: '0,0,0', opacity: 1}, 50, 'linear', function() {
          $('img').animate({translate3d: '0,0,0', opacity: 1}, 1000, 'linear')
        });  
      });
      */

      if (path in app.ScrollPositions) {
        window.scrollTo(0, 1+app.ScrollPositions[path]); 
      } else {
        window.scrollTo(0,1);
        app.ScrollPositions[path] = 0;
      }
    
    },
    
    storyMaster: function() {

      //this.pageDirection = -1;
      var list = new Story.Views.Master({ });   
      this.showView(list);
    
    },
    
    storyDetail: function(id) {
      //this.pageDirection = 1;

      var detail = new Story.Views.Detail({ id: id });
      this.showView(detail);
    },
    
    schedule: function() {      
      var view_ = new Schedule.Views.Master();
      this.showView(view_);
    },
    
    instagram: function() {
      var view_ = new Instagram.Views.Master();
      this.showView(view_);
    },
   
    gohome: function() {
      console.log('well, this is weird. to /');
      Backbone.history.navigate('/', true);
    }
    
  });

  // Treat the jQuery ready function as the entry point to the application.
  // Inside this function, kick-off all initialization, everything up to this
  // point should be definitions.
  $(function() {

    $("header").html(headerTemplate);
    $("footer").html(footerTemplate);
    //$("body").append(loadingTemplate);
    $("#backbutton").css({opacity:0});
    $("#backbutton").on('singleTap', function(evt) {
      console.log('backbutton tap');
      if (app.pageHistory.length > 1) {
        //evt.preventDefault();
        window.history.back();
      } 
    });

   // $("#info").hide();

    app.ScrollPositions = {};

    // spin up the collection instance for stories. TODO: this feels like the wrong spot to have this. why?
    app.StoryCollectionInstance = new Story.Collection();
    app.StoryCollectionInstance.fetch();        
    app.router = new Router();
    
    setTimeout(function() { window.scrollTo(0,1); }, 1);
    
    Backbone.history.start({ pushState: true });
  });
  
  // All navigation that is relative should be passed through the navigate
  // method, to be processed by the router.  If the link has a data-bypass
  // attribute, bypass the delegation completely.
  //$(document).on(mobileTapEvent, "a:not([data-bypass])", function(evt) {
  $(document).on('singleTap', 'a:not([data-bypass])', function(evt) {
    //console.log('inside', mobileTapEvent, "handler");
 
    var href = $(this).attr("href");
    var protocol = this.protocol + "//";

    if (href && href.slice(0, protocol.length) !== protocol && href.indexOf("javascript:") !== 0) {
      //$("#loading").show();
      evt.preventDefault();      
      app.pageHistory.push(href);
      
      $('#backbutton').animate({opacity:1}, 400, 'linear');
      
      app.ScrollPositions[window.location.pathname] = document.body.scrollTop;
      console.log(document.body.scrollTop);
      
      console.log(app.ScrollPositions);
      
      console.log('pageHistory:',app.pageHistory);
      Backbone.history.navigate(href, true);
    } 
      
  });
  
  // if we don't have a touchstart, make a click trigger a tap. because we're not on a mobile device that supports it. right?
  if (!('touchstart' in window)) {
    $(document).on('click', 'body', function(evt) {
      $(evt.target).trigger('singleTap');
      evt.preventDefault();
    });
  } 

});
