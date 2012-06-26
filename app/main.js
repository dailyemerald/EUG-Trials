require([
  "app",

  // Libs
  "zepto",//"jquery",
  "backbone",
  "hammer",
  //"masseuse",
  
  "text!templates/header.html",
  "text!templates/footer.html",
  "text!templates/schedule.html",
  "text!templates/loading.html",
  
  // Modules
  "modules/story",
  "modules/instagram",
  "modules/schedule",
  "modules/about",
  "modules/fourohfour"
],

function(app, $, Backbone, Hammer, headerTemplate, footerTemplate, scheduleTemplate, loadingTemplate, Story, Instagram, Schedule, About, Fourohfour) {

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
      url: urlBase + encodeURIComponent(JSON.stringify(data))
    });
  };
    
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
      "*other": "fourohfour"
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
        //console.log('closing', this.currentView);
        this.currentView.close();
      }
      this.currentView = null;
    
      var newViewDOM = newView.render().$el;
      this.main.html(newViewDOM); //DOM manipulation!
      
      var _lstime = new Date();
      var pathnameIndex = null;
      try {
        pathnameIndex = JSON.parse(localStorage.pathnameIndex);
      } catch (e) {        
        localStorage.pathnameIndex = JSON.stringify( {} ); //rebuild it if we fail
        pathnameIndex = JSON.parse(localStorage.pathnameIndex);
      }
      
      if (pathnameIndex) {
        if (pathnameIndex[pathname]) {
          window.scrollTo(0, 1+pathnameIndex[pathname]);
        } else {
          pathnameIndex[pathname] = 0;
          window.scrollTo(0, 1);
        }
        localStorage.pathnameIndex = JSON.stringify(pathnameIndex);
      }
      //log({'info': 'time to unpack/pack localStorage.pathnameIndex', 'time': new Date()-_lstime}); //this is as much as 20ms on an iphone 4S.
    
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
   
    fourohfour: function() {
      //console.log('well, this is weird. to /');
      var view_ = new Fourohfour.View();
      this.showView(view_);
      //Backbone.history.navigate('/', true);
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

    log({"info": "DOM ready", "timestamp": new Date()});

    app.pageHistory.push(window.location.pathname); //put our landing page in there!

    $("header").html(headerTemplate);
    $("footer").html(footerTemplate);
    
    $("#backbutton").css({opacity:0});
    $("#backbutton").on('tap', function(evt) {
      //console.log('backbutton tap');
      
      log({
        "action": "backbutton", 
        "timestamp": new Date()
      });//TODO: hack
      
      if (app.pageHistory.length >= 2) {
        evt.preventDefault();
        //window.history.back();
        var currentPage = app.pageHistory.pop();
        var pageToGoTo = app.pageHistory.pop();
        requestPageChange( pageToGoTo );

        //Backbone.history.navigate(lastPage, true);
        //app.pageHistory.pop();
        //window.history.back();
        if (app.pageHistory.length < 2) {
          $("#backbutton").css({opacity:0}).hide();
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
  
  var requestPageChange = function(href) {
    
    if (app.allowClick === true) {
      
      app.allowClick = false;
      setTimeout(function() {
        app.allowClick = true; // TODO: seems way hacky.
      }, 450);
      
      app.pageHistory.push(href);

      if ($('#backbutton').css('opacity') < 1) {
        $('#backbutton').show().animate({opacity:1}, 100, 'linear');
      }
    
    
      var pathnameIndex = null;
      try {
        pathnameIndex = JSON.parse(localStorage.pathnameIndex);
      } catch (e) {        
        localStorage.pathnameIndex = JSON.stringify( {} ); //rebuild it if we fail
        pathnameIndex = JSON.parse(localStorage.pathnameIndex);
        //console.log("rebuilding localStorage.pathnameIndex");
      }
      try {
        pathnameIndex[href] = document.body.scrollTop;
        localStorage.pathnameIndex = JSON.stringify(pathnameIndex);
        //console.log(localStorage.pathnameIndex);
        
      } catch (e) {
        log({"error": "couldn't write to localStorage in requestPageChange"});
      }
      
      log({
        "action": "requestPageChange", 
        "timestamp": new Date(), 
        "href": href//,
        //"pageHistory": app.pageHistory
      });//TODO: hack
      
      Backbone.history.navigate(href, true); //this should be the ONLY place navigate is called.
    } else {
      log({
        "error": "allowClick si false, but tap event fired. not changing pages.",
        "href": href,
        "pageHistory": app.pageHistory
      });
    }
  };
  
  // All navigation that is relative should be passed through the navigate
  // method, to be processed by the router.  If the link has a data-bypass
  // attribute, bypass the delegation completely.
  //$(document).on(mobileTapEvent, "a:not([data-bypass])", function(evt) {
  
  var hammer = new Hammer(document.body); //TODO: Zepto?
  //console.log('hammer instance', hammer);
  
  hammer.ontap = function(e) {
    var touchedEl = $(e.originalEvent.target);
    
    if (touchedEl.attr('href')) {
      requestPageChange( touchedEl.attr('href') );
      log({'hammer':'tap on href primary'});
      
    } else if (touchedEl.parent().attr('href')) {
      requestPageChange( touchedEl.parent().attr('href') );
      log({'hammer':'tap on href parent'});
      
    } else {
      log({'hammer':'tap, but not handled'});
    }
    //e.preventDefault();
  };
  
  /*  
  $(document).on('tap','a:not([data-bypass])', function(evt) {
    //console.log('inside', mobileTapEvent, "handler");
 
    var href = $(this).attr("href");
    var protocol = this.protocol + "//";

    if (href && href.slice(0, protocol.length) !== protocol && href.indexOf("javascript:") !== 0) {
      //$("#loading").show();
      evt.preventDefault();      
      requestPageChange(href);
    } else {
      log({
        "error": "tap fired, but href didn't match the if. hmm!"
      });
    }
      
  });
  
  // if we don't have a touchstart, make a click trigger a tap. because we're not on a mobile device that supports it. right?
  if (!('touchstart' in window)) {
    $(document).on('click', 'body', function(evt) {
      
      log({
        "info": "because no touchstart, turning click into tap...now"
      });
      
      $(evt.target).trigger('tap');
      evt.preventDefault();
    });
    
  } else {
    
    
  }
  */

  $(document).on('click', 'body', function(evt) {
    evt.preventDefault();
    return false;
  });

});
