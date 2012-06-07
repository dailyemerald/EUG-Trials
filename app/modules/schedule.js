define([
  // Global application context.
  "app",

  // Third-party libraries.
  "backbone"
],

function(app, Backbone) {
  var Schedule = app.module();

  Schedule.Model = Backbone.Model.extend({});
  Schedule.Collection = Backbone.Model.extend({});

  return Schedule;
});
