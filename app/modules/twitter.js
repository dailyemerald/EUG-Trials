define([
  // Global application context.
  "app",

  // Third-party libraries.
  "backbone"
],

function(app, Backbone) {
  var Twitter = app.module();

  Twitter.Model = Backbone.Model.extend({});
  Twitter.Collection = Backbone.Model.extend({});

  Twitter.View = Backbone.View.extend({
    render: function() {
      //
    }
  });

  return Twitter;
});
