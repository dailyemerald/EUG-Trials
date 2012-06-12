var phantom = require('phantom');

var prefix = "http://localhost:8888/";
var urls = ['', 'schedule', '404', 'photos'];

phantom.create(function(ph) {

    urls.forEach(function(url) {
        var url = prefix + url;
        ph.createPage(function(page) {
          
            page.open(url, function(status) {

                setTimeout(function() {
                  
                    var filename = url.split('/').pop() + ".png";
                    if (filename === ".png") filename = "index.png";
                    
                    page.render(filename);

                },
                2000);
            });
        });

    });

  setTimeout(function() {
    ph.exit();
  }, 5000);

});