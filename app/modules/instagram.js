define([
  // Global application context.
  "app",

  // Third-party libraries.
  "backbone"
],

function(app, Backbone) {
  var Instagram = app.module();

  Instagram.Model = Backbone.Model.extend({});
  Instagram.Collection = Backbone.Model.extend({});

  return Instagram;
});
