define([
  // Global application context.
  "app",

  // Third-party libraries.
  "backbone"
],

function(app, Backbone) {
  
  var Story = app.module();

  Story.Model = Backbone.Model.extend({
    // nothing yet
  });
  
  Story.Collection = Backbone.Collection.extend({
    model: Story.Model,
    url: 'http://dailyemerald.com/section/track-field/json?callback=?',
    parse: function(data) {
      console.log('Story.Collection: json data into parse:', data);
      return data;
    }
    
    
  });
    
///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////

  Story.Views.Master = Backbone.View.extend({
    template: "app/templates/story-master",
    tagName: "section",
    className: "page",

    initialize: function() {
      this.collection = app.StoryCollectionInstance;
      console.log("Story.View.List init, this.collection:", this.collection);
    
      this.collection.bind("reset", this.render, this);
    },

    render: function(done) {
      console.log('s v l: render: collection:', this.collection);
      // Fetch the template.
      var tmpl = app.fetchTemplate(this.template);

      // Set the template contents.
      this.$el.html(tmpl({ stories: this.collection.toJSON() }));
      //console.log(this.$el);
      
      return this;
    }
    
  });
  
  /*
  Story.Views.ListItem = Backbone.View.extend({
    tagName: 'li'
    className: 'story-list-item'
    template: "app/templates/story-list-item",
    
    render: function(done) {
      
    }
  });
  */


///////////////////////////////////////////////////////////////////////  
///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////

  
  // drill down into one story
  Story.Views.Detail = Backbone.View.extend({
    template: "app/templates/story-detail",
    tagName: "section",
    className: "page",

    initialize: function() {
      this.collection = app.StoryCollectionInstance;
      this.collection.bind('reset', this.render, this);
    },

    render: function(done) {
      // Fetch the template.
      //console.log('detail has this.id=',this.id);
      //console.log('this.collection in detail is', this.collection);
      
      this.model = this.collection.get(this.id);
      
      if (this.model) {
   
        //console.log('in story.views.detail', this.model);
        var tmpl = app.fetchTemplate(this.template);

        // Set the template contents.
        this.$el.html(tmpl({story: this.model.toJSON() }));
        return this;
      } else {
        //console.log('dont have a model yet in s v d');
        this.$el.html("Waiting for data...");
        return this;
      }
    }
  });
  

  //console.log('in story.js: ', Story);
  return Story;
});
