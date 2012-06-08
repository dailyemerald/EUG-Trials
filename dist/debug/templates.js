this['JST'] = this['JST'] || {};

this['JST']['app/templates/story-detail.html'] = function(data) { return function (obj,_) {
var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<div class="story-detail">\n<h2>', story.title ,'</h2>\n<img class="story-detail-img" src="', story.thumbnail ,'">\n<p style="story-detail-byline">By ', story.author ,'</p>\n<p>', story.date ,'</p>\n<div class="story-detail-break"></div>\n<p>', story.content ,'</p>\n</div><!-- .story-detail -->');}return __p.join('');
}(data, _)};

this['JST']['app/templates/header.html'] = function(data) { return function (obj,_) {
var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<!--<a href="#" id="back-button">BACK</a>-->\n<div id="flag">EUG Trials</div>\n');}return __p.join('');
}(data, _)};

this['JST']['app/templates/footer.html'] = function(data) { return function (obj,_) {
var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<div class="nav-wrapper">\n\t<div class="nav-button">\n\t\t<a href="/">News</a>\n\t</div>\n\t<div class="nav-button">\n\t\t<a href="/schedule">Schedule</a>\n\t</div>\n\t<div class="nav-button">\n\t\t<a href="/photos">Fan Pics</a>\n\t</div>\n</div>');}return __p.join('');
}(data, _)};

this['JST']['app/templates/instagram.html'] = function(data) { return function (obj,_) {
var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<p>This is a feed of Instagram photos near the UO. Geotag yours!</p>\n<iframe src="http://dev.dailyemerald.com:8100/embed.html" width="100%" height="100%" frameborder="0"></iframe>');}return __p.join('');
}(data, _)};

this['JST']['app/templates/loading.html'] = function(data) { return function (obj,_) {
var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<div id="loading">\n<h1>Loading...</h1>\n</div>');}return __p.join('');
}(data, _)};

this['JST']['app/templates/schedule.html'] = function(data) { return function (obj,_) {
var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('The schedule goes here.');}return __p.join('');
}(data, _)};

this['JST']['app/templates/story-list.html'] = function(data) { return function (obj,_) {
var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<ul>\n'); _.each(stories, function(story) { ;__p.push(' \n\t<li>\n\t\t<a href="/story/', story.id ,'">\n\t\t\t<h3>', story.title ,'</h3>\n\t\t</a>\n\t</li> \n'); }); ;__p.push('\n</ul>');}return __p.join('');
}(data, _)};