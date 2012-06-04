define([
  // Global application context.
  "app",

  // Third-party libraries.
  "backbone"
],

function(app, Backbone) {
  var Story = app.module();

  Story.Model = Backbone.Model.extend({});
  Story.Collection = Backbone.Model.extend({});

  return Story;
});
