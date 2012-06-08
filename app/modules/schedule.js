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

  Schedule.Views.Master = Backbone.View.extend({
      template: "app/templates/schedule",

      render: function(done) {
        // Fetch the template.
        var tmpl = app.fetchTemplate(this.template);

        // Set the template contents.
        this.$el.html(tmpl());
        return this;
      }
    });

  return Schedule;
});
