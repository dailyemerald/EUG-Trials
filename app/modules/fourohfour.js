define([
  // Global application context.
  "app",

  // Third-party libraries.
  "backbone"
],

function(app, Backbone) {
  var Fourohfour = app.module();

  //About.Model = Backbone.Model.extend({});
  //About.Collection = Backbone.Model.extend({});

  Fourohfour.View = Backbone.View.extend({
    
    template: "app/templates/fourohfour",
    tagName: "section",
    className: "page",
    
    render: function() {
      var tmpl = app.fetchTemplate(this.template);
      this.$el.html( tmpl() );
      return this;
    }
  });

  return Fourohfour;
});
