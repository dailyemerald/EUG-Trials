this['JST'] = this['JST'] || {};

this['JST']['app/templates/story-detail.html'] = function(data) { return function (obj,_) {
var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<div class="story-detail">\n\t<h2 class="story-detail-title">', story.title ,'</h2>\n\n\t'); if (typeof story.thumbnail === "string") { ;__p.push('\n\t\t<img class="story-detail-img" src="', story.thumbnail ,'">\n\t'); } ;__p.push('\n\n\t<div class="story-detail-metabox">\n\t\t<p style="story-detail-byline">By ', story.author ,'</p>\n\t\t<p>', story.date ,'</p>\n\t</div>\n\n\t<p>', story.content ,'</p>\n</div><!-- .story-detail -->');}return __p.join('');
}(data, _)};

this['JST']['app/templates/header.html'] = function(data) { return function (obj,_) {
var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<!--<a href="#" id="back-button">BACK</a>-->\n\n<div id="flag">EUG Trials</div>\n');}return __p.join('');
}(data, _)};

this['JST']['app/templates/footer.html'] = function(data) { return function (obj,_) {
var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<div class="nav-wrapper">\n\t<div class="nav-button">\n\t\t<a href="/">News</a>\n\t</div>\n\t<div class="nav-button">\n\t\t<a href="/schedule">Schedule</a>\n\t</div>\n\t<div class="nav-button">\n\t\t<a href="/photos">Fan Pics</a>\n\t</div>\n</div>');}return __p.join('');
}(data, _)};

this['JST']['app/templates/instagram.html'] = function(data) { return function (obj,_) {
var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<p>This is a feed of Instagram photos near the UO. Geotag yours!</p>\n<iframe src="http://dev.dailyemerald.com:8100/embed.html" width="100%" height="100%" frameborder="0" style="border:0;margin-left:5px;"></iframe>');}return __p.join('');
}(data, _)};

this['JST']['app/templates/loading.html'] = function(data) { return function (obj,_) {
var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<div id="loading">\n<h1>Loading...</h1>\n</div>');}return __p.join('');
}(data, _)};

this['JST']['app/templates/schedule.html'] = function(data) { return function (obj,_) {
var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('The schedule goes here.');}return __p.join('');
}(data, _)};

this['JST']['app/templates/story-list.html'] = function(data) { return function (obj,_) {
var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<div id="story-list-wrapper">\n<ul id="story-list-ul">\n'); _.each(stories, function(story) { ;__p.push(' \n\t<li>\n\t\t<div class="story-list-liner">\n\t\t\n\t\t<a href="/story/', story.id ,'">\n\t\t\t\n\t\t\t'); if (typeof story.thumbnail === "string") { ;__p.push('\n\t\t\t\t<img class="story-list-item-img" src="', story.thumbnail ,'"></img>\n\t\t\t'); } else { ;__p.push('\n\t\t\t    <img class="story-list-item-img" src="http://dev.dailyemerald.com/emerald114.png"></img>\n\t\t\t'); } ;__p.push('\t\n\n\t\t\t<h3 class="story-list-item-title">', story.title ,'</h3>\n\t\t</a>\n\t\t\n\t\t</div><!-- story-list-liner -->\n\t</li> \n'); }); ;__p.push('\n</ul>\n</div>');}return __p.join('');
}(data, _)};