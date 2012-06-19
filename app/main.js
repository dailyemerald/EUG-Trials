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
  "modules/schedule",
  "modules/about"
],

function(app, $, Backbone, headerTemplate, footerTemplate, scheduleTemplate, loadingTemplate, Story, Instagram, Schedule, About) {

  // http://coenraets.org/blog/2012/01/backbone-js-lessons-learned-and-improved-sample-app/
  Backbone.View.prototype.close = function () {
      //console.log('close()-ing view:', this);
      if (this.beforeClose) {
          this.beforeClose();
      }
      this.remove();
      this.unbind();
      //console.log('post remove/unbind:', this);
  };

  app.pageHistory = [];
  app.allowClick = true;

  window.log = function(data) { // TODO: less hacky than the window bind?
    var urlBase = "http://dev.dailyemerald.com:4321/log/";
    $.ajaxJSONP({
      url: urlBase + JSON.stringify(data)
    });
  }

  // Defining the application router, you can attach sub routers here.
  var Router = Backbone.Router.extend({
    routes: {
      "": "storyMaster",
      "list": "storyMaster",
      "story/:id": "storyDetail",
      "schedule": "schedule",
      "photos": "instagram",
      "twitter": "twitter",
      "about" :"about",
      "*other": "gohome"
    },
    
    initialize: function(options){
      this.main = $('#main'); // cache the selector. is this useful?
      //this.pageWidth = window.innerWidth;
      //this.pageDirection = 1;
    },
    
    // http://coenraets.org/blog/2012/01/backbone-js-lessons-learned-and-improved-sample-app/
    showView: function(newView) {
      
      var pathname = window.location.pathname;
    
      log({
        "action": "showView", 
        "timestamp": new Date(), 
        "pathname": pathname
      });//TODO: hack
    
      if (this.currentView) {
        console.log('closing', this.currentView);
        this.currentView.close();
      }
      this.currentView = null;
    
      var newViewDOM = newView.render().$el;
      this.main.html(newViewDOM);
      
      if (pathname in app.ScrollPositions) {
        window.scrollTo(0, 1 + app.ScrollPositions[pathname]); 
      } else {
        window.scrollTo(0, 1);
        app.ScrollPositions[pathname] = 0;
      }
      //this.main.find('img').hide();
      //setTimeout(function() {
        console.log('calling timeago');
        $('time').timeago();  
      //}, 5);
      
      /*
      this.main.find('img').forEach(function($el) {
        $el.attr('src',$el.attr('data-img'));
      });
      */

      /*
      var self = this;
        
      this.main.animate({opacity: 0}, 100, 'linear', function() {
    
        $(this).html(newViewDOM); //$(this) is $("#main") (right?)
        
        if (self.currentView) {
          console.log('closing', self.currentView);
          self.currentView.close();
        }
        self.currentView = null;
        
        if (pathname in app.ScrollPositions) {
          window.scrollTo(0, 1 + app.ScrollPositions[pathname]); 
        } else {
          window.scrollTo(0, 1);
          app.ScrollPositions[pathname] = 0;
        }
        
        $('time').timeago();
        //app.allowClick = true;

        $(this).animate({opacity: 1}, 100, 'linear', function() {
          console.log('done');
          
          self.currentView = newView;
          
        });
        
        
    
      });
      */  
     

      
      
      /*while ($("#main").children().length > 1) {
        $("#main").children().eq(0).remove();
        console.log("blam!");
      }
      */
      
        
      //},1);
      /*$('img').css({opacity: 0});
      $('#main').css({opacity: 0}).show();
      
      $('#main').animate(  {translate3d: '0,0,0', opacity: 0}, 0,  'linear', function() {
        $('#main:not(img)').animate({translate3d: '0,0,0', opacity: 1}, 50, 'linear', function() {
          $('img').animate({translate3d: '0,0,0', opacity: 1}, 1000, 'linear')
        });  
      });
      */

      
    
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
    },
    
    about: function() {
      var view_ = new About.Views.Master();
      this.showView(view_);
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
    $("#backbutton").on('tap', function(evt) {
      console.log('backbutton tap');
      
      log({
        "action": "backbutton", 
        "timestamp": new Date()
      });//TODO: hack
      
      if (app.pageHistory.length > 0) {
        evt.preventDefault();
        window.history.back();

        //Backbone.history.navigate(lastPage, true);
        //app.pageHistory.pop();
        //window.history.back();
        if (app.pageHistory.length === 0) {
          //$("#backbutton").css({opacity:0});
        }
      } 
    });

   // $("#info").hide();

    app.ScrollPositions = {};

    // spin up the collection instance for stories. TODO: this feels like the wrong spot to have this. why?
    app.StoryCollectionInstance = new Story.Collection();
    app.StoryCollectionInstance.fetch();        
    app.router = new Router();
    
    //setTimeout(function() { window.scrollTo(0,1); }, 1);
    
    Backbone.history.start({ pushState: true });
  });
  
  // All navigation that is relative should be passed through the navigate
  // method, to be processed by the router.  If the link has a data-bypass
  // attribute, bypass the delegation completely.
  //$(document).on(mobileTapEvent, "a:not([data-bypass])", function(evt) {
  $(document).on('tap','a:not([data-bypass])', function(evt) {
    //console.log('inside', mobileTapEvent, "handler");
 
    var href = $(this).attr("href");
    var protocol = this.protocol + "//";

    if (href && href.slice(0, protocol.length) !== protocol && href.indexOf("javascript:") !== 0) {
      //$("#loading").show();
      evt.preventDefault();      
      
      if (app.allowClick === true) {
        
        app.allowClick = false;
        setTimeout(function() {
          app.allowClick = true; // TODO: seems way hacky.
        }, 450);
        
        app.pageHistory.push(href);
      
        if ($('#backbutton').css('opacity') < 1) {
          $('#backbutton').animate({opacity:1}, 500, 'linear');
        }
      
        app.ScrollPositions[window.location.pathname] = document.body.scrollTop;
      
        console.log('pageHistory:',app.pageHistory);
        
        log({
          "action": "tap", 
          "timestamp": new Date(), 
          "href": href
        });//TODO: hack
        
        Backbone.history.navigate(href, true);
      } else {
        console.log('allowClick false, but tap here...', href);
      }
    } 
      
  });
  
  // if we don't have a touchstart, make a click trigger a tap. because we're not on a mobile device that supports it. right?
  if (!('touchstart' in window)) {
    $(document).on('click', 'body', function(evt) {
      $(evt.target).trigger('tap');
      evt.preventDefault();
    });
  } else {
    $(document).on('click', 'body', function(evt) {
      evt.preventDefault();
      alert('got a click, even though weve got touchstart...');
      return false;
    });
  }

});
