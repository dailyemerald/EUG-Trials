define([
  // Global application context.
  "app",

  // Third-party libraries.
  "backbone"
],

function(app, Backbone) {
  var About = app.module();

  //About.Model = Backbone.Model.extend({});
  //About.Collection = Backbone.Model.extend({});

  About.Views.Master = Backbone.View.extend({
    
    template: "app/templates/about",
    tagName: "section",
    className: "page",
    
    render: function() {
      var tmpl = app.fetchTemplate(this.template);
      this.$el.html( tmpl() );
      return this;
    }
  });

  return About;
});
