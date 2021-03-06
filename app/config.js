// Set the require.js configuration for your application.
require.config({
  // Initialize the application with the main application file
  deps: ["main"],

  paths: {
    // JavaScript folders
    libs: "../assets/js/libs",
    plugins: "../assets/js/plugins",

    // Libraries
    //jquery: "../assets/js/libs/jquery",
    zepto: "../assets/js/libs/zepto",
    hammer: "../assets/js/libs/hammer",
    lodash: "../assets/js/libs/lodash",
    backbone: "../assets/js/libs/backbone"
    //masseuse: "../assets/js/libs/masseuse"
  },

  shim: {
    backbone: {
      deps: ["lodash", "zepto"],
      exports: "Backbone"
    }
  }
});
