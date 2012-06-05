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
      
      var self = this;
      
      this.collection = new Story.Collection();
      this.collection.bind("reset", function() {
        self.render();
      });
      
      this.collection.fetch();
      
      console.log('hi')
    },

    render: function(done) {
      console.log('collection:', this.collection);
      // Fetch the template.
      var tmpl = app.fetchTemplate(this.template);

      // Set the template contents.
      this.$el.html(tmpl({stories: this.collection.toJSON() }));
    }
  });
  
  /*
  Story.Views.ListItem = Backbone.View.extend({
    tagName: 'li'
    className: 'story-list-item'
    template: "app/templates/story-list-item",
    
    render: function(done) {
      
    }
  });//*/


///////////////////////////////////////////////////////////////////////  
///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////

  
  // drill down into one story
  Story.Views.Detail = Backbone.View.extend({
    template: "app/templates/story-detail",

    render: function(done) {
      // Fetch the template.
      console.log('in story.views.detail', this.model)
      var tmpl = app.fetchTemplate(this.template);

      // Set the template contents.
      this.$el.html(tmpl({story: this.model}));
    }
  });
  

 
  console.log('in story.js: ', Story);
  return Story;
});
