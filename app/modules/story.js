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
      console.log('json data into parse:', data);
      return data;
    }
    
    
  });
    
///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////

  Story.Views.List = Backbone.View.extend({
    template: "app/templates/story-list",

    initialize: function() {
      this.collection = app.StoryCollectionInstance;
      console.log("Story.View.List init, this.collection:", this.collection);
      this.collection.bind("reset", this.render(), this);
    },

    render: function(done) {
      console.log('collection:', this.collection);
      // Fetch the template.
      var tmpl = app.fetchTemplate(this.template);

      // Set the template contents.
      this.$el.html(tmpl({ stories: this.collection.toJSON() }));
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

    initialize: function() {
      this.collection = app.StoryCollectionInstance;
    },

    render: function(done) {
      // Fetch the template.
      console.log('detail has this.id=',this.id);
      console.log('this.collection in detail is', this.collection);
      
      this.model = this.collection.get(this.id);
      
      console.log('in story.views.detail', this.model);
      var tmpl = app.fetchTemplate(this.template);

      // Set the template contents.
      this.$el.html(tmpl({story: this.model}));
    }
  });
  

 
  console.log('in story.js: ', Story);
  return Story;
});
