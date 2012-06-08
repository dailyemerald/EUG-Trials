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


  Instagram.Views.Master = Backbone.View.extend({
      template: "app/templates/instagram",

      render: function(done) {
        // Fetch the template.
        var tmpl = app.fetchTemplate(this.template);

        // Set the template contents.
        this.$el.html(tmpl());
        return this;
      }
    });

  return Instagram;
});
