/**
 * almond 0.1.1 Copyright (c) 2011, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var defined = {},
        waiting = {},
        config = {},
        defining = {},
        aps = [].slice,
        main, req;

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {},
            nameParts, nameSegment, mapValue, foundMap, i, j, part;

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);

                name = baseParts.concat(name.split("/"));

                //start trimDots
                for (i = 0; (part = name[i]); i++) {
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            return true;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                break;
                            }
                        }
                    }
                }

                foundMap = foundMap || starMap[nameSegment];

                if (foundMap) {
                    nameParts.splice(0, i, foundMap);
                    name = nameParts.join('/');
                    break;
                }
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (waiting.hasOwnProperty(name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!defined.hasOwnProperty(name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    function makeMap(name, relName) {
        var prefix, plugin,
            index = name.indexOf('!');

        if (index !== -1) {
            prefix = normalize(name.slice(0, index), relName);
            name = name.slice(index + 1);
            plugin = callDep(prefix);

            //Normalize according
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            p: plugin
        };
    }

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    main = function (name, deps, callback, relName) {
        var args = [],
            usingExports,
            cjsModule, depName, ret, map, i;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (typeof callback === 'function') {

            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i++) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = makeRequire(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = defined[name] = {};
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = {
                        id: name,
                        uri: '',
                        exports: defined[name],
                        config: makeConfig(name)
                    };
                } else if (defined.hasOwnProperty(depName) || waiting.hasOwnProperty(depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else if (!defining[depName]) {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback.apply(defined[name], args);

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                    cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync) {
        if (typeof deps === "string") {
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 15);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        config = cfg;
        return req;
    };

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        waiting[name] = [name, deps, callback];
    };

    define.amd = {
        jQuery: true
    };
}());

this['JST'] = this['JST'] || {};

this['JST']['app/templates/about.html'] = function(data) { return function (obj,_) {
var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<div class="about-liner">\n\n\t<h2>Emerald Media Group</h2>\n\n\t<p>The EUG Trials app is powered by student journalists at the Oregon Daily Emerald. The Emerald is also producing 12 special sections in print for the 2012 Olympic Trials, the only daily newspaper distributed inside the gates at Hayward Field. Pick up a copy at the UO booth or at dozens of spots around campus, including each of the Gold Medal Game locations.</p>\n\n\t<p>The Emerald, founded in 1900, is a nonprofit company that delivers news, sports and culture to more than 200,000 people in the UO community. Since 1997, we have won the Pulitzer Prize of college journalism, the Associated Collegiate Press’ Pacemaker award, twice and have been named a finalist five other times in the print or online categories.</p>\n\n\t<p>This fall, the Emerald will begin its transition from a traditional newspaper to a more modern college media company. Learn more at <a href="http://future.dailyemerald.com" target="_blank">future.dailyemerald.com</a>.</p>\n\n<p>\nEmerald Media Group<br>\n1222 E. 13th Ave. Suite 300<br>\nEugene, OR 97403<br>\n541-346-5511<br>\npublisher@dailyemerald.com<br>\n</p>\n\n</div>');}return __p.join('');
}(data, _)};

this['JST']['app/templates/story-master.html'] = function(data) { return function (obj,_) {
var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<div id="story-list-wrapper">\n\t<ul id="story-list-ul">\n\t'); _.each(stories, function(story) { ;__p.push(' \t\n\t\t<li style="background-image: url(', story.smallThumbnail ,')">\n\t\t\t<a href="/story/', story.id ,'">\n\t\t\t\t<div class="story-list-item-title">', story.title ,'</div>\n\t\t\t\t<time class="timeago" datetime="', story.timestamp ,'"></time>\n\t\t\t</a>\n\t\t</li> \n\t'); }); ;__p.push('\n\t</ul>\n</div>');}return __p.join('');
}(data, _)};

this['JST']['app/templates/story-detail.html'] = function(data) { return function (obj,_) {
var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<div class="story-detail">\n\t<h2 class="story-detail-title">', story.title ,'</h2>\n\n\n\t'); if (typeof story.thumbnail === "string") { ;__p.push('\n\t\t<img class="story-detail-img" src="', story.thumbnail ,'">\n\t'); } ;__p.push('\n\n\n\t<div class="story-detail-metabox">\n\t\t<span style="story-detail-byline">By ', story.author ,'</span><br>\n\t\t<time class="timeago" datetime="', story.timestamp ,'"></time><br>\n\t\t\n\t\t<iframe src="//www.facebook.com/plugins/like.php?href=', story.permalink ,'%2F&amp;send=false&amp;layout=standard&amp;width=300&amp;show_faces=false&amp;action=recommend&amp;colorscheme=light&amp;font=lucida+grande&amp;height=35&amp;appId=201717029854731" scrolling="no" frameborder="0" style="border:none; overflow:hidden; width:300px; height:30px; margin-top:5px;" allowTransparency="true"></iframe>\n\t</div>\n\n\t<p>', story.content ,'</p>\n</div><!-- .story-detail -->');}return __p.join('');
}(data, _)};

this['JST']['app/templates/header.html'] = function(data) { return function (obj,_) {
var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<!--<a href="#" id="back-button">BACK</a>-->\n\n<a id="backbutton"><span>Back</span></a>\n\n<div id="flag">EUG Trials</div>\n\n<a href="/about" id="aboutbutton"><span>?</span></a>');}return __p.join('');
}(data, _)};

this['JST']['app/templates/footer.html'] = function(data) { return function (obj,_) {
var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<div class="nav-wrapper">\n\t<div class="nav-button">\n\t\t<span class="nav-button-inner"><a href="/list">News</a></span>\n\t</div>\n\t<div class="nav-button">\n\t\t<span class="nav-button-inner"><a href="/schedule">Schedule</a></span>\n\t</div>\n\t<div class="nav-button">\n\t\t<span class="nav-button-inner"><a href="/photos">Fan Photos</a></span>\n\t</div>\n</div>');}return __p.join('');
}(data, _)};

this['JST']['app/templates/instagram.html'] = function(data) { return function (obj,_) {
var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<div style="padding:5px">\n<h2>Fan photos</h2>\n<p>Check out fan photos taken within a few miles of Hayward Field. It’s easy to contribute. Just snap a picture using Instagram. Make sure it’s geotagged to your location. Then upload. Your picture will instantly appear below. Try it.</p>\n</div>\n\n<iframe src="http://dev.dailyemerald.com:8100/embed.html" width="100%" height="100%" frameborder="0" style="border:0;margin-left:5px;"></iframe>');}return __p.join('');
}(data, _)};

this['JST']['app/templates/loading.html'] = function(data) { return function (obj,_) {
var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<div id="loading">\n<h1>Loading...</h1>\n</div>');}return __p.join('');
}(data, _)};

this['JST']['app/templates/schedule.html'] = function(data) { return function (obj,_) {
var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<div id="schedulewrapper">\n\n\t<ul>\n\t<li class="dateheader alternate">\n\t  Thursday, June 21\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">10:45 a.m.</div> \n\t  <div class="event">Hammer Throw</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Trials</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">1 p.m.</div> \n\t  <div class="event">Hammer Throw</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">3 p.m.</div> \n\t  <div class="event">Hammer Throw</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Trials</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">5 p.m.</div> \n\t  <div class="event">Hammer Throw</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="dateheader">\n\t  Friday, June 22\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">1 p.m.</div> \n\t  <div class="event">100m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Decathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">1:50 p.m.</div> \n\t  <div class="event">Long Jump</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Decathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">2:20 p.m.</div> \n\t  <div class="event">Discus Throw</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">3:05 p.m.</div> \n\t  <div class="event">Shot Put</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Decathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">3:10 p.m.</div> \n\t  <div class="event">400m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">1st Round</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">3:35 p.m.</div> \n\t  <div class="event">400m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">1st Round</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">4 p.m.</div> \n\t  <div class="event"></div>\n\t  <div>\n\t  <div class="gender"></div>\n\t  <div class="round"></div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">4:30 p.m.</div> \n\t  <div class="event">High Jump</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Decathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">5 p.m.</div> \n\t  <div class="event">800m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">1st Round</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">5:20 p.m.</div> \n\t  <div class="event">800m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">1st Round</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">5:30 p.m.</div> \n\t  <div class="event">Pole Vault</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">5:40 p.m.</div> \n\t  <div class="event">100m Hurdles</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">1st Round</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">5:45 p.m.</div> \n\t  <div class="event">Long Jump</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">6 p.m.</div> \n\t  <div class="event">100m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">6:30 p.m.</div> \n\t  <div class="event">400m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Decathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">6:45 p.m.</div> \n\t  <div class="event">10,000m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">7:20 p.m.</div> \n\t  <div class="event">10,000m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="dateheader">\n\t  Saturday, June 23\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">9:30 a.m.</div> \n\t  <div class="event">110m Hurdles</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Decathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">10:20 a.m.</div> \n\t  <div class="event">Discus Throw</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Decathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">12:30 p.m.</div> \n\t  <div class="event">Pole Vault</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Decathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">12:30 p.m.</div> \n\t  <div class="event">Javelin Throw</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">3 p.m.</div> \n\t  <div class="event">Shot Put</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">3 p.m.</div> \n\t  <div class="event">Javelin Throw</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Decathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">3:10 p.m.</div> \n\t  <div class="event"></div>\n\t  <div>\n\t  <div class="gender"></div>\n\t  <div class="round"></div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">3:15 p.m.</div> \n\t  <div class="event">100m Hurdles</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Semi-Finals</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">3:20 p.m.</div> \n\t  <div class="event">Triple Jump</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">3:40 p.m.</div> \n\t  <div class="event">100m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Semi-Finals</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">4 p.m.</div> \n\t  <div class="event">100m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">4:20 p.m.</div> \n\t  <div class="event">High Jump</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">4:30 p.m.</div> \n\t  <div class="event">800m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Semi-Finals</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">4:45 p.m.</div> \n\t  <div class="event">800m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Semi-Finals</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">5 p.m.</div> \n\t  <div class="event">400m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Semi-Finals</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">5:15 p.m.</div> \n\t  <div class="event">400m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Semi-Finals</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">5:30 p.m.</div> \n\t  <div class="event">1,500m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Decathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">5:45 p.m.</div> \n\t  <div class="event">100m Hurdles</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">5:52 p.m.</div> \n\t  <div class="event">100m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="dateheader">\n\t  Sunday, June 24\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">2:25 p.m.</div> \n\t  <div class="event">Pole Vault</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">2:30 p.m.</div> \n\t  <div class="event">100m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Semi-Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">2:55 p.m.</div> \n\t  <div class="event"></div>\n\t  <div>\n\t  <div class="gender"></div>\n\t  <div class="round"></div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">3 p.m.</div> \n\t  <div class="event">Long Jump</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">3:05 p.m.</div> \n\t  <div class="event">Discus Throw</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">3:30 p.m.</div> \n\t  <div class="event">Shot Put</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">4:20 p.m.</div> \n\t  <div class="event">400m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">4:35 p.m.</div> \n\t  <div class="event">400m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">4:48 p.m.</div> \n\t  <div class="event">100m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="dateheader">\n\t  Monday, June 25\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">3:30 p.m.</div> \n\t  <div class="event">Discus Throw</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">4:50 p.m.</div> \n\t  <div class="event">3,000m Steeplechase</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">5:20 p.m.</div> \n\t  <div class="event"></div>\n\t  <div>\n\t  <div class="gender"></div>\n\t  <div class="round"></div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">5:25 p.m.</div> \n\t  <div class="event">3,000m Steeplechase</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">5:30 p.m.</div> \n\t  <div class="event">Pole Vault</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">5:45 p.m.</div> \n\t  <div class="event">Triple Jump</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">5:50 p.m.</div> \n\t  <div class="event">High Jump</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">6 p.m.</div> \n\t  <div class="event">Javelin Throw</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">6:05 p.m.</div> \n\t  <div class="event">5,000m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">6:50 p.m.</div> \n\t  <div class="event">800m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">7 p.m.</div> \n\t  <div class="event">5,000m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">7:47 p.m.</div> \n\t  <div class="event">800m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="dateheader alternate">\n\t  Tuesday, June 26\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time"></div> \n\t  <div class="event"></div>\n\t  <div>\n\t  <div class="gender"></div>\n\t  <div class="round"></div>\n\t  </div>\n\t</li>\n\n\t<li class="dateheader alternate">\n\t  Wednesday, June 27\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time"></div> \n\t  <div class="event"></div>\n\t  <div>\n\t  <div class="gender"></div>\n\t  <div class="round"></div>\n\t  </div>\n\t</li>\n\n\t<li class="dateheader alternate">\n\t  Thursday, June 28\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">3:45 p.m.</div> \n\t  <div class="event"></div>\n\t  <div>\n\t  <div class="gender"></div>\n\t  <div class="round"></div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">4 p.m.</div> \n\t  <div class="event"></div>\n\t  <div>\n\t  <div class="gender"></div>\n\t  <div class="round"></div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">4:15 p.m.</div> \n\t  <div class="event"></div>\n\t  <div>\n\t  <div class="gender"></div>\n\t  <div class="round"></div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">4:20 p.m.</div> \n\t  <div class="event">1,500m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">4:30 p.m.</div> \n\t  <div class="event">Triple Jump</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">4:50 p.m.</div> \n\t  <div class="event">1,500m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">5 p.m.</div> \n\t  <div class="event">High Jump</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">5:05 p.m.</div> \n\t  <div class="event">Pole Vault</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">5:30 p.m.</div> \n\t  <div class="event">400m Hurdles</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">5:40 p.m.</div> \n\t  <div class="event">Shot Put</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">6 p.m.</div> \n\t  <div class="event">400m Hurdles</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">6:05 p.m.</div> \n\t  <div class="event">Discus Throw</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">6:30 p.m.</div> \n\t  <div class="event">3,000m Steeplechase</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">6:45 p.m.</div> \n\t  <div class="event">200m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">7:15 p.m.</div> \n\t  <div class="event">5,000m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">7:38 p.m.</div> \n\t  <div class="event">5,000m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="dateheader">\n\t  Friday, June 29\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">10:30 a.m.</div> \n\t  <div class="event">100m Hurdles</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Heptathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">11:30 a.m.</div> \n\t  <div class="event">High Jump</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Heptathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">1:15 p.m.</div> \n\t  <div class="event">Shot Put</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Heptathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">1:45 p.m.</div> \n\t  <div class="event">200m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">2:15 p.m.</div> \n\t  <div class="event">200m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Heptathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">2:30 p.m.</div> \n\t  <div class="event">Javelin Throw</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">2:35 p.m.</div> \n\t  <div class="event">Mile</div>\n\t  <div>\n\t  <div class="gender">Nike HS Girls</div>\n\t  <div class="round">Exhibition Event</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">2:45 p.m.</div> \n\t  <div class="event">Mile</div>\n\t  <div>\n\t  <div class="gender">Nike HS Boys</div>\n\t  <div class="round">Exhibition Event</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">2:55 p.m.</div> \n\t  <div class="event"></div>\n\t  <div>\n\t  <div class="gender"></div>\n\t  <div class="round"></div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">3 p.m.</div> \n\t  <div class="event">200m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Semi-Finals</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">3:20 p.m.</div> \n\t  <div class="event">400m Hurdles</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Semi-Finals</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">3:30 p.m.</div> \n\t  <div class="event">Shot Put</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">3:30 p.m.</div> \n\t  <div class="event">Long Jump</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">3:35 p.m.</div> \n\t  <div class="event">400m Hurdles</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Semi-Finals</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">3:45 p.m.</div> \n\t  <div class="event">1,500m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Semi-Finals</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">4:05 p.m.</div> \n\t  <div class="event">110m Hurdles</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">4:25 p.m.</div> \n\t  <div class="event">1,500m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Semi-Finals</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">4:45 p.m.</div> \n\t  <div class="event">3,000m Steeplechase</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="dateheader alternate">\n\t  Saturday, June 30\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">7:30 a.m.</div> \n\t  <div class="event">20km Race Walk</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">3 p.m.</div> \n\t  <div class="event">Long Jump</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Heptathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">3:35 p.m.</div> \n\t  <div class="event">100m</div>\n\t  <div>\n\t  <div class="gender">Boys &amp; Girls</div>\n\t  <div class="round">Special Olympics</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">4:10 p.m.</div> \n\t  <div class="event"></div>\n\t  <div>\n\t  <div class="gender"></div>\n\t  <div class="round"></div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">4:15 p.m.</div> \n\t  <div class="event">Javelin Throw</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Heptathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">4:20 p.m.</div> \n\t  <div class="event">110m Hurdles</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Semi-Finals</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">4:40 p.m.</div> \n\t  <div class="event">Triple Jump</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">5 p.m.</div> \n\t  <div class="event">High Jump</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">5:20 p.m.</div> \n\t  <div class="event">200m</div>\n\t  <div>\n\t  <div class="gender">Boys &amp; Girls</div>\n\t  <div class="round">USATF Youth</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">5:40 p.m.</div> \n\t  <div class="event">400m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Masters</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">5:50 p.m.</div> \n\t  <div class="event">200m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Masters</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">6 p.m.</div> \n\t  <div class="event">200m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Semi-Finals</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">6:20 p.m.</div> \n\t  <div class="event">800m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Heptathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">6:40 p.m.</div> \n\t  <div class="event">110m Hurdles</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">6:50 p.m.</div> \n\t  <div class="event">200m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="dateheader alternate">\n\t  Sunday, July 1\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">7:30 p.m.</div> \n\t  <div class="event">20km Race Walk</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">2:40 p.m.</div> \n\t  <div class="event"></div>\n\t  <div>\n\t  <div class="gender"></div>\n\t  <div class="round"></div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">2:45 p.m.</div> \n\t  <div class="event">Javelin Throw</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">3 p.m.</div> \n\t  <div class="event">Long Jump</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">4:02 p.m.</div> \n\t  <div class="event">400m Hurdles</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">4:12 p.m.</div> \n\t  <div class="event">400m Hurdles</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">4:23 p.m.</div> \n\t  <div class="event">1,500m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">4:37 p.m.</div> \n\t  <div class="event">1,500m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">4:50 p.m.</div> \n\t  <div class="event">200m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">4:55 p.m.</div> \n\t  <div class="event"></div>\n\t  <div>\n\t  <div class="gender"></div>\n\t  <div class="round"></div>\n\t  </div>\n\t</li>\n\t</ul>\n\n</div>');}return __p.join('');
}(data, _)};

/* Zepto v1.0rc1 - polyfill zepto event detect fx ajax form touch - zeptojs.com/license */
;(function(undefined){
  if (String.prototype.trim === undefined) // fix for iOS 3.2
    String.prototype.trim = function(){ return this.replace(/^\s+/, '').replace(/\s+$/, '') }

  // For iOS 3.x
  // from https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/reduce
  if (Array.prototype.reduce === undefined)
    Array.prototype.reduce = function(fun){
      if(this === void 0 || this === null) throw new TypeError()
      var t = Object(this), len = t.length >>> 0, k = 0, accumulator
      if(typeof fun != 'function') throw new TypeError()
      if(len == 0 && arguments.length == 1) throw new TypeError()

      if(arguments.length >= 2)
       accumulator = arguments[1]
      else
        do{
          if(k in t){
            accumulator = t[k++]
            break
          }
          if(++k >= len) throw new TypeError()
        } while (true)

      while (k < len){
        if(k in t) accumulator = fun.call(undefined, accumulator, t[k], k, t)
        k++
      }
      return accumulator
    }

})()
var Zepto = (function() {
  var undefined, key, $, classList, emptyArray = [], slice = emptyArray.slice,
    document = window.document,
    elementDisplay = {}, classCache = {},
    getComputedStyle = document.defaultView.getComputedStyle,
    cssNumber = { 'column-count': 1, 'columns': 1, 'font-weight': 1, 'line-height': 1,'opacity': 1, 'z-index': 1, 'zoom': 1 },
    fragmentRE = /^\s*<(\w+|!)[^>]*>/,

    // Used by `$.zepto.init` to wrap elements, text/comment nodes, document,
    // and document fragment node types.
    elementTypes = [1, 3, 8, 9, 11],

    adjacencyOperators = [ 'after', 'prepend', 'before', 'append' ],
    table = document.createElement('table'),
    tableRow = document.createElement('tr'),
    containers = {
      'tr': document.createElement('tbody'),
      'tbody': table, 'thead': table, 'tfoot': table,
      'td': tableRow, 'th': tableRow,
      '*': document.createElement('div')
    },
    readyRE = /complete|loaded|interactive/,
    classSelectorRE = /^\.([\w-]+)$/,
    idSelectorRE = /^#([\w-]+)$/,
    tagSelectorRE = /^[\w-]+$/,
    toString = ({}).toString,
    zepto = {},
    camelize, uniq,
    tempParent = document.createElement('div')

  zepto.matches = function(element, selector) {
    if (!element || element.nodeType !== 1) return false
    var matchesSelector = element.webkitMatchesSelector || element.mozMatchesSelector ||
                          element.oMatchesSelector || element.matchesSelector
    if (matchesSelector) return matchesSelector.call(element, selector)
    // fall back to performing a selector:
    var match, parent = element.parentNode, temp = !parent
    if (temp) (parent = tempParent).appendChild(element)
    match = ~zepto.qsa(parent, selector).indexOf(element)
    temp && tempParent.removeChild(element)
    return match
  }

  function isFunction(value) { return toString.call(value) == "[object Function]" }
  function isObject(value) { return value instanceof Object }
  function isPlainObject(value) {
    var key, ctor
    if (toString.call(value) !== "[object Object]") return false
    ctor = (isFunction(value.constructor) && value.constructor.prototype)
    if (!ctor || !hasOwnProperty.call(ctor, 'isPrototypeOf')) return false
    for (key in value);
    return key === undefined || hasOwnProperty.call(value, key)
  }
  function isArray(value) { return value instanceof Array }
  function likeArray(obj) { return typeof obj.length == 'number' }

  function compact(array) { return array.filter(function(item){ return item !== undefined && item !== null }) }
  function flatten(array) { return array.length > 0 ? [].concat.apply([], array) : array }
  camelize = function(str){ return str.replace(/-+(.)?/g, function(match, chr){ return chr ? chr.toUpperCase() : '' }) }
  function dasherize(str) {
    return str.replace(/::/g, '/')
           .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
           .replace(/([a-z\d])([A-Z])/g, '$1_$2')
           .replace(/_/g, '-')
           .toLowerCase()
  }
  uniq = function(array){ return array.filter(function(item, idx){ return array.indexOf(item) == idx }) }

  function classRE(name) {
    return name in classCache ?
      classCache[name] : (classCache[name] = new RegExp('(^|\\s)' + name + '(\\s|$)'))
  }

  function maybeAddPx(name, value) {
    return (typeof value == "number" && !cssNumber[dasherize(name)]) ? value + "px" : value
  }

  function defaultDisplay(nodeName) {
    var element, display
    if (!elementDisplay[nodeName]) {
      element = document.createElement(nodeName)
      document.body.appendChild(element)
      display = getComputedStyle(element, '').getPropertyValue("display")
      element.parentNode.removeChild(element)
      display == "none" && (display = "block")
      elementDisplay[nodeName] = display
    }
    return elementDisplay[nodeName]
  }

  // `$.zepto.fragment` takes a html string and an optional tag name
  // to generate DOM nodes nodes from the given html string.
  // The generated DOM nodes are returned as an array.
  // This function can be overriden in plugins for example to make
  // it compatible with browsers that don't support the DOM fully.
  zepto.fragment = function(html, name) {
    if (name === undefined) name = fragmentRE.test(html) && RegExp.$1
    if (!(name in containers)) name = '*'
    var container = containers[name]
    container.innerHTML = '' + html
    return $.each(slice.call(container.childNodes), function(){
      container.removeChild(this)
    })
  }

  // `$.zepto.Z` swaps out the prototype of the given `dom` array
  // of nodes with `$.fn` and thus supplying all the Zepto functions
  // to the array. Note that `__proto__` is not supported on Internet
  // Explorer. This method can be overriden in plugins.
  zepto.Z = function(dom, selector) {
    dom = dom || []
    dom.__proto__ = arguments.callee.prototype
    dom.selector = selector || ''
    return dom
  }

  // `$.zepto.isZ` should return `true` if the given object is a Zepto
  // collection. This method can be overriden in plugins.
  zepto.isZ = function(object) {
    return object instanceof zepto.Z
  }

  // `$.zepto.init` is Zepto's counterpart to jQuery's `$.fn.init` and
  // takes a CSS selector and an optional context (and handles various
  // special cases).
  // This method can be overriden in plugins.
  zepto.init = function(selector, context) {
    // If nothing given, return an empty Zepto collection
    if (!selector) return zepto.Z()
    // If a function is given, call it when the DOM is ready
    else if (isFunction(selector)) return $(document).ready(selector)
    // If a Zepto collection is given, juts return it
    else if (zepto.isZ(selector)) return selector
    else {
      var dom
      // normalize array if an array of nodes is given
      if (isArray(selector)) dom = compact(selector)
      // if a JavaScript object is given, return a copy of it
      // this is a somewhat peculiar option, but supported by
      // jQuery so we'll do it, too
      else if (isPlainObject(selector))
        dom = [$.extend({}, selector)], selector = null
      // wrap stuff like `document` or `window`
      else if (elementTypes.indexOf(selector.nodeType) >= 0 || selector === window)
        dom = [selector], selector = null
      // If it's a html fragment, create nodes from it
      else if (fragmentRE.test(selector))
        dom = zepto.fragment(selector.trim(), RegExp.$1), selector = null
      // If there's a context, create a collection on that context first, and select
      // nodes from there
      else if (context !== undefined) return $(context).find(selector)
      // And last but no least, if it's a CSS selector, use it to select nodes.
      else dom = zepto.qsa(document, selector)
      // create a new Zepto collection from the nodes found
      return zepto.Z(dom, selector)
    }
  }

  // `$` will be the base `Zepto` object. When calling this
  // function just call `$.zepto.init, whichs makes the implementation
  // details of selecting nodes and creating Zepto collections
  // patchable in plugins.
  $ = function(selector, context){
    return zepto.init(selector, context)
  }

  // Copy all but undefined properties from one or more
  // objects to the `target` object.
  $.extend = function(target){
    slice.call(arguments, 1).forEach(function(source) {
      for (key in source)
        if (source[key] !== undefined)
          target[key] = source[key]
    })
    return target
  }

  // `$.zepto.qsa` is Zepto's CSS selector implementation which
  // uses `document.querySelectorAll` and optimizes for some special cases, like `#id`.
  // This method can be overriden in plugins.
  zepto.qsa = function(element, selector){
    var found
    return (element === document && idSelectorRE.test(selector)) ?
      ( (found = element.getElementById(RegExp.$1)) ? [found] : emptyArray ) :
      (element.nodeType !== 1 && element.nodeType !== 9) ? emptyArray :
      slice.call(
        classSelectorRE.test(selector) ? element.getElementsByClassName(RegExp.$1) :
        tagSelectorRE.test(selector) ? element.getElementsByTagName(selector) :
        element.querySelectorAll(selector)
      )
  }

  function filtered(nodes, selector) {
    return selector === undefined ? $(nodes) : $(nodes).filter(selector)
  }

  function funcArg(context, arg, idx, payload) {
   return isFunction(arg) ? arg.call(context, idx, payload) : arg
  }

  $.isFunction = isFunction
  $.isObject = isObject
  $.isArray = isArray
  $.isPlainObject = isPlainObject

  $.inArray = function(elem, array, i){
    return emptyArray.indexOf.call(array, elem, i)
  }

  $.trim = function(str) { return str.trim() }

  // plugin compatibility
  $.uuid = 0

  $.map = function(elements, callback){
    var value, values = [], i, key
    if (likeArray(elements))
      for (i = 0; i < elements.length; i++) {
        value = callback(elements[i], i)
        if (value != null) values.push(value)
      }
    else
      for (key in elements) {
        value = callback(elements[key], key)
        if (value != null) values.push(value)
      }
    return flatten(values)
  }

  $.each = function(elements, callback){
    var i, key
    if (likeArray(elements)) {
      for (i = 0; i < elements.length; i++)
        if (callback.call(elements[i], i, elements[i]) === false) return elements
    } else {
      for (key in elements)
        if (callback.call(elements[key], key, elements[key]) === false) return elements
    }

    return elements
  }

  // Define methods that will be available on all
  // Zepto collections
  $.fn = {
    // Because a collection acts like an array
    // copy over these useful array functions.
    forEach: emptyArray.forEach,
    reduce: emptyArray.reduce,
    push: emptyArray.push,
    indexOf: emptyArray.indexOf,
    concat: emptyArray.concat,

    // `map` and `slice` in the jQuery API work differently
    // from their array counterparts
    map: function(fn){
      return $.map(this, function(el, i){ return fn.call(el, i, el) })
    },
    slice: function(){
      return $(slice.apply(this, arguments))
    },

    ready: function(callback){
      if (readyRE.test(document.readyState)) callback($)
      else document.addEventListener('DOMContentLoaded', function(){ callback($) }, false)
      return this
    },
    get: function(idx){
      return idx === undefined ? slice.call(this) : this[idx]
    },
    toArray: function(){ return this.get() },
    size: function(){
      return this.length
    },
    remove: function(){
      return this.each(function(){
        if (this.parentNode != null)
          this.parentNode.removeChild(this)
      })
    },
    each: function(callback){
      this.forEach(function(el, idx){ callback.call(el, idx, el) })
      return this
    },
    filter: function(selector){
      return $([].filter.call(this, function(element){
        return zepto.matches(element, selector)
      }))
    },
    add: function(selector,context){
      return $(uniq(this.concat($(selector,context))))
    },
    is: function(selector){
      return this.length > 0 && zepto.matches(this[0], selector)
    },
    not: function(selector){
      var nodes=[]
      if (isFunction(selector) && selector.call !== undefined)
        this.each(function(idx){
          if (!selector.call(this,idx)) nodes.push(this)
        })
      else {
        var excludes = typeof selector == 'string' ? this.filter(selector) :
          (likeArray(selector) && isFunction(selector.item)) ? slice.call(selector) : $(selector)
        this.forEach(function(el){
          if (excludes.indexOf(el) < 0) nodes.push(el)
        })
      }
      return $(nodes)
    },
    eq: function(idx){
      return idx === -1 ? this.slice(idx) : this.slice(idx, + idx + 1)
    },
    first: function(){
      var el = this[0]
      return el && !isObject(el) ? el : $(el)
    },
    last: function(){
      var el = this[this.length - 1]
      return el && !isObject(el) ? el : $(el)
    },
    find: function(selector){
      var result
      if (this.length == 1) result = zepto.qsa(this[0], selector)
      else result = this.map(function(){ return zepto.qsa(this, selector) })
      return $(result)
    },
    closest: function(selector, context){
      var node = this[0]
      while (node && !zepto.matches(node, selector))
        node = node !== context && node !== document && node.parentNode
      return $(node)
    },
    parents: function(selector){
      var ancestors = [], nodes = this
      while (nodes.length > 0)
        nodes = $.map(nodes, function(node){
          if ((node = node.parentNode) && node !== document && ancestors.indexOf(node) < 0) {
            ancestors.push(node)
            return node
          }
        })
      return filtered(ancestors, selector)
    },
    parent: function(selector){
      return filtered(uniq(this.pluck('parentNode')), selector)
    },
    children: function(selector){
      return filtered(this.map(function(){ return slice.call(this.children) }), selector)
    },
    siblings: function(selector){
      return filtered(this.map(function(i, el){
        return slice.call(el.parentNode.children).filter(function(child){ return child!==el })
      }), selector)
    },
    empty: function(){
      return this.each(function(){ this.innerHTML = '' })
    },
    // `pluck` is borrowed from Prototype.js
    pluck: function(property){
      return this.map(function(){ return this[property] })
    },
    show: function(){
      return this.each(function(){
        this.style.display == "none" && (this.style.display = null)
        if (getComputedStyle(this, '').getPropertyValue("display") == "none")
          this.style.display = defaultDisplay(this.nodeName)
      })
    },
    replaceWith: function(newContent){
      return this.before(newContent).remove()
    },
    wrap: function(newContent){
      return this.each(function(){
        $(this).wrapAll($(newContent)[0].cloneNode(false))
      })
    },
    wrapAll: function(newContent){
      if (this[0]) {
        $(this[0]).before(newContent = $(newContent))
        newContent.append(this)
      }
      return this
    },
    unwrap: function(){
      this.parent().each(function(){
        $(this).replaceWith($(this).children())
      })
      return this
    },
    clone: function(){
      return $(this.map(function(){ return this.cloneNode(true) }))
    },
    hide: function(){
      return this.css("display", "none")
    },
    toggle: function(setting){
      return (setting === undefined ? this.css("display") == "none" : setting) ? this.show() : this.hide()
    },
    prev: function(){ return $(this.pluck('previousElementSibling')) },
    next: function(){ return $(this.pluck('nextElementSibling')) },
    html: function(html){
      return html === undefined ?
        (this.length > 0 ? this[0].innerHTML : null) :
        this.each(function(idx){
          var originHtml = this.innerHTML
          $(this).empty().append( funcArg(this, html, idx, originHtml) )
        })
    },
    text: function(text){
      return text === undefined ?
        (this.length > 0 ? this[0].textContent : null) :
        this.each(function(){ this.textContent = text })
    },
    attr: function(name, value){
      var result
      return (typeof name == 'string' && value === undefined) ?
        (this.length == 0 || this[0].nodeType !== 1 ? undefined :
          (name == 'value' && this[0].nodeName == 'INPUT') ? this.val() :
          (!(result = this[0].getAttribute(name)) && name in this[0]) ? this[0][name] : result
        ) :
        this.each(function(idx){
          if (this.nodeType !== 1) return
          if (isObject(name)) for (key in name) this.setAttribute(key, name[key])
          else this.setAttribute(name, funcArg(this, value, idx, this.getAttribute(name)))
        })
    },
    removeAttr: function(name){
      return this.each(function(){ if (this.nodeType === 1) this.removeAttribute(name) })
    },
    prop: function(name, value){
      return (value === undefined) ?
        (this[0] ? this[0][name] : undefined) :
        this.each(function(idx){
          this[name] = funcArg(this, value, idx, this[name])
        })
    },
    data: function(name, value){
      var data = this.attr('data-' + dasherize(name), value)
      return data !== null ? data : undefined
    },
    val: function(value){
      return (value === undefined) ?
        (this.length > 0 ? this[0].value : undefined) :
        this.each(function(idx){
          this.value = funcArg(this, value, idx, this.value)
        })
    },
    offset: function(){
      if (this.length==0) return null
      var obj = this[0].getBoundingClientRect()
      return {
        left: obj.left + window.pageXOffset,
        top: obj.top + window.pageYOffset,
        width: obj.width,
        height: obj.height
      }
    },
    css: function(property, value){
      if (value === undefined && typeof property == 'string')
        return (
          this.length == 0
            ? undefined
            : this[0].style[camelize(property)] || getComputedStyle(this[0], '').getPropertyValue(property))

      var css = ''
      for (key in property)
        if(typeof property[key] == 'string' && property[key] == '')
          this.each(function(){ this.style.removeProperty(dasherize(key)) })
        else
          css += dasherize(key) + ':' + maybeAddPx(key, property[key]) + ';'

      if (typeof property == 'string')
        if (value == '')
          this.each(function(){ this.style.removeProperty(dasherize(property)) })
        else
          css = dasherize(property) + ":" + maybeAddPx(property, value)

      return this.each(function(){ this.style.cssText += ';' + css })
    },
    index: function(element){
      return element ? this.indexOf($(element)[0]) : this.parent().children().indexOf(this[0])
    },
    hasClass: function(name){
      if (this.length < 1) return false
      else return classRE(name).test(this[0].className)
    },
    addClass: function(name){
      return this.each(function(idx){
        classList = []
        var cls = this.className, newName = funcArg(this, name, idx, cls)
        newName.split(/\s+/g).forEach(function(klass){
          if (!$(this).hasClass(klass)) classList.push(klass)
        }, this)
        classList.length && (this.className += (cls ? " " : "") + classList.join(" "))
      })
    },
    removeClass: function(name){
      return this.each(function(idx){
        if (name === undefined)
          return this.className = ''
        classList = this.className
        funcArg(this, name, idx, classList).split(/\s+/g).forEach(function(klass){
          classList = classList.replace(classRE(klass), " ")
        })
        this.className = classList.trim()
      })
    },
    toggleClass: function(name, when){
      return this.each(function(idx){
        var newName = funcArg(this, name, idx, this.className)
        ;(when === undefined ? !$(this).hasClass(newName) : when) ?
          $(this).addClass(newName) : $(this).removeClass(newName)
      })
    }
  }

  // Generate the `width` and `height` functions
  ;['width', 'height'].forEach(function(dimension){
    $.fn[dimension] = function(value){
      var offset, Dimension = dimension.replace(/./, function(m){ return m[0].toUpperCase() })
      if (value === undefined) return this[0] == window ? window['inner' + Dimension] :
        this[0] == document ? document.documentElement['offset' + Dimension] :
        (offset = this.offset()) && offset[dimension]
      else return this.each(function(idx){
        var el = $(this)
        el.css(dimension, funcArg(this, value, idx, el[dimension]()))
      })
    }
  })

  function insert(operator, target, node) {
    var parent = (operator % 2) ? target : target.parentNode
    parent ? parent.insertBefore(node,
      !operator ? target.nextSibling :      // after
      operator == 1 ? parent.firstChild :   // prepend
      operator == 2 ? target :              // before
      null) :                               // append
      $(node).remove()
  }

  function traverseNode(node, fun) {
    fun(node)
    for (var key in node.childNodes) traverseNode(node.childNodes[key], fun)
  }

  // Generate the `after`, `prepend`, `before`, `append`,
  // `insertAfter`, `insertBefore`, `appendTo`, and `prependTo` methods.
  adjacencyOperators.forEach(function(key, operator) {
    $.fn[key] = function(){
      // arguments can be nodes, arrays of nodes, Zepto objects and HTML strings
      var nodes = $.map(arguments, function(n){ return isObject(n) ? n : zepto.fragment(n) })
      if (nodes.length < 1) return this
      var size = this.length, copyByClone = size > 1, inReverse = operator < 2

      return this.each(function(index, target){
        for (var i = 0; i < nodes.length; i++) {
          var node = nodes[inReverse ? nodes.length-i-1 : i]
          traverseNode(node, function(node){
            if (node.nodeName != null && node.nodeName.toUpperCase() === 'SCRIPT' && (!node.type || node.type === 'text/javascript'))
              window['eval'].call(window, node.innerHTML)
          })
          if (copyByClone && index < size - 1) node = node.cloneNode(true)
          insert(operator, target, node)
        }
      })
    }

    $.fn[(operator % 2) ? key+'To' : 'insert'+(operator ? 'Before' : 'After')] = function(html){
      $(html)[key](this)
      return this
    }
  })

  zepto.Z.prototype = $.fn

  // Export internal API functions in the `$.zepto` namespace
  zepto.camelize = camelize
  zepto.uniq = uniq
  $.zepto = zepto

  return $
})()

// If `$` is not yet defined, point it to `Zepto`
window.Zepto = Zepto
'$' in window || (window.$ = Zepto)
;(function($){
  var $$ = $.zepto.qsa, handlers = {}, _zid = 1, specialEvents={}

  specialEvents.click = specialEvents.mousedown = specialEvents.mouseup = specialEvents.mousemove = 'MouseEvents'

  function zid(element) {
    return element._zid || (element._zid = _zid++)
  }
  function findHandlers(element, event, fn, selector) {
    event = parse(event)
    if (event.ns) var matcher = matcherFor(event.ns)
    return (handlers[zid(element)] || []).filter(function(handler) {
      return handler
        && (!event.e  || handler.e == event.e)
        && (!event.ns || matcher.test(handler.ns))
        && (!fn       || zid(handler.fn) === zid(fn))
        && (!selector || handler.sel == selector)
    })
  }
  function parse(event) {
    var parts = ('' + event).split('.')
    return {e: parts[0], ns: parts.slice(1).sort().join(' ')}
  }
  function matcherFor(ns) {
    return new RegExp('(?:^| )' + ns.replace(' ', ' .* ?') + '(?: |$)')
  }

  function eachEvent(events, fn, iterator){
    if ($.isObject(events)) $.each(events, iterator)
    else events.split(/\s/).forEach(function(type){ iterator(type, fn) })
  }

  function add(element, events, fn, selector, getDelegate, capture){
    capture = !!capture
    var id = zid(element), set = (handlers[id] || (handlers[id] = []))
    eachEvent(events, fn, function(event, fn){
      var delegate = getDelegate && getDelegate(fn, event),
        callback = delegate || fn
      var proxyfn = function (event) {
        var result = callback.apply(element, [event].concat(event.data))
        if (result === false) event.preventDefault()
        return result
      }
      var handler = $.extend(parse(event), {fn: fn, proxy: proxyfn, sel: selector, del: delegate, i: set.length})
      set.push(handler)
      element.addEventListener(handler.e, proxyfn, capture)
    })
  }
  function remove(element, events, fn, selector){
    var id = zid(element)
    eachEvent(events || '', fn, function(event, fn){
      findHandlers(element, event, fn, selector).forEach(function(handler){
        delete handlers[id][handler.i]
        element.removeEventListener(handler.e, handler.proxy, false)
      })
    })
  }

  $.event = { add: add, remove: remove }

  $.proxy = function(fn, context) {
    if ($.isFunction(fn)) {
      var proxyFn = function(){ return fn.apply(context, arguments) }
      proxyFn._zid = zid(fn)
      return proxyFn
    } else if (typeof context == 'string') {
      return $.proxy(fn[context], fn)
    } else {
      throw new TypeError("expected function")
    }
  }

  $.fn.bind = function(event, callback){
    return this.each(function(){
      add(this, event, callback)
    })
  }
  $.fn.unbind = function(event, callback){
    return this.each(function(){
      remove(this, event, callback)
    })
  }
  $.fn.one = function(event, callback){
    return this.each(function(i, element){
      add(this, event, callback, null, function(fn, type){
        return function(){
          var result = fn.apply(element, arguments)
          remove(element, type, fn)
          return result
        }
      })
    })
  }

  var returnTrue = function(){return true},
      returnFalse = function(){return false},
      eventMethods = {
        preventDefault: 'isDefaultPrevented',
        stopImmediatePropagation: 'isImmediatePropagationStopped',
        stopPropagation: 'isPropagationStopped'
      }
  function createProxy(event) {
    var proxy = $.extend({originalEvent: event}, event)
    $.each(eventMethods, function(name, predicate) {
      proxy[name] = function(){
        this[predicate] = returnTrue
        return event[name].apply(event, arguments)
      }
      proxy[predicate] = returnFalse
    })
    return proxy
  }

  // emulates the 'defaultPrevented' property for browsers that have none
  function fix(event) {
    if (!('defaultPrevented' in event)) {
      event.defaultPrevented = false
      var prevent = event.preventDefault
      event.preventDefault = function() {
        this.defaultPrevented = true
        prevent.call(this)
      }
    }
  }

  $.fn.delegate = function(selector, event, callback){
    var capture = false
    if(event == 'blur' || event == 'focus'){
      if($.iswebkit)
        event = event == 'blur' ? 'focusout' : event == 'focus' ? 'focusin' : event
      else
        capture = true
    }

    return this.each(function(i, element){
      add(element, event, callback, selector, function(fn){
        return function(e){
          var evt, match = $(e.target).closest(selector, element).get(0)
          if (match) {
            evt = $.extend(createProxy(e), {currentTarget: match, liveFired: element})
            return fn.apply(match, [evt].concat([].slice.call(arguments, 1)))
          }
        }
      }, capture)
    })
  }
  $.fn.undelegate = function(selector, event, callback){
    return this.each(function(){
      remove(this, event, callback, selector)
    })
  }

  $.fn.live = function(event, callback){
    $(document.body).delegate(this.selector, event, callback)
    return this
  }
  $.fn.die = function(event, callback){
    $(document.body).undelegate(this.selector, event, callback)
    return this
  }

  $.fn.on = function(event, selector, callback){
    return selector == undefined || $.isFunction(selector) ?
      this.bind(event, selector) : this.delegate(selector, event, callback)
  }
  $.fn.off = function(event, selector, callback){
    return selector == undefined || $.isFunction(selector) ?
      this.unbind(event, selector) : this.undelegate(selector, event, callback)
  }

  $.fn.trigger = function(event, data){
    if (typeof event == 'string') event = $.Event(event)
    fix(event)
    event.data = data
    return this.each(function(){
      // items in the collection might not be DOM elements
      // (todo: possibly support events on plain old objects)
      if('dispatchEvent' in this) this.dispatchEvent(event)
    })
  }

  // triggers event handlers on current element just as if an event occurred,
  // doesn't trigger an actual event, doesn't bubble
  $.fn.triggerHandler = function(event, data){
    var e, result
    this.each(function(i, element){
      e = createProxy(typeof event == 'string' ? $.Event(event) : event)
      e.data = data
      e.target = element
      $.each(findHandlers(element, event.type || event), function(i, handler){
        result = handler.proxy(e)
        if (e.isImmediatePropagationStopped()) return false
      })
    })
    return result
  }

  // shortcut methods for `.bind(event, fn)` for each event type
  ;('focusin focusout load resize scroll unload click dblclick '+
  'mousedown mouseup mousemove mouseover mouseout '+
  'change select keydown keypress keyup error').split(' ').forEach(function(event) {
    $.fn[event] = function(callback){ return this.bind(event, callback) }
  })

  ;['focus', 'blur'].forEach(function(name) {
    $.fn[name] = function(callback) {
      if (callback) this.bind(name, callback)
      else if (this.length) try { this.get(0)[name]() } catch(e){}
      return this
    }
  })

  $.Event = function(type, props) {
    var event = document.createEvent(specialEvents[type] || 'Events'), bubbles = true
    if (props) for (var name in props) (name == 'bubbles') ? (bubbles = !!props[name]) : (event[name] = props[name])
    event.initEvent(type, bubbles, true, null, null, null, null, null, null, null, null, null, null, null, null)
    return event
  }

})(Zepto)
;(function($){
  function detect(ua){
    var os = this.os = {}, browser = this.browser = {},
      webkit = ua.match(/WebKit\/([\d.]+)/),
      android = ua.match(/(Android)\s+([\d.]+)/),
      ipad = ua.match(/(iPad).*OS\s([\d_]+)/),
      iphone = !ipad && ua.match(/(iPhone\sOS)\s([\d_]+)/),
      webos = ua.match(/(webOS|hpwOS)[\s\/]([\d.]+)/),
      touchpad = webos && ua.match(/TouchPad/),
      kindle = ua.match(/Kindle\/([\d.]+)/),
      silk = ua.match(/Silk\/([\d._]+)/),
      blackberry = ua.match(/(BlackBerry).*Version\/([\d.]+)/)

    // todo clean this up with a better OS/browser
    // separation. we need to discern between multiple
    // browsers on android, and decide if kindle fire in
    // silk mode is android or not

    if (browser.webkit = !!webkit) browser.version = webkit[1]

    if (android) os.android = true, os.version = android[2]
    if (iphone) os.ios = os.iphone = true, os.version = iphone[2].replace(/_/g, '.')
    if (ipad) os.ios = os.ipad = true, os.version = ipad[2].replace(/_/g, '.')
    if (webos) os.webos = true, os.version = webos[2]
    if (touchpad) os.touchpad = true
    if (blackberry) os.blackberry = true, os.version = blackberry[2]
    if (kindle) os.kindle = true, os.version = kindle[1]
    if (silk) browser.silk = true, browser.version = silk[1]
    if (!silk && os.android && ua.match(/Kindle Fire/)) browser.silk = true
  }

  detect.call($, navigator.userAgent)
  // make available to unit tests
  $.__detect = detect

})(Zepto)
;(function($, undefined){
  var prefix = '', eventPrefix, endEventName, endAnimationName,
    vendors = { Webkit: 'webkit', Moz: '', O: 'o', ms: 'MS' },
    document = window.document, testEl = document.createElement('div'),
    supportedTransforms = /^((translate|rotate|scale)(X|Y|Z|3d)?|matrix(3d)?|perspective|skew(X|Y)?)$/i,
    clearProperties = {}

  function downcase(str) { return str.toLowerCase() }
  function normalizeEvent(name) { return eventPrefix ? eventPrefix + name : downcase(name) }

  $.each(vendors, function(vendor, event){
    if (testEl.style[vendor + 'TransitionProperty'] !== undefined) {
      prefix = '-' + downcase(vendor) + '-'
      eventPrefix = event
      return false
    }
  })

  clearProperties[prefix + 'transition-property'] =
  clearProperties[prefix + 'transition-duration'] =
  clearProperties[prefix + 'transition-timing-function'] =
  clearProperties[prefix + 'animation-name'] =
  clearProperties[prefix + 'animation-duration'] = ''

  $.fx = {
    off: (eventPrefix === undefined && testEl.style.transitionProperty === undefined),
    cssPrefix: prefix,
    transitionEnd: normalizeEvent('TransitionEnd'),
    animationEnd: normalizeEvent('AnimationEnd')
  }

  $.fn.animate = function(properties, duration, ease, callback){
    if ($.isObject(duration))
      ease = duration.easing, callback = duration.complete, duration = duration.duration
    if (duration) duration = duration / 1000
    return this.anim(properties, duration, ease, callback)
  }

  $.fn.anim = function(properties, duration, ease, callback){
    var transforms, cssProperties = {}, key, that = this, wrappedCallback, endEvent = $.fx.transitionEnd
    if (duration === undefined) duration = 0.4
    if ($.fx.off) duration = 0

    if (typeof properties == 'string') {
      // keyframe animation
      cssProperties[prefix + 'animation-name'] = properties
      cssProperties[prefix + 'animation-duration'] = duration + 's'
      endEvent = $.fx.animationEnd
    } else {
      // CSS transitions
      for (key in properties)
        if (supportedTransforms.test(key)) {
          transforms || (transforms = [])
          transforms.push(key + '(' + properties[key] + ')')
        }
        else cssProperties[key] = properties[key]

      if (transforms) cssProperties[prefix + 'transform'] = transforms.join(' ')
      if (!$.fx.off && typeof properties === 'object') {
        cssProperties[prefix + 'transition-property'] = Object.keys(properties).join(', ')
        cssProperties[prefix + 'transition-duration'] = duration + 's'
        cssProperties[prefix + 'transition-timing-function'] = (ease || 'linear')
      }
    }

    wrappedCallback = function(event){
      if (typeof event !== 'undefined') {
        if (event.target !== event.currentTarget) return // makes sure the event didn't bubble from "below"
        $(event.target).unbind(endEvent, arguments.callee)
      }
      $(this).css(clearProperties)
      callback && callback.call(this)
    }
    if (duration > 0) this.bind(endEvent, wrappedCallback)

    setTimeout(function() {
      that.css(cssProperties)
      if (duration <= 0) setTimeout(function() {
        that.each(function(){ wrappedCallback.call(this) })
      }, 0)
    }, 0)

    return this
  }

  testEl = null
})(Zepto)
;(function($){
  var jsonpID = 0,
      isObject = $.isObject,
      document = window.document,
      key,
      name,
      rscript = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      scriptTypeRE = /^(?:text|application)\/javascript/i,
      xmlTypeRE = /^(?:text|application)\/xml/i,
      jsonType = 'application/json',
      htmlType = 'text/html',
      blankRE = /^\s*$/

  // trigger a custom event and return false if it was cancelled
  function triggerAndReturn(context, eventName, data) {
    var event = $.Event(eventName)
    $(context).trigger(event, data)
    return !event.defaultPrevented
  }

  // trigger an Ajax "global" event
  function triggerGlobal(settings, context, eventName, data) {
    if (settings.global) return triggerAndReturn(context || document, eventName, data)
  }

  // Number of active Ajax requests
  $.active = 0

  function ajaxStart(settings) {
    if (settings.global && $.active++ === 0) triggerGlobal(settings, null, 'ajaxStart')
  }
  function ajaxStop(settings) {
    if (settings.global && !(--$.active)) triggerGlobal(settings, null, 'ajaxStop')
  }

  // triggers an extra global event "ajaxBeforeSend" that's like "ajaxSend" but cancelable
  function ajaxBeforeSend(xhr, settings) {
    var context = settings.context
    if (settings.beforeSend.call(context, xhr, settings) === false ||
        triggerGlobal(settings, context, 'ajaxBeforeSend', [xhr, settings]) === false)
      return false

    triggerGlobal(settings, context, 'ajaxSend', [xhr, settings])
  }
  function ajaxSuccess(data, xhr, settings) {
    var context = settings.context, status = 'success'
    settings.success.call(context, data, status, xhr)
    triggerGlobal(settings, context, 'ajaxSuccess', [xhr, settings, data])
    ajaxComplete(status, xhr, settings)
  }
  // type: "timeout", "error", "abort", "parsererror"
  function ajaxError(error, type, xhr, settings) {
    var context = settings.context
    settings.error.call(context, xhr, type, error)
    triggerGlobal(settings, context, 'ajaxError', [xhr, settings, error])
    ajaxComplete(type, xhr, settings)
  }
  // status: "success", "notmodified", "error", "timeout", "abort", "parsererror"
  function ajaxComplete(status, xhr, settings) {
    var context = settings.context
    settings.complete.call(context, xhr, status)
    triggerGlobal(settings, context, 'ajaxComplete', [xhr, settings])
    ajaxStop(settings)
  }

  // Empty function, used as default callback
  function empty() {}

  $.ajaxJSONP = function(options){
    var callbackName = 'jsonp' + (++jsonpID),
      script = document.createElement('script'),
      abort = function(){
        $(script).remove()
        if (callbackName in window) window[callbackName] = empty
        ajaxComplete('abort', xhr, options)
      },
      xhr = { abort: abort }, abortTimeout

    if (options.error) script.onerror = function() {
      xhr.abort()
      options.error()
    }

    window[callbackName] = function(data){
      clearTimeout(abortTimeout)
      $(script).remove()
      delete window[callbackName]
      ajaxSuccess(data, xhr, options)
    }

    serializeData(options)
    script.src = options.url.replace(/=\?/, '=' + callbackName)
    $('head').append(script)

    if (options.timeout > 0) abortTimeout = setTimeout(function(){
        xhr.abort()
        ajaxComplete('timeout', xhr, options)
      }, options.timeout)

    return xhr
  }

  $.ajaxSettings = {
    // Default type of request
    type: 'GET',
    // Callback that is executed before request
    beforeSend: empty,
    // Callback that is executed if the request succeeds
    success: empty,
    // Callback that is executed the the server drops error
    error: empty,
    // Callback that is executed on request complete (both: error and success)
    complete: empty,
    // The context for the callbacks
    context: null,
    // Whether to trigger "global" Ajax events
    global: true,
    // Transport
    xhr: function () {
      return new window.XMLHttpRequest()
    },
    // MIME types mapping
    accepts: {
      script: 'text/javascript, application/javascript',
      json:   jsonType,
      xml:    'application/xml, text/xml',
      html:   htmlType,
      text:   'text/plain'
    },
    // Whether the request is to another domain
    crossDomain: false,
    // Default timeout
    timeout: 0
  }

  function mimeToDataType(mime) {
    return mime && ( mime == htmlType ? 'html' :
      mime == jsonType ? 'json' :
      scriptTypeRE.test(mime) ? 'script' :
      xmlTypeRE.test(mime) && 'xml' ) || 'text'
  }

  function appendQuery(url, query) {
    return (url + '&' + query).replace(/[&?]{1,2}/, '?')
  }

  // serialize payload and append it to the URL for GET requests
  function serializeData(options) {
    if (isObject(options.data)) options.data = $.param(options.data)
    if (options.data && (!options.type || options.type.toUpperCase() == 'GET'))
      options.url = appendQuery(options.url, options.data)
  }

  $.ajax = function(options){
    var settings = $.extend({}, options || {})
    for (key in $.ajaxSettings) if (settings[key] === undefined) settings[key] = $.ajaxSettings[key]

    ajaxStart(settings)

    if (!settings.crossDomain) settings.crossDomain = /^([\w-]+:)?\/\/([^\/]+)/.test(settings.url) &&
      RegExp.$2 != window.location.host

    var dataType = settings.dataType, hasPlaceholder = /=\?/.test(settings.url)
    if (dataType == 'jsonp' || hasPlaceholder) {
      if (!hasPlaceholder) settings.url = appendQuery(settings.url, 'callback=?')
      return $.ajaxJSONP(settings)
    }

    if (!settings.url) settings.url = window.location.toString()
    serializeData(settings)

    var mime = settings.accepts[dataType],
        baseHeaders = { },
        protocol = /^([\w-]+:)\/\//.test(settings.url) ? RegExp.$1 : window.location.protocol,
        xhr = $.ajaxSettings.xhr(), abortTimeout

    if (!settings.crossDomain) baseHeaders['X-Requested-With'] = 'XMLHttpRequest'
    if (mime) {
      baseHeaders['Accept'] = mime
      if (mime.indexOf(',') > -1) mime = mime.split(',', 2)[0]
      xhr.overrideMimeType && xhr.overrideMimeType(mime)
    }
    if (settings.contentType || (settings.data && settings.type.toUpperCase() != 'GET'))
      baseHeaders['Content-Type'] = (settings.contentType || 'application/x-www-form-urlencoded')
    settings.headers = $.extend(baseHeaders, settings.headers || {})

    xhr.onreadystatechange = function(){
      if (xhr.readyState == 4) {
        clearTimeout(abortTimeout)
        var result, error = false
        if ((xhr.status >= 200 && xhr.status < 300) || xhr.status == 304 || (xhr.status == 0 && protocol == 'file:')) {
          dataType = dataType || mimeToDataType(xhr.getResponseHeader('content-type'))
          result = xhr.responseText

          try {
            if (dataType == 'script')    (1,eval)(result)
            else if (dataType == 'xml')  result = xhr.responseXML
            else if (dataType == 'json') result = blankRE.test(result) ? null : JSON.parse(result)
          } catch (e) { error = e }

          if (error) ajaxError(error, 'parsererror', xhr, settings)
          else ajaxSuccess(result, xhr, settings)
        } else {
          ajaxError(null, 'error', xhr, settings)
        }
      }
    }

    var async = 'async' in settings ? settings.async : true
    xhr.open(settings.type, settings.url, async)

    for (name in settings.headers) xhr.setRequestHeader(name, settings.headers[name])

    if (ajaxBeforeSend(xhr, settings) === false) {
      xhr.abort()
      return false
    }

    if (settings.timeout > 0) abortTimeout = setTimeout(function(){
        xhr.onreadystatechange = empty
        xhr.abort()
        ajaxError(null, 'timeout', xhr, settings)
      }, settings.timeout)

    // avoid sending empty string (#319)
    xhr.send(settings.data ? settings.data : null)
    return xhr
  }

  $.get = function(url, success){ return $.ajax({ url: url, success: success }) }

  $.post = function(url, data, success, dataType){
    if ($.isFunction(data)) dataType = dataType || success, success = data, data = null
    return $.ajax({ type: 'POST', url: url, data: data, success: success, dataType: dataType })
  }

  $.getJSON = function(url, success){
    return $.ajax({ url: url, success: success, dataType: 'json' })
  }

  $.fn.load = function(url, success){
    if (!this.length) return this
    var self = this, parts = url.split(/\s/), selector
    if (parts.length > 1) url = parts[0], selector = parts[1]
    $.get(url, function(response){
      self.html(selector ?
        $(document.createElement('div')).html(response.replace(rscript, "")).find(selector).html()
        : response)
      success && success.call(self)
    })
    return this
  }

  var escape = encodeURIComponent

  function serialize(params, obj, traditional, scope){
    var array = $.isArray(obj)
    $.each(obj, function(key, value) {
      if (scope) key = traditional ? scope : scope + '[' + (array ? '' : key) + ']'
      // handle data in serializeArray() format
      if (!scope && array) params.add(value.name, value.value)
      // recurse into nested objects
      else if (traditional ? $.isArray(value) : isObject(value))
        serialize(params, value, traditional, key)
      else params.add(key, value)
    })
  }

  $.param = function(obj, traditional){
    var params = []
    params.add = function(k, v){ this.push(escape(k) + '=' + escape(v)) }
    serialize(params, obj, traditional)
    return params.join('&').replace('%20', '+')
  }
})(Zepto)
;(function ($) {
  $.fn.serializeArray = function () {
    var result = [], el
    $( Array.prototype.slice.call(this.get(0).elements) ).each(function () {
      el = $(this)
      var type = el.attr('type')
      if (this.nodeName.toLowerCase() != 'fieldset' &&
        !this.disabled && type != 'submit' && type != 'reset' && type != 'button' &&
        ((type != 'radio' && type != 'checkbox') || this.checked))
        result.push({
          name: el.attr('name'),
          value: el.val()
        })
    })
    return result
  }

  $.fn.serialize = function () {
    var result = []
    this.serializeArray().forEach(function (elm) {
      result.push( encodeURIComponent(elm.name) + '=' + encodeURIComponent(elm.value) )
    })
    return result.join('&')
  }

  $.fn.submit = function (callback) {
    if (callback) this.bind('submit', callback)
    else if (this.length) {
      var event = $.Event('submit')
      this.eq(0).trigger(event)
      if (!event.defaultPrevented) this.get(0).submit()
    }
    return this
  }

})(Zepto)
;(function($){
  var touch = {}, touchTimeout

  function parentIfText(node){
    return 'tagName' in node ? node : node.parentNode
  }

  function swipeDirection(x1, x2, y1, y2){
    var xDelta = Math.abs(x1 - x2), yDelta = Math.abs(y1 - y2)
    return xDelta >= yDelta ? (x1 - x2 > 0 ? 'Left' : 'Right') : (y1 - y2 > 0 ? 'Up' : 'Down')
  }

  var longTapDelay = 750, longTapTimeout

  function longTap(){
    longTapTimeout = null
    if (touch.last) {
      touch.el.trigger('longTap')
      touch = {}
    }
  }

  function cancelLongTap(){
    if (longTapTimeout) clearTimeout(longTapTimeout)
    longTapTimeout = null
  }

  $(document).ready(function(){
    var now, delta

    $(document.body).bind('touchstart', function(e){
      now = Date.now()
      delta = now - (touch.last || now)
      touch.el = $(parentIfText(e.touches[0].target))
      touchTimeout && clearTimeout(touchTimeout)
      touch.x1 = e.touches[0].pageX
      touch.y1 = e.touches[0].pageY
      if (delta > 0 && delta <= 250) touch.isDoubleTap = true
      touch.last = now
      longTapTimeout = setTimeout(longTap, longTapDelay)
    }).bind('touchmove', function(e){
      cancelLongTap()
      touch.x2 = e.touches[0].pageX
      touch.y2 = e.touches[0].pageY
    }).bind('touchend', function(e){
       cancelLongTap()

      // double tap (tapped twice within 250ms)
      if (touch.isDoubleTap) {
        touch.el.trigger('doubleTap')
        touch = {}

      // swipe
      } else if ((touch.x2 && Math.abs(touch.x1 - touch.x2) > 30) ||
                 (touch.y2 && Math.abs(touch.y1 - touch.y2) > 30)) {
        touch.el.trigger('swipe') &&
          touch.el.trigger('swipe' + (swipeDirection(touch.x1, touch.x2, touch.y1, touch.y2)))
        touch = {}

      // normal tap
      } else if ('last' in touch) {
        touch.el.trigger('tap')

        touchTimeout = setTimeout(function(){
          touchTimeout = null
          touch.el.trigger('singleTap')
          touch = {}
        }, 250)
      }
    }).bind('touchcancel', function(){
      if (touchTimeout) clearTimeout(touchTimeout)
      if (longTapTimeout) clearTimeout(longTapTimeout)
      longTapTimeout = touchTimeout = null
      touch = {}
    })
  })

  ;['swipe', 'swipeLeft', 'swipeRight', 'swipeUp', 'swipeDown', 'doubleTap', 'tap', 'singleTap', 'longTap'].forEach(function(m){
    $.fn[m] = function(callback){ return this.bind(m, callback) }
  })
})(Zepto)

/*
 * timeago: a jQuery plugin ported to Zepto, version: 0.9.3 (2011-01-21)
 * @requires Zepto.js 0.4
 *
 * Timeago is a jQuery plugin that makes it easy to support automatically
 * updating fuzzy timestamps (e.g. "4 minutes ago" or "about 1 day ago").
 *
 * For usage and examples, visit:
 * http://timeago.yarp.com/
 *
 * Licensed under the MIT:
 * http://www.opensource.org/licenses/mit-license.php
 *
 * Copyright (c) 2008-2010, Ryan McGeary (ryanonjavascript -[at]- mcgeary [*dot*] org)
 * Modifications (c) 2011, Gáspár Körtesi (gazs -[at]- bergengocia [*dot*] net)
 *
 * isFunction copied from Underscore.js, (c) 2011 Jeremy Ashkenas, DocumentCloud Inc.
 * trim copied from underscore.string (c) 2010 Esa-Matti Suuronen <esa-matti aet suuronen dot org>
 * json date reviver from Douglas Crockford's json2.js
 */
;(function($){
  var nativeTrim = String.prototype.trim;
  $.trim = function(str, characters){
    if (!characters && nativeTrim) {
      return nativeTrim.call(str);
    }
    characters = defaultToWhiteSpace(characters);
    return str.replace(new RegExp('\^[' + characters + ']+|[' + characters + ']+$', 'g'), '');
  };
  $.timeago = function(timestamp) {
    if (timestamp instanceof Date) return inWords(timestamp);
    else if (typeof timestamp == "string") return inWords($.timeago.parse(timestamp));
    else return inWords($.timeago.datetime(timestamp));
  };
  $.isFunction = function(obj) {
    return !!(obj && obj.constructor && obj.call && obj.apply);
  };
  $.jsonDateReviver = function (key, value) {
    var a;
    if (typeof value === 'string') {
      a = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/.exec(value);
      if (a) {
        return new Date(Date.UTC(+a[1], +a[2] - 1, +a[3], +a[4],+a[5], +a[6]));
      }
    }
    return value;
  };
  $.fn.data = function(key, value) {
    if (typeof key === "undefined") {
      throw "not implemented :( please fixme";
    }
    if (typeof value === "undefined") {
      // show key 
      try {
        return JSON.parse($(this).attr("data-" + key), $.jsonDateReviver);
      } 
      catch(e) {
        $(this).attr("data-" + key);
      }
      } else {
        // set key value
        if (typeof value === "object") {
          $(this).attr("data-" + key, JSON.stringify(value));
        } else {
          $(this).attr("data-" + key, value);
        }
      }
    }
  
})(Zepto);

;(function($) {
  $.timeago = function(timestamp) {
    if (timestamp instanceof Date) {
      return inWords(timestamp);
    } else if (typeof timestamp === "string") {
      return inWords($.timeago.parse(timestamp));
    } else {
      return inWords($.timeago.datetime(timestamp));
    }
  };
  var $t = $.timeago;

  $.extend($.timeago, {
    settings: {
      refreshMillis: 60000,
      allowFuture: false,
      strings: {
        prefixAgo: null,
        prefixFromNow: null,
        suffixAgo: "ago",
        suffixFromNow: "from now",
        seconds: "less than a minute",
        minute: "about a minute",
        minutes: "%d minutes",
        hour: "about an hour",
        hours: "about %d hours",
        day: "a day",
        days: "%d days",
        month: "about a month",
        months: "%d months",
        year: "about a year",
        years: "%d years",
        numbers: []
      }
    },
    inWords: function(distanceMillis) {
      var $l = this.settings.strings;
      var prefix = $l.prefixAgo;
      var suffix = $l.suffixAgo;
      if (this.settings.allowFuture) {
        if (distanceMillis < 0) {
          prefix = $l.prefixFromNow;
          suffix = $l.suffixFromNow;
        }
        distanceMillis = Math.abs(distanceMillis);
      }

      var seconds = distanceMillis / 1000;
      var minutes = seconds / 60;
      var hours = minutes / 60;
      var days = hours / 24;
      var years = days / 365;

      function substitute(stringOrFunction, number) {
        var string = $.isFunction(stringOrFunction) ? stringOrFunction(number, distanceMillis) : stringOrFunction;
        var value = ($l.numbers && $l.numbers[number]) || number;
        return string.replace(/%d/i, value);
      }

      var words = seconds < 45 && substitute($l.seconds, Math.round(seconds)) ||
        seconds < 90 && substitute($l.minute, 1) ||
        minutes < 45 && substitute($l.minutes, Math.round(minutes)) ||
        minutes < 90 && substitute($l.hour, 1) ||
        hours < 24 && substitute($l.hours, Math.round(hours)) ||
        hours < 48 && substitute($l.day, 1) ||
        days < 30 && substitute($l.days, Math.floor(days)) ||
        days < 60 && substitute($l.month, 1) ||
        days < 365 && substitute($l.months, Math.floor(days / 30)) ||
        years < 2 && substitute($l.year, 1) ||
        substitute($l.years, Math.floor(years));

      return $.trim([prefix, words, suffix].join(" "));
    },
    parse: function(iso8601) {
      var s = $.trim(iso8601);
      s = s.replace(/\.\d\d\d+/,""); // remove milliseconds
      s = s.replace(/-/,"/").replace(/-/,"/");
      s = s.replace(/T/," ").replace(/Z/," UTC");
      s = s.replace(/([\+\-]\d\d)\:?(\d\d)/," $1$2"); // -04:00 -> -0400
      return new Date(s);
    },
    datetime: function(elem) {
      // jQuery's `is()` doesn't play well with HTML5 in IE
      var isTime = $(elem).get(0).tagName.toLowerCase() === "time"; // $(elem).is("time");
      var iso8601 = isTime ? $(elem).attr("datetime") : $(elem).attr("title");
      return $t.parse(iso8601);
    }
  });

  $.fn.timeago = function() {
    var self = this;
    self.each(refresh);

    var $s = $t.settings;
    if ($s.refreshMillis > 0) {
      setInterval(function() { self.each(refresh); }, $s.refreshMillis);
    }
    return self;
  };

  function refresh() {
    var data = prepareData(this);
    if (!isNaN(data.datetime)) {
      $(this).text(inWords(data.datetime));
    }
    return this;
  }

  function prepareData(element) {
    element = $(element);
    if (!element.data("timeago")) {
      element.data("timeago", { datetime: $t.datetime(element) });
      var text = $.trim(element.text());
      if (text.length > 0) {
        element.attr("title", text);
      }
    }
    return element.data("timeago");
  }

  function inWords(date) {
    return $t.inWords(distance(date));
  }

  function distance(date) {
    return (new Date().getTime() - date.getTime());
  }

  // fix for IE6 suckage
  document.createElement("abbr");
  document.createElement("time");
})(Zepto);

window.Zepto = Zepto;
'$' in window || (window.$ = Zepto);

if ( typeof define === "function" && define.amd ) {
  define( "zepto", [], function () { return Zepto; } );
};
/*!
 * Lo-Dash v0.2.2 <http://lodash.com>
 * Copyright 2012 John-David Dalton <http://allyoucanleet.com/>
 * Based on Underscore.js 1.3.3, copyright 2009-2012 Jeremy Ashkenas, DocumentCloud Inc.
 * <http://documentcloud.github.com/underscore>
 * Available under MIT license <http://lodash.com/license>
 */
;(function(window, undefined) {
  

  /** Detect free variable `exports` */
  var freeExports = typeof exports == 'object' && exports &&
    (typeof global == 'object' && global && global == global.global && (window = global), exports);

  /** Used to escape characters in templates */
  var escapes = {
    '\\': '\\',
    "'": "'",
    '\n': 'n',
    '\r': 'r',
    '\t': 't',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  /**
   * Detect the JScript [[DontEnum]] bug:
   * In IE < 9 an objects own properties, shadowing non-enumerable ones, are
   * made non-enumerable as well.
   */
  var hasDontEnumBug = !{ 'valueOf': 0 }.propertyIsEnumerable('valueOf');

  /** Used to generate unique IDs */
  var idCounter = 0;

  /** Used to determine if values are of the language type Object */
  var objectTypes = {
    'boolean': false,
    'function': true,
    'object': true,
    'number': false,
    'string': false,
    'undefined': false
  };

  /** Used to restore the original `_` reference in `noConflict` */
  var oldDash = window._;

  /** Used to detect if a method is native */
  var reNative = RegExp('^' + ({}.valueOf + '')
    .replace(/[.*+?^=!:${}()|[\]\/\\]/g, '\\$&')
    .replace(/valueOf|for [^\]]+/g, '.+?') + '$');

  /** Used to match tokens in template text */
  var reToken = /__token__(\d+)/g;

  /** Used to match unescaped characters in template text */
  var reUnescaped = /['\n\r\t\u2028\u2029\\]/g;

  /** Used to fix the JScript [[DontEnum]] bug */
  var shadowed = [
    'constructor', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable',
    'toLocaleString', 'toString', 'valueOf'
  ];

  /** Used to replace template delimiters */
  var token = '__token__';

  /** Used to store tokenized template text snippets */
  var tokenized = [];

  /** Object#toString result shortcuts */
  var arrayClass = '[object Array]',
      boolClass = '[object Boolean]',
      dateClass = '[object Date]',
      funcClass = '[object Function]',
      numberClass = '[object Number]',
      regexpClass = '[object RegExp]',
      stringClass = '[object String]';

  /** Native prototype shortcuts */
  var ArrayProto = Array.prototype,
      ObjectProto = Object.prototype;

  /** Native method shortcuts */
  var concat = ArrayProto.concat,
      hasOwnProperty = ObjectProto.hasOwnProperty,
      push = ArrayProto.push,
      slice = ArrayProto.slice,
      toString = ObjectProto.toString;

  /* Used if `Function#bind` exists and is inferred to be fast (i.e. all but V8) */
  var nativeBind = reNative.test(nativeBind = slice.bind) &&
    /\n|Opera/.test(nativeBind + toString.call(window.opera)) && nativeBind;

  /* Native method shortcuts for methods with the same name as other `lodash` methods */
  var nativeIsArray = reNative.test(nativeIsArray = Array.isArray) && nativeIsArray,
      nativeIsFinite = window.isFinite,
      nativeKeys = reNative.test(nativeKeys = Object.keys) && nativeKeys;

  /** Timer shortcuts */
  var clearTimeout = window.clearTimeout,
      setTimeout = window.setTimeout;

  /*--------------------------------------------------------------------------*/

  /**
   * The `lodash` function.
   *
   * @name _
   * @constructor
   * @param {Mixed} value The value to wrap in a `LoDash` instance.
   * @returns {Object} Returns a `LoDash` instance.
   */
  function lodash(value) {
    // allow invoking `lodash` without the `new` operator
    return new LoDash(value);
  }

  /**
   * Creates a `LoDash` instance that wraps a value to allow chaining.
   *
   * @private
   * @constructor
   * @param {Mixed} value The value to wrap.
   */
  function LoDash(value) {
    // exit early if already wrapped
    if (value && value._wrapped) {
      return value;
    }
    this._wrapped = value;
  }

  /**
   * By default, Lo-Dash uses ERB-style template delimiters, change the
   * following template settings to use alternative delimiters.
   *
   * @static
   * @memberOf _
   * @type Object
   */
  lodash.templateSettings = {

    /**
     * Used to detect `data` property values to be HTML-escaped.
     *
     * @static
     * @memberOf _.templateSettings
     * @type RegExp
     */
    'escape': /<%-([\s\S]+?)%>/g,

    /**
     * Used to detect code to be evaluated.
     *
     * @static
     * @memberOf _.templateSettings
     * @type RegExp
     */
    'evaluate': /<%([\s\S]+?)%>/g,

    /**
     * Used to detect `data` property values to inject.
     *
     * @static
     * @memberOf _.templateSettings
     * @type RegExp
     */
    'interpolate': /<%=([\s\S]+?)%>/g,

    /**
     * Used to reference the data object in the template text.
     *
     * @static
     * @memberOf _.templateSettings
     * @type String
     */
    'variable': 'obj'
  };

  /*--------------------------------------------------------------------------*/

  /**
   * The template used to create iterator functions.
   *
   * @private
   * @param {Obect} data The data object used to populate the text.
   * @returns {String} Returns the interpolated text.
   */
  var iteratorTemplate = template(
    // assign the `result` variable an initial value
    'var index, result<% if (init) { %> = <%= init %><% } %>;\n' +
    // add code to exit early or do so if the first argument is falsey
    '<%= exit %>;\n' +
    // add code after the exit snippet but before the iteration branches
    '<%= top %>;\n' +

    // the following branch is for iterating arrays and array-like objects
    '<% if (arrayBranch) { %>' +
    'var length = <%= firstArg %>.length; index = -1;' +
    '  <% if (objectBranch) { %>\nif (length === +length) {<% } %>\n' +
    '  <%= arrayBranch.beforeLoop %>;\n' +
    '  while (<%= arrayBranch.loopExp %>) {\n' +
    '    <%= arrayBranch.inLoop %>;\n' +
    '  }' +
    '  <% if (objectBranch) { %>\n}\n<% }' +
    '}' +

    // the following branch is for iterating an object's own/inherited properties
    'if (objectBranch) {' +
    '  if (arrayBranch) { %>else {\n<% }' +
    '  if (!hasDontEnumBug) { %>  var skipProto = typeof <%= iteratedObject %> == \'function\';\n<% } %>' +
    '  <%= objectBranch.beforeLoop %>;\n' +
    '  for (<%= objectBranch.loopExp %>) {' +
    '  \n<%' +
    '  if (hasDontEnumBug) {' +
    '    if (useHas) { %>    if (<%= hasExp %>) {\n  <% } %>' +
    '    <%= objectBranch.inLoop %>;<%' +
    '    if (useHas) { %>\n    }<% }' +
    '  }' +
    '  else {' +
    '  %>' +

    // Firefox < 3.6, Opera > 9.50 - Opera < 11.60, and Safari < 5.1
    // (if the prototype or a property on the prototype has been set)
    // incorrectly sets a function's `prototype` property [[Enumerable]]
    // value to `true`. Because of this Lo-Dash standardizes on skipping
    // the the `prototype` property of functions regardless of its
    // [[Enumerable]] value.
    '    if (!(skipProto && index == \'prototype\')<% if (useHas) { %> && <%= hasExp %><% } %>) {\n' +
    '      <%= objectBranch.inLoop %>;\n' +
    '    }' +
    '  <% } %>\n' +
    '  }' +

    // Because IE < 9 can't set the `[[Enumerable]]` attribute of an
    // existing property and the `constructor` property of a prototype
    // defaults to non-enumerable, Lo-Dash skips the `constructor`
    // property when it infers it's iterating over a `prototype` object.
    '  <% if (hasDontEnumBug) { %>\n' +
    '  var ctor = <%= iteratedObject %>.constructor;\n' +
    '  <% for (var k = 0; k < 7; k++) { %>\n' +
    '  index = \'<%= shadowed[k] %>\';\n' +
    '  if (<%' +
    '      if (shadowed[k] == \'constructor\') {' +
    '        %>!(ctor && ctor.prototype === <%= iteratedObject %>) && <%' +
    '      } %><%= hasExp %>) {\n' +
    '    <%= objectBranch.inLoop %>;\n' +
    '  }<%' +
    '     }' +
    '   }' +
    '   if (arrayBranch) { %>\n}<% }' +
    '} %>\n' +

    // add code to the bottom of the iteration function
    '<%= bottom %>;\n' +
    // finally, return the `result`
    'return result'
  );

  /**
   * Reusable iterator options shared by
   * `every`, `filter`, `find`, `forEach`,`groupBy`, `map`, `reject`, and `some`.
   */
  var baseIteratorOptions = {
    'args': 'collection, callback, thisArg',
    'init': 'collection',
    'top':
      'if (!callback) {\n' +
      '  callback = identity\n' +
      '}\n' +
      'else if (thisArg) {\n' +
      '  callback = bind(callback, thisArg)\n' +
      '}',
    'inLoop': 'callback(collection[index], index, collection)'
  };

  /** Reusable iterator options for `every` and `some` */
  var everyIteratorOptions = {
    'init': 'true',
    'inLoop': 'if (!callback(collection[index], index, collection)) return !result'
  };

  /** Reusable iterator options for `defaults` and `extend` */
  var extendIteratorOptions = {
    'args': 'object',
    'init': 'object',
    'top':
      'for (var source, sourceIndex = 1, length = arguments.length; sourceIndex < length; sourceIndex++) {\n' +
      '  source = arguments[sourceIndex];\n' +
      (hasDontEnumBug ? '  if (source) {' : ''),
    'loopExp': 'index in source',
    'useHas': false,
    'inLoop': 'object[index] = source[index]',
    'bottom': (hasDontEnumBug ? '  }\n' : '') + '}'
  };

  /** Reusable iterator options for `filter`  and `reject` */
  var filterIteratorOptions = {
    'init': '[]',
    'inLoop': 'callback(collection[index], index, collection) && result.push(collection[index])'
  };

  /** Reusable iterator options for `find`  and `forEach` */
  var forEachIteratorOptions = {
    'top': 'if (thisArg) callback = bind(callback, thisArg)'
  };

  /** Reusable iterator options for `map`, `pluck`, and `values` */
  var mapIteratorOptions = {
    'init': '',
    'exit': 'if (!collection) return []',
    'beforeLoop': {
      'array':  'result = Array(length)',
      'object': 'result = []'
    },
    'inLoop': {
      'array':  'result[index] = callback(collection[index], index, collection)',
      'object': 'result.push(callback(collection[index], index, collection))'
    }
  };

  /*--------------------------------------------------------------------------*/

  /**
   * Creates compiled iteration functions. The iteration function will be created
   * to iterate over only objects if the first argument of `options.args` is
   * "object" or `options.inLoop.array` is falsey.
   *
   * @private
   * @param {Object} [options1, options2, ...] The compile options objects.
   *
   *  args - A string of comma separated arguments the iteration function will
   *   accept.
   *
   *  init - A string to specify the initial value of the `result` variable.
   *
   *  exit - A string of code to use in place of the default exit-early check
   *   of `if (!arguments[0]) return result`.
   *
   *  top - A string of code to execute after the exit-early check but before
   *   the iteration branches.
   *
   *  beforeLoop - A string or object containing an "array" or "object" property
   *   of code to execute before the array or object loops.
   *
   *  loopExp - A string or object containing an "array" or "object" property
   *   of code to execute as the array or object loop expression.
   *
   *  useHas - A boolean to specify whether or not to use `hasOwnProperty` checks
   *   in the object loop.
   *
   *  inLoop - A string or object containing an "array" or "object" property
   *   of code to execute in the array or object loops.
   *
   *  bottom - A string of code to execute after the iteration branches but
   *   before the `result` is returned.
   *
   * @returns {Function} Returns the compiled function.
   */
  function createIterator() {
    var object,
        prop,
        value,
        index = -1,
        length = arguments.length;

    // merge options into a template data object
    var data = {
      'bottom': '',
      'exit': '',
      'init': '',
      'top': '',
      'arrayBranch': { 'beforeLoop': '', 'loopExp': '++index < length' },
      'objectBranch': { 'beforeLoop': '' }
    };

    while (++index < length) {
      object = arguments[index];
      for (prop in object) {
        value = (value = object[prop]) == null ? '' : value;
        // keep this regexp explicit for the build pre-process
        if (/beforeLoop|loopExp|inLoop/.test(prop)) {
          if (typeof value == 'string') {
            value = { 'array': value, 'object': value };
          }
          data.arrayBranch[prop] = value.array;
          data.objectBranch[prop] = value.object;
        } else {
          data[prop] = value;
        }
      }
    }
    // set additional template data values
    var args = data.args,
        arrayBranch = data.arrayBranch,
        objectBranch = data.objectBranch,
        firstArg = /^[^,]+/.exec(args)[0],
        loopExp = objectBranch.loopExp,
        iteratedObject = /\S+$/.exec(loopExp || firstArg)[0];

    data.firstArg = firstArg;
    data.hasDontEnumBug = hasDontEnumBug;
    data.hasExp = 'hasOwnProperty.call(' + iteratedObject + ', index)';
    data.iteratedObject = iteratedObject;
    data.shadowed = shadowed;
    data.useHas = data.useHas !== false;

    if (!data.exit) {
      data.exit = 'if (!' + firstArg + ') return result';
    }
    if (firstArg == 'object' || !arrayBranch.inLoop) {
      data.arrayBranch = null;
    }
    if (!loopExp) {
      objectBranch.loopExp = 'index in ' + iteratedObject;
    }
    // create the function factory
    var factory = Function(
        'arrayClass, bind, funcClass, hasOwnProperty, identity, objectTypes, ' +
        'stringClass, toString, undefined',
      ' return function(' + args + ') {\n' + iteratorTemplate(data) + '\n}'
    );
    // return the compiled function
    return factory(
      arrayClass, bind, funcClass, hasOwnProperty, identity, objectTypes,
      stringClass, toString
    );
  }

  /**
   * Used by `template()` to replace tokens with their corresponding code snippets.
   *
   * @private
   * @param {String} match The matched token.
   * @param {String} index The `tokenized` index of the code snippet.
   * @returns {String} Returns the code snippet.
   */
  function detokenize(match, index) {
    return tokenized[index];
  }

  /**
   * Used by `template()` to escape characters for inclusion in compiled
   * string literals.
   *
   * @private
   * @param {String} match The matched character to escape.
   * @returns {String} Returns the escaped character.
   */
  function escapeChar(match) {
    return '\\' + escapes[match];
  }

  /**
   * A no-operation function.
   *
   * @private
   */
  function noop() {
    // no operation performed
  }

  /**
   * Used by `template()` to replace "escape" template delimiters with tokens.
   *
   * @private
   * @param {String} match The matched template delimiter.
   * @param {String} value The delimiter value.
   * @returns {String} Returns a token.
   */
  function tokenizeEscape(match, value) {
    var index = tokenized.length;
    tokenized[index] = "'+\n((__t = (" + value + ")) == null ? '' : _.escape(__t)) +\n'";
    return token + index;
  }

  /**
   * Used by `template()` to replace "interpolate" template delimiters with tokens.
   *
   * @private
   * @param {String} match The matched template delimiter.
   * @param {String} value The delimiter value.
   * @returns {String} Returns a token.
   */
  function tokenizeInterpolate(match, value) {
    var index = tokenized.length;
    tokenized[index] = "'+\n((__t = (" + value + ")) == null ? '' : __t) +\n'";
    return token + index;
  }

  /**
   * Used by `template()` to replace "evaluate" template delimiters with tokens.
   *
   * @private
   * @param {String} match The matched template delimiter.
   * @param {String} value The delimiter value.
   * @returns {String} Returns a token.
   */
  function tokenizeEvaluate(match, value) {
    var index = tokenized.length;
    tokenized[index] = "';\n" + value + ";\n__p += '";
    return token + index;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Checks if a given `target` value is present in a `collection` using strict
   * equality for comparisons, i.e. `===`.
   *
   * @static
   * @memberOf _
   * @alias include
   * @category Collections
   * @param {Array|Object} collection The collection to iterate over.
   * @param {Mixed} target The value to check for.
   * @returns {Boolean} Returns `true` if `target` value is found, else `false`.
   * @example
   *
   * _.contains([1, 2, 3], 3);
   * // => true
   */
  var contains = createIterator({
    'args': 'collection, target',
    'init': 'false',
    'inLoop': 'if (collection[index] === target) return true'
  });

  /**
   * Checks if the `callback` returns a truthy value for **all** elements of a
   * `collection`. The `callback` is invoked with 3 arguments; for arrays they
   * are (value, index, array) and for objects they are (value, key, object).
   *
   * @static
   * @memberOf _
   * @alias all
   * @category Collections
   * @param {Array|Object} collection The collection to iterate over.
   * @param {Function} callback The function called per iteration.
   * @param {Mixed} [thisArg] The `this` binding for the callback.
   * @returns {Boolean} Returns `true` if all values pass the callback check, else `false`.
   * @example
   *
   * _.every([true, 1, null, 'yes'], Boolean);
   * // => false
   */
  var every = createIterator(baseIteratorOptions, everyIteratorOptions);

  /**
   * Examines each value in a `collection`, returning an array of all values the
   * `callback` returns truthy for. The `callback` is invoked with 3 arguments;
   * for arrays they are (value, index, array) and for objects they are
   * (value, key, object).
   *
   * @static
   * @memberOf _
   * @alias select
   * @category Collections
   * @param {Array|Object} collection The collection to iterate over.
   * @param {Function} callback The function called per iteration.
   * @param {Mixed} [thisArg] The `this` binding for the callback.
   * @returns {Array} Returns a new array of values that passed callback check.
   * @example
   *
   * var evens = _.filter([1, 2, 3, 4, 5, 6], function(num) { return num % 2 == 0; });
   * // => [2, 4, 6]
   */
  var filter = createIterator(baseIteratorOptions, filterIteratorOptions);

  /**
   * Examines each value in a `collection`, returning the first one the `callback`
   * returns truthy for. The function returns as soon as it finds an acceptable
   * value, and does not iterate over the entire `collection`. The `callback` is
   * invoked with 3 arguments; for arrays they are (value, index, array) and for
   * objects they are (value, key, object).
   *
   * @static
   * @memberOf _
   * @alias detect
   * @category Collections
   * @param {Array|Object} collection The collection to iterate over.
   * @param {Function} callback The function called per iteration.
   * @param {Mixed} [thisArg] The `this` binding for the callback.
   * @returns {Mixed} Returns the value that passed the callback check, else `undefined`.
   * @example
   *
   * var even = _.find([1, 2, 3, 4, 5, 6], function(num) { return num % 2 == 0; });
   * // => 2
   */
  var find = createIterator(baseIteratorOptions, forEachIteratorOptions, {
    'init': '',
    'inLoop': 'if (callback(collection[index], index, collection)) return collection[index]'
  });

  /**
   * Iterates over a `collection`, executing the `callback` for each value in the
   * `collection`. The `callback` is bound to the `thisArg` value, if one is passed.
   * The `callback` is invoked with 3 arguments; for arrays they are
   * (value, index, array) and for objects they are (value, key, object).
   *
   * @static
   * @memberOf _
   * @alias each
   * @category Collections
   * @param {Array|Object} collection The collection to iterate over.
   * @param {Function} callback The function called per iteration.
   * @param {Mixed} [thisArg] The `this` binding for the callback.
   * @returns {Array|Object} Returns the `collection`.
   * @example
   *
   * _.forEach({ 'one': 1, 'two': 2, 'three': 3}, function(num) { alert(num); });
   * // => alerts each number in turn
   *
   * _([1, 2, 3]).forEach(function(num) { alert(num); }).join(',');
   * // => alerts each number in turn and returns '1,2,3'
   */
  var forEach = createIterator(baseIteratorOptions, forEachIteratorOptions);

  /**
   * Produces a new array of values by mapping each value in the `collection`
   * through a transformation `callback`. The `callback` is bound to the `thisArg`
   * value, if one is passed. The `callback` is invoked with 3 arguments; for
   * arrays they are (value, index, array) and for objects they are (value, key, object).
   *
   * @static
   * @memberOf _
   * @alias collect
   * @category Collections
   * @param {Array|Object} collection The collection to iterate over.
   * @param {Function} callback The function called per iteration.
   * @param {Mixed} [thisArg] The `this` binding for the callback.
   * @returns {Array} Returns a new array of values returned by the callback.
   * @example
   *
   * _.map([1, 2, 3], function(num) { return num * 3; });
   * // => [3, 6, 9]
   *
   * _.map({ 'one': 1, 'two': 2, 'three': 3 }, function(num) { return num * 3; });
   * // => [3, 6, 9]
   */
  var map = createIterator(baseIteratorOptions, mapIteratorOptions);

  /**
   * Retrieves the value of a specified property from all values in a `collection`.
   *
   * @static
   * @memberOf _
   * @category Collections
   * @param {Array|Object} collection The collection to iterate over.
   * @param {String} property The property to pluck.
   * @returns {Array} Returns a new array of property values.
   * @example
   *
   * var stooges = [
   *   { 'name': 'moe', 'age': 40 },
   *   { 'name': 'larry', 'age': 50 },
   *   { 'name': 'curly', 'age': 60 }
   * ];
   *
   * _.pluck(stooges, 'name');
   * // => ['moe', 'larry', 'curly']
   */
  var pluck = createIterator(mapIteratorOptions, {
    'args': 'collection, property',
    'inLoop': {
      'array':  'result[index] = collection[index][property]',
      'object': 'result.push(collection[index][property])'
    }
  });

  /**
   * Boils down a `collection` to a single value. The initial state of the
   * reduction is `accumulator` and each successive step of it should be returned
   * by the `callback`. The `callback` is bound to the `thisArg` value, if one is
   * passed. The `callback` is invoked with 4 arguments; for arrays they are
   * (accumulator, value, index, array) and for objects they are
   * (accumulator, value, key, object).
   *
   * @static
   * @memberOf _
   * @alias foldl, inject
   * @category Collections
   * @param {Array|Object} collection The collection to iterate over.
   * @param {Function} callback The function called per iteration.
   * @param {Mixed} [accumulator] Initial value of the accumulator.
   * @param {Mixed} [thisArg] The `this` binding for the callback.
   * @returns {Mixed} Returns the accumulated value.
   * @example
   *
   * var sum = _.reduce([1, 2, 3], function(memo, num) { return memo + num; });
   * // => 6
   */
  var reduce = createIterator({
    'args': 'collection, callback, accumulator, thisArg',
    'init': 'accumulator',
    'top':
      'var noaccum = arguments.length < 3;\n' +
      'if (thisArg) callback = bind(callback, thisArg)',
    'beforeLoop': {
      'array': 'if (noaccum) result = collection[++index]'
    },
    'inLoop': {
      'array':
        'result = callback(result, collection[index], index, collection)',
      'object':
        'result = noaccum\n' +
        '  ? (noaccum = false, collection[index])\n' +
        '  : callback(result, collection[index], index, collection)'
    }
  });

  /**
   * The right-associative version of `_.reduce`. The `callback` is bound to the
   * `thisArg` value, if one is passed. The `callback` is invoked with 4 arguments;
   * for arrays they are (accumulator, value, index, array) and for objects they
   * are (accumulator, value, key, object).
   *
   * @static
   * @memberOf _
   * @alias foldr
   * @category Collections
   * @param {Array|Object} collection The collection to iterate over.
   * @param {Function} callback The function called per iteration.
   * @param {Mixed} [accumulator] Initial value of the accumulator.
   * @param {Mixed} [thisArg] The `this` binding for the callback.
   * @returns {Mixed} Returns the accumulated value.
   * @example
   *
   * var list = [[0, 1], [2, 3], [4, 5]];
   * var flat = _.reduceRight(list, function(a, b) { return a.concat(b); }, []);
   * // => [4, 5, 2, 3, 0, 1]
   */
  function reduceRight(collection, callback, accumulator, thisArg) {
    if (!collection) {
      return accumulator;
    }

    var length = collection.length,
        noaccum = arguments.length < 3;

    if(thisArg) {
      callback = bind(callback, thisArg);
    }
    if (length === +length) {
      if (length && noaccum) {
        accumulator = collection[--length];
      }
      while (length--) {
        accumulator = callback(accumulator, collection[length], length, collection);
      }
      return accumulator;
    }

    var prop,
        props = keys(collection);

    length = props.length;
    if (length && noaccum) {
      accumulator = collection[props[--length]];
    }
    while (length--) {
      prop = props[length];
      accumulator = callback(accumulator, collection[prop], prop, collection);
    }
    return accumulator;
  }

  /**
   * The opposite of `_.filter`, this method returns the values of a `collection`
   * that `callback` does **not** return truthy for. The `callback` is invoked
   * with 3 arguments; for arrays they are (value, index, array) and for objects
   * they are (value, key, object).
   *
   * @static
   * @memberOf _
   * @category Collections
   * @param {Array|Object} collection The collection to iterate over.
   * @param {Function} callback The function called per iteration.
   * @param {Mixed} [thisArg] The `this` binding for the callback.
   * @returns {Array} Returns a new array of values that did **not** pass the callback check.
   * @example
   *
   * var odds = _.reject([1, 2, 3, 4, 5, 6], function(num) { return num % 2 == 0; });
   * // => [1, 3, 5]
   */
  var reject = createIterator(baseIteratorOptions, filterIteratorOptions, {
    'inLoop': '!' + filterIteratorOptions.inLoop
  });

  /**
   * Checks if the `callback` returns a truthy value for **any** element of a
   * `collection`. The function returns as soon as it finds passing value, and
   * does not iterate over the entire `collection`. The `callback` is invoked
   * with 3 arguments; for arrays they are (value, index, array) and for objects
   * they are (value, key, object).
   *
   * @static
   * @memberOf _
   * @alias any
   * @category Collections
   * @param {Array|Object} collection The collection to iterate over.
   * @param {Function} callback The function called per iteration.
   * @param {Mixed} [thisArg] The `this` binding for the callback.
   * @returns {Boolean} Returns `true` if any value passes the callback check, else `false`.
   * @example
   *
   * _.some([null, 0, 'yes', false]);
   * // => true
   */
  var some = createIterator(baseIteratorOptions, everyIteratorOptions, {
    'init': 'false',
    'inLoop': everyIteratorOptions.inLoop.replace('!', '')
  });

  /**
   * Converts the `collection`, into an array. Useful for converting the
   * `arguments` object.
   *
   * @static
   * @memberOf _
   * @category Collections
   * @param {Array|Object} collection The collection to convert.
   * @returns {Array} Returns the new converted array.
   * @example
   *
   * (function() { return _.toArray(arguments).slice(1); })(1, 2, 3, 4);
   * // => [2, 3, 4]
   */
  function toArray(collection) {
    if (!collection) {
      return [];
    }
    if (toString.call(collection.toArray) == funcClass) {
      return collection.toArray();
    }
    var length = collection.length;
    if (length === +length) {
      return slice.call(collection);
    }
    return values(collection);
  }

  /**
   * Produces an array of enumerable own property values of the `collection`.
   *
   * @static
   * @memberOf _
   * @alias methods
   * @category Collections
   * @param {Array|Object} collection The collection to inspect.
   * @returns {Array} Returns a new array of property values.
   * @example
   *
   * _.values({ 'one': 1, 'two': 2, 'three': 3 });
   * // => [1, 2, 3]
   */
  var values = createIterator(mapIteratorOptions, {
    'args': 'collection',
    'inLoop': {
      'array':  'result[index] = collection[index]',
      'object': 'result.push(collection[index])'
    }
  });

  /*--------------------------------------------------------------------------*/

  /**
   * Produces a new array with all falsey values of `array` removed. The values
   * `false`, `null`, `0`, `""`, `undefined` and `NaN` are all falsey.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to compact.
   * @returns {Array} Returns a new filtered array.
   * @example
   *
   * _.compact([0, 1, false, 2, '', 3]);
   * // => [1, 2, 3]
   */
  function compact(array) {
    var index = -1,
        length = array.length,
        result = [];

    while (++index < length) {
      if (array[index]) {
        result.push(array[index]);
      }
    }
    return result;
  }

  /**
   * Produces a new array of `array` values not present in the other arrays
   * using strict equality for comparisons, i.e. `===`.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to process.
   * @param {Array} [array1, array2, ...] Arrays to check.
   * @returns {Array} Returns a new array of `array` values not present in the
   *  other arrays.
   * @example
   *
   * _.difference([1, 2, 3, 4, 5], [5, 2, 10]);
   * // => [1, 3, 4]
   */
  function difference(array) {
    var index = -1,
        length = array.length,
        result = [],
        flattened = concat.apply(result, slice.call(arguments, 1));

    while (++index < length) {
      if (indexOf(flattened, array[index]) < 0) {
        result.push(array[index]);
      }
    }
    return result;
  }

  /**
   * Gets the first value of the `array`. Pass `n` to return the first `n` values
   * of the `array`.
   *
   * @static
   * @memberOf _
   * @alias head, take
   * @category Arrays
   * @param {Array} array The array to query.
   * @param {Number} [n] The number of elements to return.
   * @param {Object} [guard] Internally used to allow this method to work with
   *  others like `_.map` without using their callback `index` argument for `n`.
   * @returns {Mixed} Returns the first value or an array of the first `n` values
   *  of the `array`.
   * @example
   *
   * _.first([5, 4, 3, 2, 1]);
   * // => 5
   */
  function first(array, n, guard) {
    return (n == undefined || guard) ? array[0] : slice.call(array, 0, n);
  }

  /**
   * Flattens a nested array (the nesting can be to any depth). If `shallow` is
   * truthy, `array` will only be flattened a single level.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to compact.
   * @param {Boolean} shallow A flag to indicate only flattening a single level.
   * @returns {Array} Returns a new flattened array.
   * @example
   *
   * _.flatten([1, [2], [3, [[4]]]]);
   * // => [1, 2, 3, 4];
   *
   * _.flatten([1, [2], [3, [[4]]]], true);
   * // => [1, 2, 3, [[4]]];
   */
  function flatten(array, shallow) {
    var value,
        index = -1,
        length = array.length,
        result = [];

    while (++index < length) {
      value = array[index];
      if (isArray(value)) {
        push.apply(result, shallow ? value : flatten(value));
      } else {
        result.push(value);
      }
    }
    return result;
  }

  /**
   * Splits a `collection` into sets, grouped by the result of running each value
   * through `callback`. The `callback` is invoked with 3 arguments;
   * (value, index, array). The `callback` argument may also be the name of a
   * property to group by.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to iterate over.
   * @param {Function|String} callback The function called per iteration or
   *  property name to group by.
   * @param {Mixed} [thisArg] The `this` binding for the callback.
   * @returns {Object} Returns an object of grouped values.
   * @example
   *
   * _.groupBy([1.3, 2.1, 2.4], function(num) { return Math.floor(num); });
   * // => { '1': [1.3], '2': [2.1, 2.4] }
   *
   * _.groupBy([1.3, 2.1, 2.4], function(num) { return this.floor(num); }, Math);
   * // => { '1': [1.3], '2': [2.1, 2.4] }
   *
   * _.groupBy(['one', 'two', 'three'], 'length');
   * // => { '3': ['one', 'two'], '5': ['three'] }
   */
  function groupBy(array, callback, thisArg) {
    var prop,
        value,
        index = -1,
        isFunc = toString.call(callback) == funcClass,
        length = array.length,
        result = {};

    if (isFunc && thisArg) {
      callback = bind(callback, thisArg);
    }
    while (++index < length) {
      value = array[index];
      prop = isFunc ? callback(value, index, array) : value[callback];
      (hasOwnProperty.call(result, prop) ? result[prop] : result[prop] = []).push(value);
    }
    return result
  }

  /**
   * Produces a new sorted array, ranked in ascending order by the results of
   * running each value of a `collection` through `callback`. The `callback` is
   * invoked with 3 arguments; for arrays they are (value, index, array) and for
   * objects they are (value, key, object). The `callback` argument may also be
   * the name of a property to sort by (e.g. 'length').
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to iterate over.
   * @param {Function|String} callback The function called per iteration or
   *  property name to sort by.
   * @param {Mixed} [thisArg] The `this` binding for the callback.
   * @returns {Array} Returns a new array of sorted values.
   * @example
   *
   * _.sortBy([1, 2, 3, 4, 5, 6], function(num) { return Math.sin(num); });
   * // => [5, 4, 6, 3, 1, 2]
   *
   * _.sortBy([1, 2, 3, 4, 5, 6], function(num) { return this.sin(num); }, Math);
   * // => [5, 4, 6, 3, 1, 2]
   */
  function sortBy(array, callback, thisArg) {
    if (toString.call(callback) != funcClass) {
      var prop = callback;
      callback = function(array) { return array[prop]; };
    } else if (thisArg) {
      callback = bind(callback, thisArg);
    }
    return pluck(map(array, function(value, index) {
      return {
        'criteria': callback(value, index, array),
        'value': value
      };
    }).sort(function(left, right) {
      var a = left.criteria,
          b = right.criteria;

      if (a === undefined) {
        return 1;
      }
      if (b === undefined) {
        return -1;
      }
      return a < b ? -1 : a > b ? 1 : 0;
    }), 'value');
  }

  /**
   * Gets the index at which the first occurrence of `value` is found using
   * strict equality for comparisons, i.e. `===`. If the `array` is already
   * sorted, passing `true` for `isSorted` will run a faster binary search.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to search.
   * @param {Mixed} value The value to search for.
   * @param {Boolean} [isSorted=false] A flag to indicate that the `array` is already sorted.
   * @returns {Number} Returns the index of the matched value or `-1`.
   * @example
   *
   * _.indexOf([1, 2, 3], 2);
   * // => 1
   */
  function indexOf(array, value, isSorted) {
    var index, length;
    if (!array) {
      return -1;
    }
    if (isSorted) {
      index = sortedIndex(array, value);
      return array[index] === value ? index : -1;
    }
    for (index = 0, length = array.length; index < length; index++) {
      if (array[index] === value) {
        return index;
      }
    }
    return -1;
  }

  /**
   * Gets all but the last value of the `array`. Pass `n` to exclude the last `n`
   * values from the result.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to query.
   * @param {Number} [n] The number of elements to return.
   * @param {Object} [guard] Internally used to allow this method to work with
   *  others like `_.map` without using their callback `index` argument for `n`.
   * @returns {Array} Returns all but the last value or `n` values of the `array`.
   * @example
   *
   * _.initial([5, 4, 3, 2, 1]);
   * // => [5, 4, 3, 2]
   */
  function initial(array, n, guard) {
    return slice.call(array, 0, -((n == undefined || guard) ? 1 : n));
  }

  /**
   * Computes the intersection of all the passed-in arrays.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} [array1, array2, ...] Arrays to process.
   * @returns {Array} Returns a new array of unique values, in order, that are
   *  present in **all** of the arrays.
   * @example
   *
   * _.intersection([1, 2, 3], [101, 2, 1, 10], [2, 1]);
   * // => [1, 2]
   */
  function intersection(array) {
    var value,
        index = -1,
        length = array.length,
        others = slice.call(arguments, 1),
        result = [];

    while (++index < length) {
      value = array[index];
      if (indexOf(result, value) < 0 &&
          every(others, function(other) { return indexOf(other, value) > -1; })) {
        result.push(value);
      }
    }
    return result;
  }

  /**
   * Calls the method named by `methodName` for each value of the `collection`.
   * Additional arguments will be passed to each invoked method.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to iterate over.
   * @param {String} methodName The name of the method to invoke.
   * @param {Mixed} [arg1, arg2, ...] Arguments to invoke the method with.
   * @returns {Array} Returns a new array of values returned from each invoked method.
   * @example
   *
   * _.invoke([[5, 1, 7], [3, 2, 1]], 'sort');
   * // => [[1, 5, 7], [1, 2, 3]]
   */
  function invoke(array, methodName) {
    var args = slice.call(arguments, 2),
        index = -1,
        length = array.length,
        isFunc = toString.call(methodName) == funcClass,
        result = [];

    while (++index < length) {
      result[index] = (isFunc ? methodName : array[index][methodName]).apply(array[index], args);
    }
    return result;
  }

  /**
   * Gets the last value of the `array`. Pass `n` to return the lasy `n` values
   * of the `array`.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to query.
   * @param {Number} [n] The number of elements to return.
   * @param {Object} [guard] Internally used to allow this method to work with
   *  others like `_.map` without using their callback `index` argument for `n`.
   * @returns {Array} Returns all but the last value or `n` values of the `array`.
   * @example
   *
   * _.last([5, 4, 3, 2, 1]);
   * // => 1
   */
  function last(array, n, guard) {
    var length = array.length;
    return (n == undefined || guard) ? array[length - 1] : slice.call(array, -n || length);
  }

  /**
   * Gets the index at which the last occurrence of `value` is found using
   * strict equality for comparisons, i.e. `===`.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to search.
   * @param {Mixed} value The value to search for.
   * @returns {Number} Returns the index of the matched value or `-1`.
   * @example
   *
   * _.lastIndexOf([1, 2, 3, 1, 2, 3], 2);
   * // => 4
   */
  function lastIndexOf(array, value) {
    if (!array) {
      return -1;
    }
    var index = array.length;
    while (index--) {
      if (array[index] === value) {
        return index;
      }
    }
    return -1;
  }

  /**
   * Retrieves the maximum value of an `array`. If `callback` is passed,
   * it will be executed for each value in the `array` to generate the
   * criterion by which the value is ranked. The `callback` is invoked with 3
   * arguments; (value, index, array).
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to iterate over.
   * @param {Function} [callback] The function called per iteration.
   * @param {Mixed} [thisArg] The `this` binding for the callback.
   * @returns {Mixed} Returns the maximum value.
   * @example
   *
   * var stooges = [
   *   { 'name': 'moe', 'age': 40 },
   *   { 'name': 'larry', 'age': 50 },
   *   { 'name': 'curly', 'age': 60 }
   * ];
   *
   * _.max(stooges, function(stooge) { return stooge.age; });
   * // => { 'name': 'curly', 'age': 60 };
   */
  function max(array, callback, thisArg) {
    var current,
        computed = -Infinity,
        index = -1,
        length = array.length,
        result = computed;

    if (!callback) {
      while (++index < length) {
        if (array[index] > result) {
          result = array[index];
        }
      }
      return result;
    }
    if (thisArg) {
      callback = bind(callback, thisArg);
    }
    while (++index < length) {
      current = callback(array[index], index, array);
      if (current > computed) {
        computed = current;
        result = array[index];
      }
    }
    return result;
  }

  /**
   * Retrieves the minimum value of an `array`. If `callback` is passed,
   * it will be executed for each value in the `array` to generate the
   * criterion by which the value is ranked. The `callback` is invoked with 3
   * arguments; (value, index, array).
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to iterate over.
   * @param {Function} [callback] The function called per iteration.
   * @param {Mixed} [thisArg] The `this` binding for the callback.
   * @returns {Mixed} Returns the minimum value.
   * @example
   *
   * _.min([10, 5, 100, 2, 1000]);
   * // => 2
   */
  function min(array, callback, thisArg) {
    var current,
        computed = Infinity,
        index = -1,
        length = array.length,
        result = computed;

    if (!callback) {
      while (++index < length) {
        if (array[index] < result) {
          result = array[index];
        }
      }
      return result;
    }
    if (thisArg) {
      callback = bind(callback, thisArg);
    }
    while (++index < length) {
      current = callback(array[index], index, array);
      if (current < computed) {
        computed = current;
        result = array[index];
      }
    }
    return result;
  }

  /**
   * Creates an array of numbers (positive and/or negative) progressing from
   * `start` up to but not including `stop`. This method is a port of Python's
   * `range()` function. See http://docs.python.org/library/functions.html#range.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Number} [start=0] The start of the range.
   * @param {Number} end The end of the range.
   * @param {Number} [step=1] The value to increment or descrement by.
   * @returns {Array} Returns a new range array.
   * @example
   *
   * _.range(10);
   * // => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
   *
   * _.range(1, 11);
   * // => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
   *
   * _.range(0, 30, 5);
   * // => [0, 5, 10, 15, 20, 25]
   *
   * _.range(0, -10, -1);
   * // => [0, -1, -2, -3, -4, -5, -6, -7, -8, -9]
   *
   * _.range(0);
   * // => []
   */
  function range(start, end, step) {
    step || (step = 1);
    if (arguments.length < 2) {
      end = start || 0;
      start = 0;
    }

    var index = -1,
        length = Math.max(Math.ceil((end - start) / step), 0),
        result = Array(length);

    while (++index < length) {
      result[index] = start;
      start += step;
    }
    return result;
  }

  /**
   * The opposite of `_.initial`, this method gets all but the first value of
   * the `array`. Pass `n` to exclude the first `n` values from the result.
   *
   * @static
   * @memberOf _
   * @alias tail
   * @category Arrays
   * @param {Array} array The array to query.
   * @param {Number} [n] The number of elements to return.
   * @param {Object} [guard] Internally used to allow this method to work with
   *  others like `_.map` without using their callback `index` argument for `n`.
   * @returns {Array} Returns all but the first value or `n` values of the `array`.
   * @example
   *
   * _.rest([5, 4, 3, 2, 1]);
   * // => [4, 3, 2, 1]
   */
  function rest(array, n, guard) {
    return slice.call(array, (n == undefined || guard) ? 1 : n);
  }

  /**
   * Produces a new array of shuffled `array` values, using a version of the
   * Fisher-Yates shuffle. See http://en.wikipedia.org/wiki/Fisher-Yates_shuffle.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to shuffle.
   * @returns {Array} Returns a new shuffled array.
   * @example
   *
   * _.shuffle([1, 2, 3, 4, 5, 6]);
   * // => [4, 1, 6, 3, 5, 2]
   */
  function shuffle(array) {
    var rand,
        index = -1,
        length = array.length,
        result = Array(length);

    while (++index < length) {
      rand = Math.floor(Math.random() * (index + 1));
      result[index] = result[rand];
      result[rand] = array[index];
    }
    return result;
  }

  /**
   * Uses a binary search to determine the smallest  index at which the `value`
   * should be inserted into the `collection` in order to maintain the sort order
   * of the `collection`. If `callback` is passed, it will be executed for each
   * value in the `collection` to compute their sort ranking. The `callback` is
   * invoked with 1 argument; (value).
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to iterate over.
   * @param {Mixed} value The value to evaluate.
   * @param {Function} [callback] The function called per iteration.
   * @returns {Number} Returns the index at which the value should be inserted
   *  into the collection.
   * @example
   *
   * _.sortedIndex([10, 20, 30, 40, 50], 35);
   * // => 3
   */
  function sortedIndex(array, value, callback) {
    var mid,
        low = 0,
        high = array.length;

    if (callback) {
      value = callback(value);
    }
    while (low < high) {
      mid = (low + high) >> 1;
      if ((callback ? callback(array[mid]) : array[mid]) < value) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return low;
  }

  /**
   * Computes the union of the passed-in arrays.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} [array1, array2, ...] Arrays to process.
   * @returns {Array} Returns a new array of unique values, in order, that are
   *  present in one or more of the arrays.
   * @example
   *
   * _.union([1, 2, 3], [101, 2, 1, 10], [2, 1]);
   * // => [1, 2, 3, 101, 10]
   */
  function union() {
    var index = -1,
        result = [],
        flattened = concat.apply(result, arguments),
        length = flattened.length;

    while (++index < length) {
      if (indexOf(result, flattened[index]) < 0) {
        result.push(flattened[index]);
      }
    }
    return result;
  }

  /**
   * Produces a duplicate-value-free version of the `array` using strict equality
   * for comparisons, i.e. `===`. If the `array` is already sorted, passing `true`
   * for `isSorted` will run a faster algorithm. If `callback` is passed,
   * each value of `array` is passed through a transformation `callback` before
   * uniqueness is computed. The `callback` is invoked with 3 arguments;
   * (value, index, array).
   *
   * @static
   * @memberOf _
   * @alias unique
   * @category Arrays
   * @param {Array} array The array to process.
   * @param {Boolean} [isSorted=false] A flag to indicate that the `array` is already sorted.
   * @param {Function} [callback] A
   * @returns {Array} Returns a duplicate-value-free array.
   * @example
   *
   * _.uniq([1, 2, 1, 3, 1, 4]);
   * // => [1, 2, 3, 4]
   */
  function uniq(array, isSorted, callback) {
    var computed,
        index = -1,
        length = array.length,
        result = [],
        seen = [];

    while (++index < length) {
      computed = callback ? callback(array[index]) : array[index];
      if (isSorted
            ? !index || seen[seen.length - 1] !== computed
            : indexOf(seen, computed) < 0
          ) {
        seen.push(computed);
        result.push(array[index]);
      }
    }
    return result;
  }

  /**
   * Produces a new array with all occurrences of the passed values removed using
   * strict equality for comparisons, i.e. `===`.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} array The array to filter.
   * @param {Mixed} [value1, value2, ...] Values to remove.
   * @returns {Array} Returns a new filtered array.
   * @example
   *
   * _.without([1, 2, 1, 0, 3, 1, 4], 0, 1);
   * // => [2, 3, 4]
   */
  function without(array) {
    var excluded = slice.call(arguments, 1),
        index = -1,
        length = array.length,
        result = [];

    while (++index < length) {
      if (indexOf(excluded, array[index]) < 0) {
        result.push(array[index]);
      }
    }
    return result;
  }

  /**
   * Merges together the values of each of the arrays with the value at the
   * corresponding position. Useful for separate data sources that are coordinated
   * through matching array indexes. For a matrix of nested arrays, `_.zip.apply(...)`
   * can transpose the matrix in a similar fashion.
   *
   * @static
   * @memberOf _
   * @category Arrays
   * @param {Array} [array1, array2, ...] Arrays to process.
   * @returns {Array} Returns a new array of merged arrays.
   * @example
   *
   * _.zip(['moe', 'larry', 'curly'], [30, 40, 50], [true, false, false]);
   * // => [['moe', 30, true], ['larry', 40, false], ['curly', 50, false]]
   */
  function zip() {
    var index = -1,
        length = max(pluck(arguments, 'length')),
        result = Array(length);

    while (++index < length) {
      result[index] = pluck(arguments, index);
    }
    return result;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Creates a new function that is restricted to executing only after it is
   * called `n` times.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Number} n The number of times the function must be called before
   * it is executed.
   * @param {Function} func The function to restrict.
   * @returns {Function} Returns the new restricted function.
   * @example
   *
   * var renderNotes = _.after(notes.length, render);
   * _.forEach(notes, function(note) {
   *   note.asyncSave({ 'success': renderNotes });
   * });
   * // renderNotes is run once, after all notes have saved.
   */
  function after(n, func) {
    if (n < 1) {
      return func();
    }
    return function() {
      if (--n < 1) {
        return func.apply(this, arguments);
      }
    };
  }

  /**
   * Creates a new function that, when called, invokes `func` with the `this`
   * binding of `thisArg` and prepends any additional `bind` arguments to those
   * passed to the bound function. Lazy defined methods may be bound by passing
   * the object they are bound to as `func` and the method name as `thisArg`.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function|Object} func The function to bind or the object the method belongs to.
   * @param @param {Mixed} [thisArg] The `this` binding of `func` or the method name.
   * @param {Mixed} [arg1, arg2, ...] Arguments to be partially applied.
   * @returns {Function} Returns the new bound function.
   * @example
   *
   * // basic bind
   * var func = function(greeting) { return greeting + ': ' + this.name; };
   * func = _.bind(func, { 'name': 'moe' }, 'hi');
   * func();
   * // => 'hi: moe'
   *
   * // lazy bind
   * var object = {
   *   'name': 'moe',
   *   'greet': function(greeting) {
   *     return greeting + ': ' + this.name;
   *   }
   * };
   *
   * var func = _.bind(object, 'greet', 'hi');
   * func();
   * // => 'hi: moe'
   *
   * object.greet = function(greeting) {
   *   return greeting + ' ' + this.name + '!';
   * };
   *
   * func();
   * // => 'hi moe!'
   */
  function bind(func, thisArg) {
    var methodName,
        isFunc = toString.call(func) == funcClass;

    // juggle arguments
    if (!isFunc) {
      methodName = thisArg;
      thisArg = func;
    }
    // use if `Function#bind` is faster
    else if (nativeBind) {
      return nativeBind.call.apply(nativeBind, arguments);
    }

    var partialArgs = slice.call(arguments, 2);

    function bound() {
      // `Function#bind` spec
      // http://es5.github.com/#x15.3.4.5
      var args = arguments,
          thisBinding = thisArg;

      if (!isFunc) {
        func = thisArg[methodName];
      }
      if (partialArgs.length) {
        args = args.length
          ? concat.apply(partialArgs, args)
          : partialArgs;
      }
      if (this instanceof bound) {
        // get `func` instance if `bound` is invoked in a `new` expression
        noop.prototype = func.prototype;
        thisBinding = new noop;

        // mimic the constructor's `return` behavior
        // http://es5.github.com/#x13.2.2
        var result = func.apply(thisBinding, args);
        return objectTypes[typeof result] && result !== null
          ? result
          : thisBinding
      }
      return func.apply(thisBinding, args);
    }

    return bound;
  }

  /**
   * Binds methods on the `object` to the object, overwriting the non-bound method.
   * If no method names are provided, all the function properties of the `object`
   * will be bound.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Object} object The object to bind and assign the bound methods to.
   * @param {String} [methodName1, methodName2, ...] Method names on the object to bind.
   * @returns {Object} Returns the `object`.
   * @example
   *
   * var buttonView = {
   *  'label': 'lodash',
   *  'onClick': function() { alert('clicked: ' + this.label); },
   *  'onHover': function() { console.log('hovering: ' + this.label); }
   * };
   *
   * _.bindAll(buttonView);
   * jQuery('#lodash_button').on('click', buttonView.onClick);
   * // => When the button is clicked, `this.label` will have the correct value
   */
  function bindAll(object) {
    var funcs = arguments,
        index = 1;

    if (funcs.length == 1) {
      index = 0;
      funcs = functions(object);
    }
    for (var length = funcs.length; index < length; index++) {
      object[funcs[index]] = bind(object[funcs[index]], object);
    }
    return object;
  }

  /**
   * Creates a new function that is the composition of the passed functions,
   * where each function consumes the return value of the function that follows.
   * In math terms, composing thefunctions `f()`, `g()`, and `h()` produces `f(g(h()))`.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function} [func1, func2, ...] Functions to compose.
   * @returns {Function} Returns the new composed function.
   * @example
   *
   * var greet = function(name) { return 'hi: ' + name; };
   * var exclaim = function(statement) { return statement + '!'; };
   * var welcome = _.compose(exclaim, greet);
   * welcome('moe');
   * // => 'hi: moe!'
   */
  function compose() {
    var funcs = arguments;
    return function() {
      var args = arguments,
          length = funcs.length;

      while (length--) {
        args = [funcs[length].apply(this, args)];
      }
      return args[0];
    };
  }

  /**
   * Creates a new function that will delay the execution of `func` until after
   * `wait` milliseconds have elapsed since the last time it was invoked. Pass
   * `true` for `immediate` to cause debounce to invoke `func` on the leading,
   * instead of the trailing, edge of the `wait` timeout. Subsequent calls to
   * the debounced function will return the result of the last `func` call.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function} func The function to debounce.
   * @param {Number} wait The number of milliseconds to delay.
   * @param {Boolean} immediate A flag to indicate execution is on the leading
   *  edge of the timeout.
   * @returns {Function} Returns the new debounced function.
   * @example
   *
   * var lazyLayout = _.debounce(calculateLayout, 300);
   * jQuery(window).on('resize', lazyLayout);
   */
  function debounce(func, wait, immediate) {
    var args,
        result,
        thisArg,
        timeoutId;

    function delayed() {
      timeoutId = undefined;
      if (!immediate) {
        func.apply(thisArg, args);
      }
    }

    return function() {
      var isImmediate = immediate && !timeoutId;
      args = arguments;
      thisArg = this;

      clearTimeout(timeoutId);
      timeoutId = setTimeout(delayed, wait);

      if (isImmediate) {
        result = func.apply(thisArg, args);
      }
      return result;
    };
  }

  /**
   * Executes the `func` function after `wait` milliseconds. Additional arguments
   * are passed to `func` when it is invoked.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function} func The function to delay.
   * @param {Number} wait The number of milliseconds to delay execution.
   * @param {Mixed} [arg1, arg2, ...] Arguments to invoke the function with.
   * @returns {Number} Returns the `setTimeout` timeout id.
   * @example
   *
   * var log = _.bind(console.log, console);
   * _.delay(log, 1000, 'logged later');
   * // => 'logged later' (Appears after one second.)
   */
  function delay(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function() { return func.apply(undefined, args); }, wait);
  }

  /**
   * Defers executing the `func` function until the current call stack has cleared.
   * Additional arguments are passed to `func` when it is invoked.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function} func The function to defer.
   * @param {Mixed} [arg1, arg2, ...] Arguments to invoke the function with.
   * @returns {Number} Returns the `setTimeout` timeout id.
   * @example
   *
   * _.defer(function() { alert('deferred'); });
   * // Returns from the function before the alert runs.
   */
  function defer(func) {
    var args = slice.call(arguments, 1);
    return setTimeout(function() { return func.apply(undefined, args); }, 1);
  }

  /**
   * Creates a new function that memoizes the result of `func`. If `resolver` is
   * passed, it will be used to determine the cache key for storing the result
   * based on the arguments passed to the memoized function. By default, the first
   * argument passed to the memoized function is used as the cache key.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function} func The function to have its output memoized.
   * @param {Function} [resolver] A function used to resolve the cache key.
   * @returns {Function} Returns the new memoizing function.
   * @example
   *
   * var fibonacci = _.memoize(function(n) {
   *   return n < 2 ? n : fibonacci(n - 1) + fibonacci(n - 2);
   * });
   */
  function memoize(func, resolver) {
    var cache = {};
    return function() {
      var prop = resolver ? resolver.apply(this, arguments) : arguments[0];
      return hasOwnProperty.call(cache, prop)
        ? cache[prop]
        : (cache[prop] = func.apply(this, arguments));
    };
  }

  /**
   * Creates a new function that is restricted to one execution. Repeat calls to
   * the function will return the value of the first call.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function} func The function to restrict.
   * @returns {Function} Returns the new restricted function.
   * @example
   *
   * var initialize = _.once(createApplication);
   * initialize();
   * initialize();
   * // Application is only created once.
   */
  function once(func) {
    var result,
        ran = false;

    return function() {
      if (ran) {
        return result;
      }
      ran = true;
      result = func.apply(this, arguments);
      return result;
    };
  }

  /**
   * Creates a new function that, when called, invokes `func` with any additional
   * `partial` arguments prepended to those passed to the partially applied
   * function. This method is similar `bind`, except it does **not** alter the
   * `this` binding.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function} func The function to partially apply arguments to.
   * @param {Mixed} [arg1, arg2, ...] Arguments to be partially applied.
   * @returns {Function} Returns the new partially applied function.
   * @example
   *
   * var greet = function(greeting, name) { return greeting + ': ' + name; };
   * var hi = _.partial(greet, 'hi');
   * hi('moe');
   * // => 'hi: moe'
   */
  function partial(func) {
    var args = slice.call(arguments, 1),
        argsLength = args.length;

    return function() {
      var result,
          others = arguments;

      if (others.length) {
        args.length = argsLength;
        push.apply(args, others);
      }
      result = args.length == 1 ? func.call(this, args[0]) : func.apply(this, args);
      args.length = argsLength;
      return result;
    };
  }

  /**
   * Creates a new function that, when executed, will only call the `func`
   * function at most once per every `wait` milliseconds. If the throttled function
   * is invoked more than once, `func` will also be called on the trailing edge
   * of the `wait` timeout. Subsequent calls to the throttled function will
   * return the result of the last `func` call.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function} func The function to throttle.
   * @param {Number} wait The number of milliseconds to throttle executions to.
   * @returns {Function} Returns the new throttled function.
   * @example
   *
   * var throttled = _.throttle(updatePosition, 100);
   * jQuery(window).on('scroll', throttled);
   */
  function throttle(func, wait) {
    var args,
        result,
        thisArg,
        timeoutId,
        lastCalled = 0;

    function trailingCall() {
      lastCalled = new Date;
      timeoutId = undefined;
      func.apply(thisArg, args);
    }

    return function() {
      var now = new Date,
          remain = wait - (now - lastCalled);

      args = arguments;
      thisArg = this;

      if (remain <= 0) {
        lastCalled = now;
        result = func.apply(thisArg, args);
      }
      else if (!timeoutId) {
        timeoutId = setTimeout(trailingCall, remain);
      }
      return result;
    };
  }

  /**
   * Create a new function that passes the `func` function to the `wrapper`
   * function as its first argument. Additional arguments are appended to those
   * passed to the `wrapper` function.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function} func The function to wrap.
   * @param {Function} wrapper The wrapper function.
   * @param {Mixed} [arg1, arg2, ...] Arguments to append to those passed to the wrapper.
   * @returns {Function} Returns the new function.
   * @example
   *
   * var hello = function(name) { return 'hello: ' + name; };
   * hello = _.wrap(hello, function(func) {
   *   return 'before, ' + func('moe') + ', after';
   * });
   * hello();
   * // => 'before, hello: moe, after'
   */
  function wrap(func, wrapper) {
    return function() {
      var args = [func];
      if (arguments.length) {
        push.apply(args, arguments);
      }
      return wrapper.apply(this, args);
    };
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Create a shallow clone of the `value`. Any nested objects or arrays will be
   * assigned by reference and not cloned.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to clone.
   * @returns {Mixed} Returns the cloned `value`.
   * @example
   *
   * _.clone({ 'name': 'moe' });
   * // => { 'name': 'moe' };
   */
  function clone(value) {
    return objectTypes[typeof value] && value !== null
      ? (isArray(value) ? value.slice() : extend({}, value))
      : value;
  }

  /**
   * Assigns missing properties in `object` with default values from the defaults
   * objects. As soon as a property is set, additional defaults of the same
   * property will be ignored.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Object} object The object to populate.
   * @param {Object} [defaults1, defaults2, ...] The defaults objects to apply to `object`.
   * @returns {Object} Returns `object`.
   * @example
   *
   * var iceCream = { 'flavor': 'chocolate' };
   * _.defaults(iceCream, { 'flavor': 'vanilla', 'sprinkles': 'lots' });
   * // => { 'flavor': 'chocolate', 'sprinkles': 'lots' }
   */
  var defaults = createIterator(extendIteratorOptions, {
    'inLoop': 'if (object[index] == undefined)' + extendIteratorOptions.inLoop
  });

  /**
   * Copies enumerable properties from the source objects to the `destination` object.
   * Subsequent sources will overwrite propery assignments of previous sources.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Object} object The destination object.
   * @param {Object} [source1, source2, ...] The source objects.
   * @returns {Object} Returns the destination object.
   * @example
   *
   * _.extend({ 'name': 'moe' }, { 'age': 40 });
   * // => { 'name': 'moe', 'age': 40 }
   */
  var extend = createIterator(extendIteratorOptions);

  /**
   * Produces a sorted array of the properties, own and inherited, of `object`
   * that have function values.
   *
   * @static
   * @memberOf _
   * @alias methods
   * @category Objects
   * @param {Object} object The object to inspect.
   * @returns {Array} Returns a new array of property names that have function values.
   * @example
   *
   * _.functions(_);
   * // => ['all', 'any', 'bind', 'bindAll', 'clone', 'compact', 'compose', ...]
   */
  var functions = createIterator({
    'args': 'object',
    'init': '[]',
    'useHas': false,
    'inLoop': 'if (toString.call(object[index]) == funcClass) result.push(index)',
    'bottom': 'result.sort()'
  });

  /**
   * Checks if the specified object `property` exists and is a direct property,
   * instead of an inherited property.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Object} object The object to check.
   * @param {String} property The property to check for.
   * @returns {Boolean} Returns `true` if key is a direct property, else `false`.
   * @example
   *
   * _.has({ 'a': 1, 'b': 2, 'c': 3 }, 'b');
   * // => true
   */
  function has(object, property) {
    return hasOwnProperty.call(object, property);
  }

  /**
   * Checks if a `value` is an `arguments` object.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the `value` is an `arguments` object, else `false`.
   * @example
   *
   * (function() { return _.isArguments(arguments); })(1, 2, 3);
   * // => true
   *
   * _.isArguments([1, 2, 3]);
   * // => false
   */
  var isArguments = function(value) {
    return toString.call(value) == '[object Arguments]';
  };
  // fallback for browser like IE<9 which detect `arguments` as `[object Object]`
  if (!isArguments(arguments)) {
    isArguments = function(value) {
      return !!(value && hasOwnProperty.call(value, 'callee'));
    };
  }

  /**
   * Checks if a `value` is an array.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the `value` is an array, else `false`.
   * @example
   *
   * (function() { return _.isArray(arguments); })();
   * // => false
   *
   * _.isArray([1, 2, 3]);
   * // => true
   */
  var isArray = nativeIsArray || function(value) {
    return toString.call(value) == arrayClass;
  };

  /**
   * Checks if a `value` is a boolean (`true` or `false`) value.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the `value` is a boolean value, else `false`.
   * @example
   *
   * _.isBoolean(null);
   * // => false
   */
  function isBoolean(value) {
    return value === true || value === false || toString.call(value) == boolClass;
  }

  /**
   * Checks if a `value` is a date.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the `value` is a date, else `false`.
   * @example
   *
   * _.isDate(new Date);
   * // => true
   */
  function isDate(value) {
    return toString.call(value) == dateClass;
  }

  /**
   * Checks if a `value` is a DOM element.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the `value` is a DOM element, else `false`.
   * @example
   *
   * _.isElement(document.body);
   * // => true
   */
  function isElement(value) {
    return !!(value && value.nodeType == 1);
  }

  /**
   * Checks if a `value` is empty. Arrays or strings with a length of `0` and
   * objects with no enumerable own properties are considered "empty".
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Array|Object|String} value The value to inspect.
   * @returns {Boolean} Returns `true` if the `value` is empty, else `false`.
   * @example
   *
   * _.isEmpty([1, 2, 3]);
   * // => false
   *
   * _.isEmpty({});
   * // => true
   */
  var isEmpty = createIterator({
    'args': 'value',
    'init': 'true',
    'top':
      'var className = toString.call(value);\n' +
      'if (className == arrayClass || className == stringClass) return !value.length',
    'inLoop': {
      'object': 'return false'
    }
  });

  /**
   * Performs a deep comparison between two values to determine if they are
   * equivalent to each other.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} a The value to compare.
   * @param {Mixed} b The other value to compare.
   * @param {Array} [stack] Internally used to keep track of "seen" objects to
   *  avoid circular references.
   * @returns {Boolean} Returns `true` if the values are equvalent, else `false`.
   * @example
   *
   * var moe = { 'name': 'moe', 'luckyNumbers': [13, 27, 34] };
   * var clone = { 'name': 'moe', 'luckyNumbers': [13, 27, 34] };
   *
   * moe == clone;
   * // => false
   *
   * _.isEqual(moe, clone);
   * // => true
   */
  function isEqual(a, b, stack) {
    stack || (stack = []);

    // exit early for identical values
    if (a === b) {
      // treat `+0` vs. `-0` as not equal
      return a !== 0 || (1 / a == 1 / b);
    }
    // a strict comparison is necessary because `null == undefined`
    if (a == undefined || b == undefined) {
      return a === b;
    }
    // unwrap any wrapped objects
    if (a._chain) {
      a = a._wrapped;
    }
    if (b._chain) {
      b = b._wrapped;
    }
    // invoke a custom `isEqual` method if one is provided
    if (a.isEqual && toString.call(a.isEqual) == funcClass) {
      return a.isEqual(b);
    }
    if (b.isEqual && toString.call(b.isEqual) == funcClass) {
      return b.isEqual(a);
    }
    // compare [[Class]] names
    var className = toString.call(a);
    if (className != toString.call(b)) {
      return false;
    }
    switch (className) {
      // strings, numbers, dates, and booleans are compared by value
      case stringClass:
        // primitives and their corresponding object instances are equivalent;
        // thus, `'5'` is quivalent to `new String('5')`
        return a == String(b);

      case numberClass:
        // treat `NaN` vs. `NaN` as equal
        return a != +a
          ? b != +b
          // but treat `+0` vs. `-0` as not equal
          : (a == 0 ? (1 / a == 1 / b) : a == +b);

      case boolClass:
      case dateClass:
        // coerce dates and booleans to numeric values, dates to milliseconds and booleans to 1 or 0;
        // treat invalid dates coerced to `NaN` as not equal
        return +a == +b;

      // regexps are compared by their source and flags
      case regexpClass:
        return a.source == b.source &&
               a.global == b.global &&
               a.multiline == b.multiline &&
               a.ignoreCase == b.ignoreCase;
    }
    if (typeof a != 'object' || typeof b != 'object') {
      return false;
    }
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
    var length = stack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (stack[length] == a) {
        return true;
      }
    }

    var index = -1,
        result = true,
        size = 0;

    // add the first collection to the stack of traversed objects
    stack.push(a);

    // recursively compare objects and arrays
    if (className == arrayClass) {
      // compare array lengths to determine if a deep comparison is necessary
      size = a.length;
      result = size == b.length;

      if (result) {
        // deep compare the contents, ignoring non-numeric properties
        while (size--) {
          if (!(result = isEqual(a[size], b[size], stack))) {
            break;
          }
        }
      }
    } else {
      // objects with different constructors are not equivalent
      if ('constructor' in a != 'constructor' in b || a.constructor != b.constructor) {
        return false;
      }
      // deep compare objects.
      for (var prop in a) {
        if (hasOwnProperty.call(a, prop)) {
          // count the number of properties.
          size++;
          // deep compare each property value.
          if (!(result = hasOwnProperty.call(b, prop) && isEqual(a[prop], b[prop], stack))) {
            break;
          }
        }
      }
      // ensure both objects have the same number of properties
      if (result) {
        for (prop in b) {
          if (hasOwnProperty.call(b, prop) && !(size--)) break;
        }
        result = !size;
      }
      // handle JScript [[DontEnum]] bug
      if (result && hasDontEnumBug) {
        while (++index < 7) {
          prop = shadowed[index];
          if (hasOwnProperty.call(a, prop)) {
            if (!(result = hasOwnProperty.call(b, prop) && isEqual(a[prop], b[prop], stack))) {
              break;
            }
          }
        }
      }
    }
    // remove the first collection from the stack of traversed objects
    stack.pop();
    return result;
  }

  /**
   * Checks if a `value` is a finite number.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the `value` is a finite number, else `false`.
   * @example
   *
   * _.isFinite(-101);
   * // => true
   *
   * _.isFinite('10');
   * // => false
   *
   * _.isFinite(Infinity);
   * // => false
   */
  function isFinite(value) {
    return nativeIsFinite(value) && toString.call(value) == numberClass;
  }

  /**
   * Checks if a `value` is a function.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the `value` is a function, else `false`.
   * @example
   *
   * _.isFunction(''.concat);
   * // => true
   */
  function isFunction(value) {
    return toString.call(value) == funcClass;
  }

  /**
   * Checks if a `value` is the language type of Object.
   * (e.g. arrays, functions, objects, regexps, `new Number(0)`, and `new String('')`)
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the `value` is an object, else `false`.
   * @example
   *
   * _.isObject({});
   * // => true
   *
   * _.isObject(1);
   * // => false
   */
  function isObject(value) {
    // check if the value is the ECMAScript language type of Object
    // http://es5.github.com/#x8
    return objectTypes[typeof value] && value !== null;
  }

  /**
   * Checks if a `value` is `NaN`.
   * Note: this is not the same as native `isNaN`, which will return true for
   * `undefined` and other values. See http://es5.github.com/#x15.1.2.4.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the `value` is `NaN`, else `false`.
   * @example
   *
   * _.isNaN(NaN);
   * // => true
   *
   * _.isNaN(new Number(NaN));
   * // => true
   *
   * isNaN(undefined);
   * // => true
   *
   * _.isNaN(undefined);
   * // => false
   */
  function isNaN(value) {
    // `NaN` as a primitive is the only value that is not equal to itself
    // (perform the [[Class]] check first to avoid errors with some host objects in IE)
    return toString.call(value) == numberClass && value != +value
  }

  /**
   * Checks if a `value` is `null`.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the `value` is `null`, else `false`.
   * @example
   *
   * _.isNull(null);
   * // => true
   *
   * _.isNull(undefined);
   * // => false
   */
  function isNull(value) {
    return value === null;
  }

  /**
   * Checks if a `value` is a number.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the `value` is a number, else `false`.
   * @example
   *
   * _.isNumber(8.4 * 5;
   * // => true
   */
  function isNumber(value) {
    return toString.call(value) == numberClass;
  }

  /**
   * Checks if a `value` is a regular expression.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the `value` is a regular expression, else `false`.
   * @example
   *
   * _.isRegExp(/moe/);
   * // => true
   */
  function isRegExp(value) {
    return toString.call(value) == regexpClass;
  }

  /**
   * Checks if a `value` is a string.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the `value` is a string, else `false`.
   * @example
   *
   * _.isString('moe');
   * // => true
   */
  function isString(value) {
    return toString.call(value) == stringClass;
  }

  /**
   * Checks if a `value` is `undefined`.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to check.
   * @returns {Boolean} Returns `true` if the `value` is `undefined`, else `false`.
   * @example
   *
   * _.isUndefined(void 0);
   * // => true
   */
  function isUndefined(value) {
    return value === undefined;
  }

  /**
   * Produces an array of the `object`'s enumerable own property names.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Object} object The object to inspect.
   * @returns {Array} Returns a new array of property names.
   * @example
   *
   * _.keys({ 'one': 1, 'two': 2, 'three': 3 });
   * // => ['one', 'two', 'three']
   */
  var keys = nativeKeys || createIterator({
    'args': 'object',
    'exit': 'if (!objectTypes[typeof object] || object === null) throw TypeError()',
    'init': '[]',
    'inLoop': 'result.push(index)'
  });

  /**
   * Creates an object composed of the specified properties. Property names may
   * be specified as individual arguments or as arrays of property names.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Object} object The object to pluck.
   * @param {Object} [prop1, prop2, ...] The properties to pick.
   * @returns {Object} Returns an object composed of the picked properties.
   * @example
   *
   * _.pick({ 'name': 'moe', 'age': 40, 'userid': 'moe1' }, 'name', 'age');
   * // => { 'name': 'moe', 'age': 40 }
   */
  function pick(object) {
    var prop,
        index = 0,
        props = concat.apply(ArrayProto, arguments),
        length = props.length,
        result = {};

    // start `index` at `1` to skip `object`
    while (++index < length) {
      prop = props[index];
      if (prop in object) {
        result[prop] = object[prop];
      }
    }
    return result;
  }

  /**
   * Gets the size of a `value` by returning `value.length` if `value` is a
   * string or array, or the number of own enumerable properties if `value` is
   * an object.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Array|Object|String} value The value to inspect.
   * @returns {Number} Returns `value.length` if `value` is a string or array,
   *  or the number of own enumerable properties if `value` is an object.
   * @example
   *
   * _.size([1, 2]);
   * // => 2
   *
   * _.size({ 'one': 1, 'two': 2, 'three': 3 });
   * // => 3
   *
   * _.size('curly');
   * // => 5
   */
  function size(value) {
    var className = toString.call(value);
    return className == arrayClass || className == stringClass
      ? value.length
      : keys(value).length;
  }

  /**
   * Invokes `interceptor` with the `value` as the first argument, and then returns
   * `value`. The primary purpose of this method is to "tap into" a method chain,
   * in order to performoperations on intermediate results within the chain.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Mixed} value The value to pass to `callback`.
   * @param {Function} interceptor The function to invoke.
   * @returns {Mixed} Returns `value`.
   * @example
   *
   * _.chain([1,2,3,200])
   *  .filter(function(num) { return num % 2 == 0; })
   *  .tap(alert)
   *  .map(function(num) { return num * num })
   *  .value();
   * // => // [2, 200] (alerted)
   * // => [4, 40000]
   */
  function tap(value, interceptor) {
    interceptor(value);
    return value;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Escapes a string for insertion into HTML, replacing `&`, `<`, `"`, `'`,
   * and `/` characters.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {String} string The string to escape.
   * @returns {String} Returns the escaped string.
   * @example
   *
   * _.escape('Curly, Larry & Moe');
   * // => "Curly, Larry &amp; Moe"
   */
  function escape(string) {
    // the `>` character doesn't require escaping in HTML and has no special
    // meaning unless it's part of a tag or an unquoted attribute value
    // http://mathiasbynens.be/notes/ambiguous-ampersands (semi-related fun fact)
    return (string + '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /**
   * This function returns the first argument passed to it.
   * Note: It is used throughout Lo-Dash as a default callback.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {Mixed} value Any value.
   * @returns {Mixed} Returns `value`.
   * @example
   *
   * var moe = { 'name': 'moe' };
   * moe === _.identity(moe);
   * // => true
   */
  function identity(value) {
    return value;
  }

  /**
   * Adds functions properties of `object` to the `lodash` function and chainable
   * wrapper.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {Object} object The object of function properties to add to `lodash`.
   * @example
   *
   * _.mixin({
   *   'capitalize': function(string) {
   *     return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
   *   }
   * });
   *
   * _.capitalize('curly');
   * // => 'Curly'
   *
   * _('larry').capitalize();
   * // => 'Larry'
   */
  function mixin(object) {
    forEach(functions(object), function(methodName) {
      var func = lodash[methodName] = object[methodName];

      LoDash.prototype[methodName] = function() {
        var args = [this._wrapped];
        if (arguments.length) {
          push.apply(args, arguments);
        }
        var result = args.length == 1 ? func.call(lodash, args[0]) : func.apply(lodash, args);
        if (this._chain) {
          result = new LoDash(result);
          result._chain = true;
        }
        return result;
      };
    });
  }

  /**
   * Reverts the '_' variable to its previous value and returns a reference to
   * the `lodash` function.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @returns {Function} Returns the `lodash` function.
   * @example
   *
   * var lodash = _.noConflict();
   */
  function noConflict() {
    window._ = oldDash;
    return this;
  }

  /**
   * Resolves the value of `property` on `object`. If the property is a function
   * it will be invoked and its result returned, else the property value is returned.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {Object} object The object to inspect.
   * @param {String} property The property to get the result of.
   * @returns {Mixed} Returns the resolved.
   * @example
   *
   * var object = {
   *   'cheese': 'crumpets',
   *   'stuff': function() {
   *     return 'nonsense';
   *   }
   * };
   *
   * _.result(object, 'cheese');
   * // => 'crumpets'
   *
   * _.result(object, 'stuff');
   * // => 'nonsense'
   */
  function result(object, property) {
    if (!object) {
      return null;
    }
    var value = object[property];
    return toString.call(value) == funcClass ? object[property]() : value;
  }

  /**
   * A JavaScript micro-templating method, similar to John Resig's implementation.
   * Lo-Dash templating handles arbitrary delimiters, preserves whitespace, and
   * correctly escapes quotes within interpolated code.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {String} text The template text.
   * @param {Obect} data The data object used to populate the text.
   * @param {Object} options The options object.
   * @returns {Function|String} Returns a compiled function when no `data` object
   *  is given, else it returns the interpolated text.
   * @example
   *
   * // using compiled template
   * var compiled = _.template('hello: <%= name %>');
   * compiled({ 'name': 'moe' });
   * // => 'hello: moe'
   *
   * var list = '% _.forEach(people, function(name) { %> <li><%= name %></li> <% }); %>';
   * _.template(list, { 'people': ['moe', 'curly', 'larry'] });
   * // => '<li>moe</li><li>curly</li><li>larry</li>'
   *
   * var template = _.template('<b><%- value %></b>');
   * template({ 'value': '<script>' });
   * // => '<b>&lt;script&gt;</b>'
   *
   * // using `print`
   * var compiled = _.template('<% print("Hello " + epithet); %>');
   * compiled({ 'epithet': 'stooge' });
   * // => 'Hello stooge.'
   *
   * // using custom template settings
   * _.templateSettings = {
   *   'interpolate': /\{\{(.+?)\}\}/g
   * };
   *
   * var template = _.template('Hello {{ name }}!');
   * template({ 'name': 'Mustache' });
   * // => 'Hello Mustache!'
   *
   *
   * // using the `variable` option
   * _.template('<%= data.hasWith %>', { 'hasWith': 'no' }, { 'variable': 'data' });
   * // => 'no'
   *
   * // using the `source` property
   * <script>
   *   JST.project = <%= _.template(jstText).source %>;
   * </script>
   */
  function template(text, data, options) {
    options || (options = {});

    var result,
        defaults = lodash.templateSettings,
        escapeDelimiter = options.escape,
        evaluateDelimiter = options.evaluate,
        interpolateDelimiter = options.interpolate,
        variable = options.variable;

    // use template defaults if no option is provided
    if (escapeDelimiter == null) {
      escapeDelimiter = defaults.escape;
    }
    if (evaluateDelimiter == null) {
      evaluateDelimiter = defaults.evaluate;
    }
    if (interpolateDelimiter == null) {
      interpolateDelimiter = defaults.interpolate;
    }

    // tokenize delimiters to avoid escaping them
    if (escapeDelimiter) {
      text = text.replace(escapeDelimiter, tokenizeEscape);
    }
    if (interpolateDelimiter) {
      text = text.replace(interpolateDelimiter, tokenizeInterpolate);
    }
    if (evaluateDelimiter) {
      text = text.replace(evaluateDelimiter, tokenizeEvaluate);
    }

    // escape characters that cannot be included in string literals and
    // detokenize delimiter code snippets
    text = "__p='" + text.replace(reUnescaped, escapeChar).replace(reToken, detokenize) + "';\n";

    // clear stored code snippets
    tokenized.length = 0;

    // if `options.variable` is not specified, add `data` to the top of the scope chain
    if (!variable) {
      variable = defaults.variable;
      text = 'with (' + variable + ' || {}) {\n' + text + '\n}\n';
    }

    text = 'function(' + variable + ') {\n' +
      'var __p, __t, __j = Array.prototype.join;\n' +
      'function print() { __p += __j.call(arguments, \'\') }\n' +
      text +
      'return __p\n}';

    result = Function('_', 'return ' + text)(lodash);

    if (data) {
      return result(data);
    }
    // provide the compiled function's source via its `toString()` method, in
    // supported environments, or the `source` property as a convenience for
    // build time precompilation
    result.source = text;
    return result;
  }

  /**
   * Executes the `callback` function `n` times. The `callback` is invoked with
   * 1 argument; (index).
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {Number} n The number of times to execute the callback.
   * @param {Function} callback The function called per iteration.
   * @param {Mixed} [thisArg] The `this` binding for the callback.
   * @example
   *
   * _.times(3, function() { genie.grantWish(); });
   */
  function times(n, callback, thisArg) {
    if (thisArg) {
      callback = bind(callback, thisArg);
    }
    for (var index = 0; index < n; index++) {
      callback(index);
    }
  }

  /**
   * Generates a unique id. If `prefix` is passed, the id will be appended to it.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {String} [prefix] The value to prefix the id with.
   * @returns {Number|String} Returns a numeric id if no prefix is passed, else
   *  a string id may be returned.
   * @example
   *
   * _.uniqueId('contact_');
   * // => 'contact_104'
   */
  function uniqueId(prefix) {
    var id = idCounter++;
    return prefix ? prefix + id : id;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Wraps the value in a `lodash` chainable object.
   *
   * @static
   * @memberOf _
   * @category Chaining
   * @param {Mixed} value The value to wrap.
   * @returns {Object} Returns the `lodash` chainable object.
   * @example
   *
   * var stooges = [
   *   { 'name': 'moe', 'age': 40 },
   *   { 'name': 'larry', 'age': 50 },
   *   { 'name': 'curly', 'age': 60 }
   * ];
   *
   * var youngest = _.chain(stooges)
   *     .sortBy(function(stooge) { return stooge.age; })
   *     .map(function(stooge) { return stooge.name + ' is ' + stooge.age; })
   *     .first()
   *     .value();
   * // => 'moe is 40'
   */
  function chain(value) {
    value = new LoDash(value);
    value._chain = true;
    return value;
  }

  /**
   * Extracts the value from a wrapped chainable object.
   *
   * @name chain
   * @memberOf _
   * @category Chaining
   * @returns {Mixed} Returns the wrapped object.
   * @example
   *
   * _([1, 2, 3]).value();
   * // => [1, 2, 3]
   */
  function wrapperChain() {
    this._chain = true;
    return this;
  }

  /**
   * Extracts the value from a wrapped chainable object.
   *
   * @name value
   * @memberOf _
   * @category Chaining
   * @returns {Mixed} Returns the wrapped object.
   * @example
   *
   * _([1, 2, 3]).value();
   * // => [1, 2, 3]
   */
  function wrapperValue() {
    return this._wrapped;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * The semantic version number.
   *
   * @static
   * @memberOf _
   * @type String
   */
  lodash.VERSION = '0.2.2';

  // assign static methods
  lodash.after = after;
  lodash.bind = bind;
  lodash.bindAll = bindAll;
  lodash.chain = chain;
  lodash.clone = clone;
  lodash.compact = compact;
  lodash.compose = compose;
  lodash.contains = contains;
  lodash.debounce = debounce;
  lodash.defaults = defaults;
  lodash.defer = defer;
  lodash.delay = delay;
  lodash.difference = difference;
  lodash.escape = escape;
  lodash.every = every;
  lodash.extend = extend;
  lodash.filter = filter;
  lodash.find = find;
  lodash.first = first;
  lodash.flatten = flatten;
  lodash.forEach = forEach;
  lodash.functions = functions;
  lodash.groupBy = groupBy;
  lodash.has = has;
  lodash.identity = identity;
  lodash.indexOf = indexOf;
  lodash.initial = initial;
  lodash.intersection = intersection;
  lodash.invoke = invoke;
  lodash.isArguments = isArguments;
  lodash.isArray = isArray;
  lodash.isBoolean = isBoolean;
  lodash.isDate = isDate;
  lodash.isElement = isElement;
  lodash.isEmpty = isEmpty;
  lodash.isEqual = isEqual;
  lodash.isFinite = isFinite;
  lodash.isFunction = isFunction;
  lodash.isNaN = isNaN;
  lodash.isNull = isNull;
  lodash.isNumber = isNumber;
  lodash.isObject = isObject;
  lodash.isRegExp = isRegExp;
  lodash.isString = isString;
  lodash.isUndefined = isUndefined;
  lodash.keys = keys;
  lodash.last = last;
  lodash.lastIndexOf = lastIndexOf;
  lodash.map = map;
  lodash.max = max;
  lodash.memoize = memoize;
  lodash.min = min;
  lodash.mixin = mixin;
  lodash.noConflict = noConflict;
  lodash.once = once;
  lodash.partial = partial;
  lodash.pick = pick;
  lodash.pluck = pluck;
  lodash.range = range;
  lodash.reduce = reduce;
  lodash.reduceRight = reduceRight;
  lodash.reject = reject;
  lodash.rest = rest;
  lodash.result = result;
  lodash.shuffle = shuffle;
  lodash.size = size;
  lodash.some = some;
  lodash.sortBy = sortBy;
  lodash.sortedIndex = sortedIndex;
  lodash.tap = tap;
  lodash.template = template;
  lodash.throttle = throttle;
  lodash.times = times;
  lodash.toArray = toArray;
  lodash.union = union;
  lodash.uniq = uniq;
  lodash.uniqueId = uniqueId;
  lodash.values = values;
  lodash.without = without;
  lodash.wrap = wrap;
  lodash.zip = zip;

  // assign aliases
  lodash.all = every;
  lodash.any = some;
  lodash.collect = map;
  lodash.detect = find;
  lodash.each = forEach;
  lodash.foldl = reduce;
  lodash.foldr = reduceRight;
  lodash.head = first;
  lodash.include = contains;
  lodash.inject = reduce;
  lodash.methods = functions;
  lodash.select = filter;
  lodash.tail = rest;
  lodash.take = first;
  lodash.unique = uniq;

  // add pseudo privates used and removed during the build process
  lodash._createIterator = createIterator;
  lodash._iteratorTemplate = iteratorTemplate;

  /*--------------------------------------------------------------------------*/

  // assign private `LoDash` constructor's prototype
  LoDash.prototype = lodash.prototype;

  // add all static functions to `LoDash.prototype`
  mixin(lodash);

  // add `LoDash.prototype.chain` after calling `mixin()` to avoid overwriting
  // it with the wrapped `lodash.chain`
  LoDash.prototype.chain = wrapperChain;
  LoDash.prototype.value = wrapperValue;

  // add all mutator Array functions to the wrapper.
  forEach(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(methodName) {
    var func = ArrayProto[methodName];

    LoDash.prototype[methodName] = function() {
      var value = this._wrapped;
      if (arguments.length) {
        func.apply(value, arguments);
      } else {
        func.call(value);
      }
      // IE compatibility mode and IE < 9 have buggy Array `shift()` and `splice()`
      // functions that fail to remove the last element, `value[0]`, of
      // array-like-objects even though the `length` property is set to `0`.
      // The `shift()` method is buggy in IE 8 compatibility mode, while `splice()`
      // is buggy regardless of mode in IE < 9 and buggy in compatibility mode in IE 9.
      if (value.length === 0) {
        delete value[0];
      }
      if (this._chain) {
        value = new LoDash(value);
        value._chain = true;
      }
      return value;
    };
  });

  // add all accessor Array functions to the wrapper.
  forEach(['concat', 'join', 'slice'], function(methodName) {
    var func = ArrayProto[methodName];

    LoDash.prototype[methodName] = function() {
      var value = this._wrapped,
          result = arguments.length ? func.apply(value, arguments) : func.call(value);

      if (this._chain) {
        result = new LoDash(result);
        result._chain = true;
      }
      return result;
    };
  });

  /*--------------------------------------------------------------------------*/

  // expose Lo-Dash
  // some AMD build optimizers, like r.js, check for specific condition patterns like the following:
  if (typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
    // Expose Lo-Dash to the global object even when an AMD loader is present in
    // case Lo-Dash was injected by a third-party script and not intended to be
    // loaded as a module. The global assignment can be reverted in the Lo-Dash
    // module via its `noConflict()` method.
    window._ = lodash;

    // define as an anonymous module so, through path mapping, it can be
    // referenced as the "underscore" module
    define('lodash',[],function() {
      return lodash;
    });
  }
  // check for `exports` after `define` in case a build optimizer adds an `exports` object
  else if (freeExports) {
    // in Node.js or RingoJS v0.8.0+
    if (typeof module == 'object' && module && module.exports == freeExports) {
      (module.exports = lodash)._ = lodash;
    }
    // in Narwhal or RingoJS v0.7.0-
    else {
      freeExports._ = lodash;
    }
  }
  else {
    // in a browser or Rhino
    window._ = lodash;
  }
}(this));

//     Backbone.js 0.9.2

//     (c) 2010-2012 Jeremy Ashkenas, DocumentCloud Inc.
//     Backbone may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://backbonejs.org

(function(){

  // Initial Setup
  // -------------

  // Save a reference to the global object (`window` in the browser, `global`
  // on the server).
  var root = this;

  // Save the previous value of the `Backbone` variable, so that it can be
  // restored later on, if `noConflict` is used.
  var previousBackbone = root.Backbone;

  // Create a local reference to slice/splice.
  var slice = Array.prototype.slice;
  var splice = Array.prototype.splice;

  // The top-level namespace. All public Backbone classes and modules will
  // be attached to this. Exported for both CommonJS and the browser.
  var Backbone;
  if (typeof exports !== 'undefined') {
    Backbone = exports;
  } else {
    Backbone = root.Backbone = {};
  }

  // Current version of the library. Keep in sync with `package.json`.
  Backbone.VERSION = '0.9.2';

  // Require Underscore, if we're on the server, and it's not already present.
  var _ = root._;
  if (!_ && (typeof require !== 'undefined')) _ = require('underscore');

  // For Backbone's purposes, jQuery, Zepto, or Ender owns the `$` variable.
  var $ = root.jQuery || root.Zepto || root.ender;

  // Set the JavaScript library that will be used for DOM manipulation and
  // Ajax calls (a.k.a. the `$` variable). By default Backbone will use: jQuery,
  // Zepto, or Ender; but the `setDomLibrary()` method lets you inject an
  // alternate JavaScript library (or a mock library for testing your views
  // outside of a browser).
  Backbone.setDomLibrary = function(lib) {
    $ = lib;
  };

  // Runs Backbone.js in *noConflict* mode, returning the `Backbone` variable
  // to its previous owner. Returns a reference to this Backbone object.
  Backbone.noConflict = function() {
    root.Backbone = previousBackbone;
    return this;
  };

  // Turn on `emulateHTTP` to support legacy HTTP servers. Setting this option
  // will fake `"PUT"` and `"DELETE"` requests via the `_method` parameter and
  // set a `X-Http-Method-Override` header.
  Backbone.emulateHTTP = false;

  // Turn on `emulateJSON` to support legacy servers that can't deal with direct
  // `application/json` requests ... will encode the body as
  // `application/x-www-form-urlencoded` instead and will send the model in a
  // form param named `model`.
  Backbone.emulateJSON = false;

  // Backbone.Events
  // -----------------

  // Regular expression used to split event strings
  var eventSplitter = /\s+/;

  // A module that can be mixed in to *any object* in order to provide it with
  // custom events. You may bind with `on` or remove with `off` callback functions
  // to an event; trigger`-ing an event fires all callbacks in succession.
  //
  //     var object = {};
  //     _.extend(object, Backbone.Events);
  //     object.on('expand', function(){ alert('expanded'); });
  //     object.trigger('expand');
  //
  var Events = Backbone.Events = {

    // Bind one or more space separated events, `events`, to a `callback`
    // function. Passing `"all"` will bind the callback to all events fired.
    on: function(events, callback, context) {

      var calls, event, node, tail, list;
      if (!callback) return this;
      events = events.split(eventSplitter);
      calls = this._callbacks || (this._callbacks = {});

      // Create an immutable callback list, allowing traversal during
      // modification.  The tail is an empty object that will always be used
      // as the next node.
      while (event = events.shift()) {
        list = calls[event];
        node = list ? list.tail : {};
        node.next = tail = {};
        node.context = context;
        node.callback = callback;
        calls[event] = {tail: tail, next: list ? list.next : node};
      }

      return this;
    },

    // Remove one or many callbacks. If `context` is null, removes all callbacks
    // with that function. If `callback` is null, removes all callbacks for the
    // event. If `events` is null, removes all bound callbacks for all events.
    off: function(events, callback, context) {
      var event, calls, node, tail, cb, ctx;

      // No events, or removing *all* events.
      if (!(calls = this._callbacks)) return;
      if (!(events || callback || context)) {
        delete this._callbacks;
        return this;
      }

      // Loop through the listed events and contexts, splicing them out of the
      // linked list of callbacks if appropriate.
      events = events ? events.split(eventSplitter) : _.keys(calls);
      while (event = events.shift()) {
        node = calls[event];
        delete calls[event];
        if (!node || !(callback || context)) continue;
        // Create a new list, omitting the indicated callbacks.
        tail = node.tail;
        while ((node = node.next) !== tail) {
          cb = node.callback;
          ctx = node.context;
          if ((callback && cb !== callback) || (context && ctx !== context)) {
            this.on(event, cb, ctx);
          }
        }
      }

      return this;
    },

    // Trigger one or many events, firing all bound callbacks. Callbacks are
    // passed the same arguments as `trigger` is, apart from the event name
    // (unless you're listening on `"all"`, which will cause your callback to
    // receive the true name of the event as the first argument).
    trigger: function(events) {
      var event, node, calls, tail, args, all, rest;
      if (!(calls = this._callbacks)) return this;
      all = calls.all;
      events = events.split(eventSplitter);
      rest = slice.call(arguments, 1);

      // For each event, walk through the linked list of callbacks twice,
      // first to trigger the event, then to trigger any `"all"` callbacks.
      while (event = events.shift()) {
        if (node = calls[event]) {
          tail = node.tail;
          while ((node = node.next) !== tail) {
            node.callback.apply(node.context || this, rest);
          }
        }
        if (node = all) {
          tail = node.tail;
          args = [event].concat(rest);
          while ((node = node.next) !== tail) {
            node.callback.apply(node.context || this, args);
          }
        }
      }

      return this;
    }

  };

  // Aliases for backwards compatibility.
  Events.bind   = Events.on;
  Events.unbind = Events.off;

  // Backbone.Model
  // --------------

  // Create a new model, with defined attributes. A client id (`cid`)
  // is automatically generated and assigned for you.
  var Model = Backbone.Model = function(attributes, options) {
    var defaults;
    attributes || (attributes = {});
    if (options && options.parse) attributes = this.parse(attributes);
    if (defaults = getValue(this, 'defaults')) {
      attributes = _.extend({}, defaults, attributes);
    }
    if (options && options.collection) this.collection = options.collection;
    this.attributes = {};
    this._escapedAttributes = {};
    this.cid = _.uniqueId('c');
    this.changed = {};
    this._silent = {};
    this._pending = {};
    this.set(attributes, {silent: true});
    // Reset change tracking.
    this.changed = {};
    this._silent = {};
    this._pending = {};
    this._previousAttributes = _.clone(this.attributes);
    this.initialize.apply(this, arguments);
  };

  // Attach all inheritable methods to the Model prototype.
  _.extend(Model.prototype, Events, {

    // A hash of attributes whose current and previous value differ.
    changed: null,

    // A hash of attributes that have silently changed since the last time
    // `change` was called.  Will become pending attributes on the next call.
    _silent: null,

    // A hash of attributes that have changed since the last `'change'` event
    // began.
    _pending: null,

    // The default name for the JSON `id` attribute is `"id"`. MongoDB and
    // CouchDB users may want to set this to `"_id"`.
    idAttribute: 'id',

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // Return a copy of the model's `attributes` object.
    toJSON: function(options) {
      return _.clone(this.attributes);
    },

    // Get the value of an attribute.
    get: function(attr) {
      return this.attributes[attr];
    },

    // Get the HTML-escaped value of an attribute.
    escape: function(attr) {
      var html;
      if (html = this._escapedAttributes[attr]) return html;
      var val = this.get(attr);
      return this._escapedAttributes[attr] = _.escape(val == null ? '' : '' + val);
    },

    // Returns `true` if the attribute contains a value that is not null
    // or undefined.
    has: function(attr) {
      return this.get(attr) != null;
    },

    // Set a hash of model attributes on the object, firing `"change"` unless
    // you choose to silence it.
    set: function(key, value, options) {
      var attrs, attr, val;

      // Handle both `"key", value` and `{key: value}` -style arguments.
      if (_.isObject(key) || key == null) {
        attrs = key;
        options = value;
      } else {
        attrs = {};
        attrs[key] = value;
      }

      // Extract attributes and options.
      options || (options = {});
      if (!attrs) return this;
      if (attrs instanceof Model) attrs = attrs.attributes;
      if (options.unset) for (attr in attrs) attrs[attr] = void 0;

      // Run validation.
      if (!this._validate(attrs, options)) return false;

      // Check for changes of `id`.
      if (this.idAttribute in attrs) this.id = attrs[this.idAttribute];

      var changes = options.changes = {};
      var now = this.attributes;
      var escaped = this._escapedAttributes;
      var prev = this._previousAttributes || {};

      // For each `set` attribute...
      for (attr in attrs) {
        val = attrs[attr];

        // If the new and current value differ, record the change.
        if (!_.isEqual(now[attr], val) || (options.unset && _.has(now, attr))) {
          delete escaped[attr];
          (options.silent ? this._silent : changes)[attr] = true;
        }

        // Update or delete the current value.
        options.unset ? delete now[attr] : now[attr] = val;

        // If the new and previous value differ, record the change.  If not,
        // then remove changes for this attribute.
        if (!_.isEqual(prev[attr], val) || (_.has(now, attr) != _.has(prev, attr))) {
          this.changed[attr] = val;
          if (!options.silent) this._pending[attr] = true;
        } else {
          delete this.changed[attr];
          delete this._pending[attr];
        }
      }

      // Fire the `"change"` events.
      if (!options.silent) this.change(options);
      return this;
    },

    // Remove an attribute from the model, firing `"change"` unless you choose
    // to silence it. `unset` is a noop if the attribute doesn't exist.
    unset: function(attr, options) {
      (options || (options = {})).unset = true;
      return this.set(attr, null, options);
    },

    // Clear all attributes on the model, firing `"change"` unless you choose
    // to silence it.
    clear: function(options) {
      (options || (options = {})).unset = true;
      return this.set(_.clone(this.attributes), options);
    },

    // Fetch the model from the server. If the server's representation of the
    // model differs from its current attributes, they will be overriden,
    // triggering a `"change"` event.
    fetch: function(options) {
      options = options ? _.clone(options) : {};
      var model = this;
      var success = options.success;
      options.success = function(resp, status, xhr) {
        if (!model.set(model.parse(resp, xhr), options)) return false;
        if (success) success(model, resp);
      };
      options.error = Backbone.wrapError(options.error, model, options);
      return (this.sync || Backbone.sync).call(this, 'read', this, options);
    },

    // Set a hash of model attributes, and sync the model to the server.
    // If the server returns an attributes hash that differs, the model's
    // state will be `set` again.
    save: function(key, value, options) {
      var attrs, current;

      // Handle both `("key", value)` and `({key: value})` -style calls.
      if (_.isObject(key) || key == null) {
        attrs = key;
        options = value;
      } else {
        attrs = {};
        attrs[key] = value;
      }
      options = options ? _.clone(options) : {};

      // If we're "wait"-ing to set changed attributes, validate early.
      if (options.wait) {
        if (!this._validate(attrs, options)) return false;
        current = _.clone(this.attributes);
      }

      // Regular saves `set` attributes before persisting to the server.
      var silentOptions = _.extend({}, options, {silent: true});
      if (attrs && !this.set(attrs, options.wait ? silentOptions : options)) {
        return false;
      }

      // After a successful server-side save, the client is (optionally)
      // updated with the server-side state.
      var model = this;
      var success = options.success;
      options.success = function(resp, status, xhr) {
        var serverAttrs = model.parse(resp, xhr);
        if (options.wait) {
          delete options.wait;
          serverAttrs = _.extend(attrs || {}, serverAttrs);
        }
        if (!model.set(serverAttrs, options)) return false;
        if (success) {
          success(model, resp);
        } else {
          model.trigger('sync', model, resp, options);
        }
      };

      // Finish configuring and sending the Ajax request.
      options.error = Backbone.wrapError(options.error, model, options);
      var method = this.isNew() ? 'create' : 'update';
      var xhr = (this.sync || Backbone.sync).call(this, method, this, options);
      if (options.wait) this.set(current, silentOptions);
      return xhr;
    },

    // Destroy this model on the server if it was already persisted.
    // Optimistically removes the model from its collection, if it has one.
    // If `wait: true` is passed, waits for the server to respond before removal.
    destroy: function(options) {
      options = options ? _.clone(options) : {};
      var model = this;
      var success = options.success;

      var triggerDestroy = function() {
        model.trigger('destroy', model, model.collection, options);
      };

      if (this.isNew()) {
        triggerDestroy();
        return false;
      }

      options.success = function(resp) {
        if (options.wait) triggerDestroy();
        if (success) {
          success(model, resp);
        } else {
          model.trigger('sync', model, resp, options);
        }
      };

      options.error = Backbone.wrapError(options.error, model, options);
      var xhr = (this.sync || Backbone.sync).call(this, 'delete', this, options);
      if (!options.wait) triggerDestroy();
      return xhr;
    },

    // Default URL for the model's representation on the server -- if you're
    // using Backbone's restful methods, override this to change the endpoint
    // that will be called.
    url: function() {
      var base = getValue(this, 'urlRoot') || getValue(this.collection, 'url') || urlError();
      if (this.isNew()) return base;
      return base + (base.charAt(base.length - 1) == '/' ? '' : '/') + encodeURIComponent(this.id);
    },

    // **parse** converts a response into the hash of attributes to be `set` on
    // the model. The default implementation is just to pass the response along.
    parse: function(resp, xhr) {
      return resp;
    },

    // Create a new model with identical attributes to this one.
    clone: function() {
      return new this.constructor(this.attributes);
    },

    // A model is new if it has never been saved to the server, and lacks an id.
    isNew: function() {
      return this.id == null;
    },

    // Call this method to manually fire a `"change"` event for this model and
    // a `"change:attribute"` event for each changed attribute.
    // Calling this will cause all objects observing the model to update.
    change: function(options) {
      options || (options = {});
      var changing = this._changing;
      this._changing = true;

      // Silent changes become pending changes.
      for (var attr in this._silent) this._pending[attr] = true;

      // Silent changes are triggered.
      var changes = _.extend({}, options.changes, this._silent);
      this._silent = {};
      for (var attr in changes) {
        this.trigger('change:' + attr, this, this.get(attr), options);
      }
      if (changing) return this;

      // Continue firing `"change"` events while there are pending changes.
      while (!_.isEmpty(this._pending)) {
        this._pending = {};
        this.trigger('change', this, options);
        // Pending and silent changes still remain.
        for (var attr in this.changed) {
          if (this._pending[attr] || this._silent[attr]) continue;
          delete this.changed[attr];
        }
        this._previousAttributes = _.clone(this.attributes);
      }

      this._changing = false;
      return this;
    },

    // Determine if the model has changed since the last `"change"` event.
    // If you specify an attribute name, determine if that attribute has changed.
    hasChanged: function(attr) {
      if (!arguments.length) return !_.isEmpty(this.changed);
      return _.has(this.changed, attr);
    },

    // Return an object containing all the attributes that have changed, or
    // false if there are no changed attributes. Useful for determining what
    // parts of a view need to be updated and/or what attributes need to be
    // persisted to the server. Unset attributes will be set to undefined.
    // You can also pass an attributes object to diff against the model,
    // determining if there *would be* a change.
    changedAttributes: function(diff) {
      if (!diff) return this.hasChanged() ? _.clone(this.changed) : false;
      var val, changed = false, old = this._previousAttributes;
      for (var attr in diff) {
        if (_.isEqual(old[attr], (val = diff[attr]))) continue;
        (changed || (changed = {}))[attr] = val;
      }
      return changed;
    },

    // Get the previous value of an attribute, recorded at the time the last
    // `"change"` event was fired.
    previous: function(attr) {
      if (!arguments.length || !this._previousAttributes) return null;
      return this._previousAttributes[attr];
    },

    // Get all of the attributes of the model at the time of the previous
    // `"change"` event.
    previousAttributes: function() {
      return _.clone(this._previousAttributes);
    },

    // Check if the model is currently in a valid state. It's only possible to
    // get into an *invalid* state if you're using silent changes.
    isValid: function() {
      return !this.validate(this.attributes);
    },

    // Run validation against the next complete set of model attributes,
    // returning `true` if all is well. If a specific `error` callback has
    // been passed, call that instead of firing the general `"error"` event.
    _validate: function(attrs, options) {
      if (options.silent || !this.validate) return true;
      attrs = _.extend({}, this.attributes, attrs);
      var error = this.validate(attrs, options);
      if (!error) return true;
      if (options && options.error) {
        options.error(this, error, options);
      } else {
        this.trigger('error', this, error, options);
      }
      return false;
    }

  });

  // Backbone.Collection
  // -------------------

  // Provides a standard collection class for our sets of models, ordered
  // or unordered. If a `comparator` is specified, the Collection will maintain
  // its models in sort order, as they're added and removed.
  var Collection = Backbone.Collection = function(models, options) {
    options || (options = {});
    if (options.model) this.model = options.model;
    if (options.comparator) this.comparator = options.comparator;
    this._reset();
    this.initialize.apply(this, arguments);
    if (models) this.reset(models, {silent: true, parse: options.parse});
  };

  // Define the Collection's inheritable methods.
  _.extend(Collection.prototype, Events, {

    // The default model for a collection is just a **Backbone.Model**.
    // This should be overridden in most cases.
    model: Model,

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // The JSON representation of a Collection is an array of the
    // models' attributes.
    toJSON: function(options) {
      return this.map(function(model){ return model.toJSON(options); });
    },

    // Add a model, or list of models to the set. Pass **silent** to avoid
    // firing the `add` event for every new model.
    add: function(models, options) {
      var i, index, length, model, cid, id, cids = {}, ids = {}, dups = [];
      options || (options = {});
      models = _.isArray(models) ? models.slice() : [models];

      // Begin by turning bare objects into model references, and preventing
      // invalid models or duplicate models from being added.
      for (i = 0, length = models.length; i < length; i++) {
        if (!(model = models[i] = this._prepareModel(models[i], options))) {
          throw new Error("Can't add an invalid model to a collection");
        }
        cid = model.cid;
        id = model.id;
        if (cids[cid] || this._byCid[cid] || ((id != null) && (ids[id] || this._byId[id]))) {
          dups.push(i);
          continue;
        }
        cids[cid] = ids[id] = model;
      }

      // Remove duplicates.
      i = dups.length;
      while (i--) {
        models.splice(dups[i], 1);
      }

      // Listen to added models' events, and index models for lookup by
      // `id` and by `cid`.
      for (i = 0, length = models.length; i < length; i++) {
        (model = models[i]).on('all', this._onModelEvent, this);
        this._byCid[model.cid] = model;
        if (model.id != null) this._byId[model.id] = model;
      }

      // Insert models into the collection, re-sorting if needed, and triggering
      // `add` events unless silenced.
      this.length += length;
      index = options.at != null ? options.at : this.models.length;
      splice.apply(this.models, [index, 0].concat(models));
      if (this.comparator) this.sort({silent: true});
      if (options.silent) return this;
      for (i = 0, length = this.models.length; i < length; i++) {
        if (!cids[(model = this.models[i]).cid]) continue;
        options.index = i;
        model.trigger('add', model, this, options);
      }
      return this;
    },

    // Remove a model, or a list of models from the set. Pass silent to avoid
    // firing the `remove` event for every model removed.
    remove: function(models, options) {
      var i, l, index, model;
      options || (options = {});
      models = _.isArray(models) ? models.slice() : [models];
      for (i = 0, l = models.length; i < l; i++) {
        model = this.getByCid(models[i]) || this.get(models[i]);
        if (!model) continue;
        delete this._byId[model.id];
        delete this._byCid[model.cid];
        index = this.indexOf(model);
        this.models.splice(index, 1);
        this.length--;
        if (!options.silent) {
          options.index = index;
          model.trigger('remove', model, this, options);
        }
        this._removeReference(model);
      }
      return this;
    },

    // Add a model to the end of the collection.
    push: function(model, options) {
      model = this._prepareModel(model, options);
      this.add(model, options);
      return model;
    },

    // Remove a model from the end of the collection.
    pop: function(options) {
      var model = this.at(this.length - 1);
      this.remove(model, options);
      return model;
    },

    // Add a model to the beginning of the collection.
    unshift: function(model, options) {
      model = this._prepareModel(model, options);
      this.add(model, _.extend({at: 0}, options));
      return model;
    },

    // Remove a model from the beginning of the collection.
    shift: function(options) {
      var model = this.at(0);
      this.remove(model, options);
      return model;
    },

    // Get a model from the set by id.
    get: function(id) {
      if (id == null) return void 0;
      return this._byId[id.id != null ? id.id : id];
    },

    // Get a model from the set by client id.
    getByCid: function(cid) {
      return cid && this._byCid[cid.cid || cid];
    },

    // Get the model at the given index.
    at: function(index) {
      return this.models[index];
    },

    // Return models with matching attributes. Useful for simple cases of `filter`.
    where: function(attrs) {
      if (_.isEmpty(attrs)) return [];
      return this.filter(function(model) {
        for (var key in attrs) {
          if (attrs[key] !== model.get(key)) return false;
        }
        return true;
      });
    },

    // Force the collection to re-sort itself. You don't need to call this under
    // normal circumstances, as the set will maintain sort order as each item
    // is added.
    sort: function(options) {
      options || (options = {});
      if (!this.comparator) throw new Error('Cannot sort a set without a comparator');
      var boundComparator = _.bind(this.comparator, this);
      if (this.comparator.length == 1) {
        this.models = this.sortBy(boundComparator);
      } else {
        this.models.sort(boundComparator);
      }
      if (!options.silent) this.trigger('reset', this, options);
      return this;
    },

    // Pluck an attribute from each model in the collection.
    pluck: function(attr) {
      return _.map(this.models, function(model){ return model.get(attr); });
    },

    // When you have more items than you want to add or remove individually,
    // you can reset the entire set with a new list of models, without firing
    // any `add` or `remove` events. Fires `reset` when finished.
    reset: function(models, options) {
      models  || (models = []);
      options || (options = {});
      for (var i = 0, l = this.models.length; i < l; i++) {
        this._removeReference(this.models[i]);
      }
      this._reset();
      this.add(models, _.extend({silent: true}, options));
      if (!options.silent) this.trigger('reset', this, options);
      return this;
    },

    // Fetch the default set of models for this collection, resetting the
    // collection when they arrive. If `add: true` is passed, appends the
    // models to the collection instead of resetting.
    fetch: function(options) {
      options = options ? _.clone(options) : {};
      if (options.parse === undefined) options.parse = true;
      var collection = this;
      var success = options.success;
      options.success = function(resp, status, xhr) {
        collection[options.add ? 'add' : 'reset'](collection.parse(resp, xhr), options);
        if (success) success(collection, resp);
      };
      options.error = Backbone.wrapError(options.error, collection, options);
      return (this.sync || Backbone.sync).call(this, 'read', this, options);
    },

    // Create a new instance of a model in this collection. Add the model to the
    // collection immediately, unless `wait: true` is passed, in which case we
    // wait for the server to agree.
    create: function(model, options) {
      var coll = this;
      options = options ? _.clone(options) : {};
      model = this._prepareModel(model, options);
      if (!model) return false;
      if (!options.wait) coll.add(model, options);
      var success = options.success;
      options.success = function(nextModel, resp, xhr) {
        if (options.wait) coll.add(nextModel, options);
        if (success) {
          success(nextModel, resp);
        } else {
          nextModel.trigger('sync', model, resp, options);
        }
      };
      model.save(null, options);
      return model;
    },

    // **parse** converts a response into a list of models to be added to the
    // collection. The default implementation is just to pass it through.
    parse: function(resp, xhr) {
      return resp;
    },

    // Proxy to _'s chain. Can't be proxied the same way the rest of the
    // underscore methods are proxied because it relies on the underscore
    // constructor.
    chain: function () {
      return _(this.models).chain();
    },

    // Reset all internal state. Called when the collection is reset.
    _reset: function(options) {
      this.length = 0;
      this.models = [];
      this._byId  = {};
      this._byCid = {};
    },

    // Prepare a model or hash of attributes to be added to this collection.
    _prepareModel: function(model, options) {
      options || (options = {});
      if (!(model instanceof Model)) {
        var attrs = model;
        options.collection = this;
        model = new this.model(attrs, options);
        if (!model._validate(model.attributes, options)) model = false;
      } else if (!model.collection) {
        model.collection = this;
      }
      return model;
    },

    // Internal method to remove a model's ties to a collection.
    _removeReference: function(model) {
      if (this == model.collection) {
        delete model.collection;
      }
      model.off('all', this._onModelEvent, this);
    },

    // Internal method called every time a model in the set fires an event.
    // Sets need to update their indexes when models change ids. All other
    // events simply proxy through. "add" and "remove" events that originate
    // in other collections are ignored.
    _onModelEvent: function(event, model, collection, options) {
      if ((event == 'add' || event == 'remove') && collection != this) return;
      if (event == 'destroy') {
        this.remove(model, options);
      }
      if (model && event === 'change:' + model.idAttribute) {
        delete this._byId[model.previous(model.idAttribute)];
        this._byId[model.id] = model;
      }
      this.trigger.apply(this, arguments);
    }

  });

  // Underscore methods that we want to implement on the Collection.
  var methods = ['forEach', 'each', 'map', 'reduce', 'reduceRight', 'find',
    'detect', 'filter', 'select', 'reject', 'every', 'all', 'some', 'any',
    'include', 'contains', 'invoke', 'max', 'min', 'sortBy', 'sortedIndex',
    'toArray', 'size', 'first', 'initial', 'rest', 'last', 'without', 'indexOf',
    'shuffle', 'lastIndexOf', 'isEmpty', 'groupBy'];

  // Mix in each Underscore method as a proxy to `Collection#models`.
  _.each(methods, function(method) {
    Collection.prototype[method] = function() {
      return _[method].apply(_, [this.models].concat(_.toArray(arguments)));
    };
  });

  // Backbone.Router
  // -------------------

  // Routers map faux-URLs to actions, and fire events when routes are
  // matched. Creating a new one sets its `routes` hash, if not set statically.
  var Router = Backbone.Router = function(options) {
    options || (options = {});
    if (options.routes) this.routes = options.routes;
    this._bindRoutes();
    this.initialize.apply(this, arguments);
  };

  // Cached regular expressions for matching named param parts and splatted
  // parts of route strings.
  var namedParam    = /:\w+/g;
  var splatParam    = /\*\w+/g;
  var escapeRegExp  = /[-[\]{}()+?.,\\^$|#\s]/g;

  // Set up all inheritable **Backbone.Router** properties and methods.
  _.extend(Router.prototype, Events, {

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // Manually bind a single named route to a callback. For example:
    //
    //     this.route('search/:query/p:num', 'search', function(query, num) {
    //       ...
    //     });
    //
    route: function(route, name, callback) {
      Backbone.history || (Backbone.history = new History);
      if (!_.isRegExp(route)) route = this._routeToRegExp(route);
      if (!callback) callback = this[name];
      Backbone.history.route(route, _.bind(function(fragment) {
        var args = this._extractParameters(route, fragment);
        callback && callback.apply(this, args);
        this.trigger.apply(this, ['route:' + name].concat(args));
        Backbone.history.trigger('route', this, name, args);
      }, this));
      return this;
    },

    // Simple proxy to `Backbone.history` to save a fragment into the history.
    navigate: function(fragment, options) {
      Backbone.history.navigate(fragment, options);
    },

    // Bind all defined routes to `Backbone.history`. We have to reverse the
    // order of the routes here to support behavior where the most general
    // routes can be defined at the bottom of the route map.
    _bindRoutes: function() {
      if (!this.routes) return;
      var routes = [];
      for (var route in this.routes) {
        routes.unshift([route, this.routes[route]]);
      }
      for (var i = 0, l = routes.length; i < l; i++) {
        this.route(routes[i][0], routes[i][1], this[routes[i][1]]);
      }
    },

    // Convert a route string into a regular expression, suitable for matching
    // against the current location hash.
    _routeToRegExp: function(route) {
      route = route.replace(escapeRegExp, '\\$&')
                   .replace(namedParam, '([^\/]+)')
                   .replace(splatParam, '(.*?)');
      return new RegExp('^' + route + '$');
    },

    // Given a route, and a URL fragment that it matches, return the array of
    // extracted parameters.
    _extractParameters: function(route, fragment) {
      return route.exec(fragment).slice(1);
    }

  });

  // Backbone.History
  // ----------------

  // Handles cross-browser history management, based on URL fragments. If the
  // browser does not support `onhashchange`, falls back to polling.
  var History = Backbone.History = function() {
    this.handlers = [];
    _.bindAll(this, 'checkUrl');
  };

  // Cached regex for cleaning leading hashes and slashes .
  var routeStripper = /^[#\/]/;

  // Cached regex for detecting MSIE.
  var isExplorer = /msie [\w.]+/;

  // Has the history handling already been started?
  History.started = false;

  // Set up all inheritable **Backbone.History** properties and methods.
  _.extend(History.prototype, Events, {

    // The default interval to poll for hash changes, if necessary, is
    // twenty times a second.
    interval: 50,

    // Gets the true hash value. Cannot use location.hash directly due to bug
    // in Firefox where location.hash will always be decoded.
    getHash: function(windowOverride) {
      var loc = windowOverride ? windowOverride.location : window.location;
      var match = loc.href.match(/#(.*)$/);
      return match ? match[1] : '';
    },

    // Get the cross-browser normalized URL fragment, either from the URL,
    // the hash, or the override.
    getFragment: function(fragment, forcePushState) {
      if (fragment == null) {
        if (this._hasPushState || forcePushState) {
          fragment = window.location.pathname;
          var search = window.location.search;
          if (search) fragment += search;
        } else {
          fragment = this.getHash();
        }
      }
      if (!fragment.indexOf(this.options.root)) fragment = fragment.substr(this.options.root.length);
      return fragment.replace(routeStripper, '');
    },

    // Start the hash change handling, returning `true` if the current URL matches
    // an existing route, and `false` otherwise.
    start: function(options) {
      if (History.started) throw new Error("Backbone.history has already been started");
      History.started = true;

      // Figure out the initial configuration. Do we need an iframe?
      // Is pushState desired ... is it available?
      this.options          = _.extend({}, {root: '/'}, this.options, options);
      this._wantsHashChange = this.options.hashChange !== false;
      this._wantsPushState  = !!this.options.pushState;
      this._hasPushState    = !!(this.options.pushState && window.history && window.history.pushState);
      var fragment          = this.getFragment();
      var docMode           = document.documentMode;
      var oldIE             = (isExplorer.exec(navigator.userAgent.toLowerCase()) && (!docMode || docMode <= 7));

      if (oldIE) {
        this.iframe = $('<iframe src="javascript:0" tabindex="-1" />').hide().appendTo('body')[0].contentWindow;
        this.navigate(fragment);
      }

      // Depending on whether we're using pushState or hashes, and whether
      // 'onhashchange' is supported, determine how we check the URL state.
      if (this._hasPushState) {
        $(window).bind('popstate', this.checkUrl);
      } else if (this._wantsHashChange && ('onhashchange' in window) && !oldIE) {
        $(window).bind('hashchange', this.checkUrl);
      } else if (this._wantsHashChange) {
        this._checkUrlInterval = setInterval(this.checkUrl, this.interval);
      }

      // Determine if we need to change the base url, for a pushState link
      // opened by a non-pushState browser.
      this.fragment = fragment;
      var loc = window.location;
      var atRoot  = loc.pathname == this.options.root;

      // If we've started off with a route from a `pushState`-enabled browser,
      // but we're currently in a browser that doesn't support it...
      if (this._wantsHashChange && this._wantsPushState && !this._hasPushState && !atRoot) {
        this.fragment = this.getFragment(null, true);
        window.location.replace(this.options.root + '#' + this.fragment);
        // Return immediately as browser will do redirect to new url
        return true;

      // Or if we've started out with a hash-based route, but we're currently
      // in a browser where it could be `pushState`-based instead...
      } else if (this._wantsPushState && this._hasPushState && atRoot && loc.hash) {
        this.fragment = this.getHash().replace(routeStripper, '');
        window.history.replaceState({}, document.title, loc.protocol + '//' + loc.host + this.options.root + this.fragment);
      }

      if (!this.options.silent) {
        return this.loadUrl();
      }
    },

    // Disable Backbone.history, perhaps temporarily. Not useful in a real app,
    // but possibly useful for unit testing Routers.
    stop: function() {
      $(window).unbind('popstate', this.checkUrl).unbind('hashchange', this.checkUrl);
      clearInterval(this._checkUrlInterval);
      History.started = false;
    },

    // Add a route to be tested when the fragment changes. Routes added later
    // may override previous routes.
    route: function(route, callback) {
      this.handlers.unshift({route: route, callback: callback});
    },

    // Checks the current URL to see if it has changed, and if it has,
    // calls `loadUrl`, normalizing across the hidden iframe.
    checkUrl: function(e) {
      var current = this.getFragment();
      if (current == this.fragment && this.iframe) current = this.getFragment(this.getHash(this.iframe));
      if (current == this.fragment) return false;
      if (this.iframe) this.navigate(current);
      this.loadUrl() || this.loadUrl(this.getHash());
    },

    // Attempt to load the current URL fragment. If a route succeeds with a
    // match, returns `true`. If no defined routes matches the fragment,
    // returns `false`.
    loadUrl: function(fragmentOverride) {
      var fragment = this.fragment = this.getFragment(fragmentOverride);
      var matched = _.any(this.handlers, function(handler) {
        if (handler.route.test(fragment)) {
          handler.callback(fragment);
          return true;
        }
      });
      return matched;
    },

    // Save a fragment into the hash history, or replace the URL state if the
    // 'replace' option is passed. You are responsible for properly URL-encoding
    // the fragment in advance.
    //
    // The options object can contain `trigger: true` if you wish to have the
    // route callback be fired (not usually desirable), or `replace: true`, if
    // you wish to modify the current URL without adding an entry to the history.
    navigate: function(fragment, options) {
      if (!History.started) return false;
      if (!options || options === true) options = {trigger: options};
      var frag = (fragment || '').replace(routeStripper, '');
      if (this.fragment == frag) return;

      // If pushState is available, we use it to set the fragment as a real URL.
      if (this._hasPushState) {
        if (frag.indexOf(this.options.root) != 0) frag = this.options.root + frag;
        this.fragment = frag;
        window.history[options.replace ? 'replaceState' : 'pushState']({}, document.title, frag);

      // If hash changes haven't been explicitly disabled, update the hash
      // fragment to store history.
      } else if (this._wantsHashChange) {
        this.fragment = frag;
        this._updateHash(window.location, frag, options.replace);
        if (this.iframe && (frag != this.getFragment(this.getHash(this.iframe)))) {
          // Opening and closing the iframe tricks IE7 and earlier to push a history entry on hash-tag change.
          // When replace is true, we don't want this.
          if(!options.replace) this.iframe.document.open().close();
          this._updateHash(this.iframe.location, frag, options.replace);
        }

      // If you've told us that you explicitly don't want fallback hashchange-
      // based history, then `navigate` becomes a page refresh.
      } else {
        window.location.assign(this.options.root + fragment);
      }
      if (options.trigger) this.loadUrl(fragment);
    },

    // Update the hash location, either replacing the current entry, or adding
    // a new one to the browser history.
    _updateHash: function(location, fragment, replace) {
      if (replace) {
        location.replace(location.toString().replace(/(javascript:|#).*$/, '') + '#' + fragment);
      } else {
        location.hash = fragment;
      }
    }
  });

  // Backbone.View
  // -------------

  // Creating a Backbone.View creates its initial element outside of the DOM,
  // if an existing element is not provided...
  var View = Backbone.View = function(options) {
    this.cid = _.uniqueId('view');
    this._configure(options || {});
    this._ensureElement();
    this.initialize.apply(this, arguments);
    this.delegateEvents();
  };

  // Cached regex to split keys for `delegate`.
  var delegateEventSplitter = /^(\S+)\s*(.*)$/;

  // List of view options to be merged as properties.
  var viewOptions = ['model', 'collection', 'el', 'id', 'attributes', 'className', 'tagName'];

  // Set up all inheritable **Backbone.View** properties and methods.
  _.extend(View.prototype, Events, {

    // The default `tagName` of a View's element is `"div"`.
    tagName: 'div',

    // jQuery delegate for element lookup, scoped to DOM elements within the
    // current view. This should be prefered to global lookups where possible.
    $: function(selector) {
      return this.$el.find(selector);
    },

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // **render** is the core function that your view should override, in order
    // to populate its element (`this.el`), with the appropriate HTML. The
    // convention is for **render** to always return `this`.
    render: function() {
      return this;
    },

    // Remove this view from the DOM. Note that the view isn't present in the
    // DOM by default, so calling this method may be a no-op.
    remove: function() {
      this.$el.remove();
      return this;
    },

    // For small amounts of DOM Elements, where a full-blown template isn't
    // needed, use **make** to manufacture elements, one at a time.
    //
    //     var el = this.make('li', {'class': 'row'}, this.model.escape('title'));
    //
    make: function(tagName, attributes, content) {
      var el = document.createElement(tagName);
      if (attributes) $(el).attr(attributes);
      if (content) $(el).html(content);
      return el;
    },

    // Change the view's element (`this.el` property), including event
    // re-delegation.
    setElement: function(element, delegate) {
      if (this.$el) this.undelegateEvents();
      this.$el = (element instanceof $) ? element : $(element);
      this.el = this.$el[0];
      if (delegate !== false) this.delegateEvents();
      return this;
    },

    // Set callbacks, where `this.events` is a hash of
    //
    // *{"event selector": "callback"}*
    //
    //     {
    //       'mousedown .title':  'edit',
    //       'click .button':     'save'
    //       'click .open':       function(e) { ... }
    //     }
    //
    // pairs. Callbacks will be bound to the view, with `this` set properly.
    // Uses event delegation for efficiency.
    // Omitting the selector binds the event to `this.el`.
    // This only works for delegate-able events: not `focus`, `blur`, and
    // not `change`, `submit`, and `reset` in Internet Explorer.
    delegateEvents: function(events) {
      if (!(events || (events = getValue(this, 'events')))) return;
      this.undelegateEvents();
      for (var key in events) {
        var method = events[key];
        if (!_.isFunction(method)) method = this[events[key]];
        if (!method) throw new Error('Method "' + events[key] + '" does not exist');
        var match = key.match(delegateEventSplitter);
        var eventName = match[1], selector = match[2];
        method = _.bind(method, this);
        eventName += '.delegateEvents' + this.cid;
        if (selector === '') {
          this.$el.bind(eventName, method);
        } else {
          this.$el.delegate(selector, eventName, method);
        }
      }
    },

    // Clears all callbacks previously bound to the view with `delegateEvents`.
    // You usually don't need to use this, but may wish to if you have multiple
    // Backbone views attached to the same DOM element.
    undelegateEvents: function() {
      this.$el.unbind('.delegateEvents' + this.cid);
    },

    // Performs the initial configuration of a View with a set of options.
    // Keys with special meaning *(model, collection, id, className)*, are
    // attached directly to the view.
    _configure: function(options) {
      if (this.options) options = _.extend({}, this.options, options);
      for (var i = 0, l = viewOptions.length; i < l; i++) {
        var attr = viewOptions[i];
        if (options[attr]) this[attr] = options[attr];
      }
      this.options = options;
    },

    // Ensure that the View has a DOM element to render into.
    // If `this.el` is a string, pass it through `$()`, take the first
    // matching element, and re-assign it to `el`. Otherwise, create
    // an element from the `id`, `className` and `tagName` properties.
    _ensureElement: function() {
      if (!this.el) {
        var attrs = getValue(this, 'attributes') || {};
        if (this.id) attrs.id = this.id;
        if (this.className) attrs['class'] = this.className;
        this.setElement(this.make(this.tagName, attrs), false);
      } else {
        this.setElement(this.el, false);
      }
    }

  });

  // The self-propagating extend function that Backbone classes use.
  var extend = function (protoProps, classProps) {
    var child = inherits(this, protoProps, classProps);
    child.extend = this.extend;
    return child;
  };

  // Set up inheritance for the model, collection, and view.
  Model.extend = Collection.extend = Router.extend = View.extend = extend;

  // Backbone.sync
  // -------------

  // Map from CRUD to HTTP for our default `Backbone.sync` implementation.
  var methodMap = {
    'create': 'POST',
    'update': 'PUT',
    'delete': 'DELETE',
    'read':   'GET'
  };

  // Override this function to change the manner in which Backbone persists
  // models to the server. You will be passed the type of request, and the
  // model in question. By default, makes a RESTful Ajax request
  // to the model's `url()`. Some possible customizations could be:
  //
  // * Use `setTimeout` to batch rapid-fire updates into a single request.
  // * Send up the models as XML instead of JSON.
  // * Persist models via WebSockets instead of Ajax.
  //
  // Turn on `Backbone.emulateHTTP` in order to send `PUT` and `DELETE` requests
  // as `POST`, with a `_method` parameter containing the true HTTP method,
  // as well as all requests with the body as `application/x-www-form-urlencoded`
  // instead of `application/json` with the model in a param named `model`.
  // Useful when interfacing with server-side languages like **PHP** that make
  // it difficult to read the body of `PUT` requests.
  Backbone.sync = function(method, model, options) {
    var type = methodMap[method];

    // Default options, unless specified.
    options || (options = {});

    // Default JSON-request options.
    var params = {type: type, dataType: 'json'};

    // Ensure that we have a URL.
    if (!options.url) {
      params.url = getValue(model, 'url') || urlError();
    }

    // Ensure that we have the appropriate request data.
    if (!options.data && model && (method == 'create' || method == 'update')) {
      params.contentType = 'application/json';
      params.data = JSON.stringify(model.toJSON());
    }

    // For older servers, emulate JSON by encoding the request into an HTML-form.
    if (Backbone.emulateJSON) {
      params.contentType = 'application/x-www-form-urlencoded';
      params.data = params.data ? {model: params.data} : {};
    }

    // For older servers, emulate HTTP by mimicking the HTTP method with `_method`
    // And an `X-HTTP-Method-Override` header.
    if (Backbone.emulateHTTP) {
      if (type === 'PUT' || type === 'DELETE') {
        if (Backbone.emulateJSON) params.data._method = type;
        params.type = 'POST';
        params.beforeSend = function(xhr) {
          xhr.setRequestHeader('X-HTTP-Method-Override', type);
        };
      }
    }

    // Don't process data on a non-GET request.
    if (params.type !== 'GET' && !Backbone.emulateJSON) {
      params.processData = false;
    }

    // Make the request, allowing the user to override any Ajax options.
    return $.ajax(_.extend(params, options));
  };

  // Wrap an optional error callback with a fallback error event.
  Backbone.wrapError = function(onError, originalModel, options) {
    return function(model, resp) {
      resp = model === originalModel ? resp : model;
      if (onError) {
        onError(originalModel, resp, options);
      } else {
        originalModel.trigger('error', originalModel, resp, options);
      }
    };
  };

  // Helpers
  // -------

  // Shared empty constructor function to aid in prototype-chain creation.
  var ctor = function(){};

  // Helper function to correctly set up the prototype chain, for subclasses.
  // Similar to `goog.inherits`, but uses a hash of prototype properties and
  // class properties to be extended.
  var inherits = function(parent, protoProps, staticProps) {
    var child;

    // The constructor function for the new subclass is either defined by you
    // (the "constructor" property in your `extend` definition), or defaulted
    // by us to simply call the parent's constructor.
    if (protoProps && protoProps.hasOwnProperty('constructor')) {
      child = protoProps.constructor;
    } else {
      child = function(){ parent.apply(this, arguments); };
    }

    // Inherit class (static) properties from parent.
    _.extend(child, parent);

    // Set the prototype chain to inherit from `parent`, without calling
    // `parent`'s constructor function.
    ctor.prototype = parent.prototype;
    child.prototype = new ctor();

    // Add prototype properties (instance properties) to the subclass,
    // if supplied.
    if (protoProps) _.extend(child.prototype, protoProps);

    // Add static properties to the constructor function, if supplied.
    if (staticProps) _.extend(child, staticProps);

    // Correctly set child's `prototype.constructor`.
    child.prototype.constructor = child;

    // Set a convenience property in case the parent's prototype is needed later.
    child.__super__ = parent.prototype;

    return child;
  };

  // Helper function to get a value from a Backbone object as a property
  // or as a function.
  var getValue = function(object, prop) {
    if (!(object && object[prop])) return null;
    return _.isFunction(object[prop]) ? object[prop]() : object[prop];
  };

  // Throw an error when a URL is needed, and none is supplied.
  var urlError = function() {
    throw new Error('A "url" property or function must be specified');
  };

}).call(this);

define("backbone", ["lodash","zepto"], (function (global) {
    return function () {
        return global.Backbone;
    }
}(this)));

define('app',[
  // Libs
  "zepto",
  "lodash",
  "backbone"
],

function($, _, Backbone) {
  // Localize or create a new JavaScript Template object.
  var JST = window.JST = window.JST || {};

  // Keep active application instances namespaced under an app object.
  return _.extend({

    // This is useful when developing if you don't want to use a
    // build process every time you change a template.
    //
    // Delete if you are using a different template loading method.
    fetchTemplate: function(path) {
      // Append the file extension.
      path += ".html";

      // Should be an instant synchronous way of getting the template, if it
      // exists in the JST object.
      if (!JST[path]) {
        // Fetch it asynchronously if not available from JST, ensure that
        // template requests are never cached and prevent global ajax event
        // handlers from firing.
        $.ajax({
          url: "/" + path,
          dataType: "text",
          cache: false,
          async: false,

          success: function(contents) {
            JST[path] = _.template(contents);
          }
        });
      }

      // Ensure a normalized return value.
      return JST[path];
    },

    // Create a custom object with a nested Views object
    module: function(additionalProps) {
      return _.extend({ Views: {} }, additionalProps);
    }

  // Mix Backbone.Events into the app object.
  }, Backbone.Events);
});

/**
 * @license RequireJS text 2.0.0 Copyright (c) 2010-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/requirejs/text for details
 */
/*jslint */
/*global require: false, XMLHttpRequest: false, ActiveXObject: false,
  define: false, window: false, process: false, Packages: false,
  java: false, location: false */

define('text',['module'], function (module) {
    

    var progIds = ['Msxml2.XMLHTTP', 'Microsoft.XMLHTTP', 'Msxml2.XMLHTTP.4.0'],
        xmlRegExp = /^\s*<\?xml(\s)+version=[\'\"](\d)*.(\d)*[\'\"](\s)*\?>/im,
        bodyRegExp = /<body[^>]*>\s*([\s\S]+)\s*<\/body>/im,
        hasLocation = typeof location !== 'undefined' && location.href,
        defaultProtocol = hasLocation && location.protocol && location.protocol.replace(/\:/, ''),
        defaultHostName = hasLocation && location.hostname,
        defaultPort = hasLocation && (location.port || undefined),
        buildMap = [],
        masterConfig = module.config(),
        text, fs;

    text = {
        version: '2.0.0',

        strip: function (content) {
            //Strips <?xml ...?> declarations so that external SVG and XML
            //documents can be added to a document without worry. Also, if the string
            //is an HTML document, only the part inside the body tag is returned.
            if (content) {
                content = content.replace(xmlRegExp, "");
                var matches = content.match(bodyRegExp);
                if (matches) {
                    content = matches[1];
                }
            } else {
                content = "";
            }
            return content;
        },

        jsEscape: function (content) {
            return content.replace(/(['\\])/g, '\\$1')
                .replace(/[\f]/g, "\\f")
                .replace(/[\b]/g, "\\b")
                .replace(/[\n]/g, "\\n")
                .replace(/[\t]/g, "\\t")
                .replace(/[\r]/g, "\\r");
        },

        createXhr: function () {
            //Would love to dump the ActiveX crap in here. Need IE 6 to die first.
            var xhr, i, progId;
            if (typeof XMLHttpRequest !== "undefined") {
                return new XMLHttpRequest();
            } else if (typeof ActiveXObject !== "undefined") {
                for (i = 0; i < 3; i++) {
                    progId = progIds[i];
                    try {
                        xhr = new ActiveXObject(progId);
                    } catch (e) {}

                    if (xhr) {
                        progIds = [progId];  // so faster next time
                        break;
                    }
                }
            }

            return xhr;
        },

        /**
         * Parses a resource name into its component parts. Resource names
         * look like: module/name.ext!strip, where the !strip part is
         * optional.
         * @param {String} name the resource name
         * @returns {Object} with properties "moduleName", "ext" and "strip"
         * where strip is a boolean.
         */
        parseName: function (name) {
            var strip = false, index = name.indexOf("."),
                modName = name.substring(0, index),
                ext = name.substring(index + 1, name.length);

            index = ext.indexOf("!");
            if (index !== -1) {
                //Pull off the strip arg.
                strip = ext.substring(index + 1, ext.length);
                strip = strip === "strip";
                ext = ext.substring(0, index);
            }

            return {
                moduleName: modName,
                ext: ext,
                strip: strip
            };
        },

        xdRegExp: /^((\w+)\:)?\/\/([^\/\\]+)/,

        /**
         * Is an URL on another domain. Only works for browser use, returns
         * false in non-browser environments. Only used to know if an
         * optimized .js version of a text resource should be loaded
         * instead.
         * @param {String} url
         * @returns Boolean
         */
        useXhr: function (url, protocol, hostname, port) {
            var match = text.xdRegExp.exec(url),
                uProtocol, uHostName, uPort;
            if (!match) {
                return true;
            }
            uProtocol = match[2];
            uHostName = match[3];

            uHostName = uHostName.split(':');
            uPort = uHostName[1];
            uHostName = uHostName[0];

            return (!uProtocol || uProtocol === protocol) &&
                   (!uHostName || uHostName === hostname) &&
                   ((!uPort && !uHostName) || uPort === port);
        },

        finishLoad: function (name, strip, content, onLoad) {
            content = strip ? text.strip(content) : content;
            if (masterConfig.isBuild) {
                buildMap[name] = content;
            }
            onLoad(content);
        },

        load: function (name, req, onLoad, config) {
            //Name has format: some.module.filext!strip
            //The strip part is optional.
            //if strip is present, then that means only get the string contents
            //inside a body tag in an HTML string. For XML/SVG content it means
            //removing the <?xml ...?> declarations so the content can be inserted
            //into the current doc without problems.

            // Do not bother with the work if a build and text will
            // not be inlined.
            if (config.isBuild && !config.inlineText) {
                onLoad();
                return;
            }

            masterConfig.isBuild = config.isBuild;

            var parsed = text.parseName(name),
                nonStripName = parsed.moduleName + '.' + parsed.ext,
                url = req.toUrl(nonStripName),
                useXhr = (masterConfig.useXhr) ||
                         text.useXhr;

            //Load the text. Use XHR if possible and in a browser.
            if (!hasLocation || useXhr(url, defaultProtocol, defaultHostName, defaultPort)) {
                text.get(url, function (content) {
                    text.finishLoad(name, parsed.strip, content, onLoad);
                }, function (err) {
                    if (onLoad.error) {
                        onLoad.error(err);
                    }
                });
            } else {
                //Need to fetch the resource across domains. Assume
                //the resource has been optimized into a JS module. Fetch
                //by the module name + extension, but do not include the
                //!strip part to avoid file system issues.
                req([nonStripName], function (content) {
                    text.finishLoad(parsed.moduleName + '.' + parsed.ext,
                                    parsed.strip, content, onLoad);
                });
            }
        },

        write: function (pluginName, moduleName, write, config) {
            if (buildMap.hasOwnProperty(moduleName)) {
                var content = text.jsEscape(buildMap[moduleName]);
                write.asModule(pluginName + "!" + moduleName,
                               "define(function () { return '" +
                                   content +
                               "';});\n");
            }
        },

        writeFile: function (pluginName, moduleName, req, write, config) {
            var parsed = text.parseName(moduleName),
                nonStripName = parsed.moduleName + '.' + parsed.ext,
                //Use a '.js' file name so that it indicates it is a
                //script that can be loaded across domains.
                fileName = req.toUrl(parsed.moduleName + '.' +
                                     parsed.ext) + '.js';

            //Leverage own load() method to load plugin value, but only
            //write out values that do not have the strip argument,
            //to avoid any potential issues with ! in file names.
            text.load(nonStripName, req, function (value) {
                //Use own write() method to construct full module value.
                //But need to create shell that translates writeFile's
                //write() to the right interface.
                var textWrite = function (contents) {
                    return write(fileName, contents);
                };
                textWrite.asModule = function (moduleName, contents) {
                    return write.asModule(moduleName, fileName, contents);
                };

                text.write(pluginName, nonStripName, textWrite, config);
            }, config);
        }
    };

    if (typeof process !== "undefined" &&
             process.versions &&
             !!process.versions.node) {
        //Using special require.nodeRequire, something added by r.js.
        fs = require.nodeRequire('fs');

        text.get = function (url, callback) {
            var file = fs.readFileSync(url, 'utf8');
            //Remove BOM (Byte Mark Order) from utf8 files if it is there.
            if (file.indexOf('\uFEFF') === 0) {
                file = file.substring(1);
            }
            callback(file);
        };
    } else if (text.createXhr()) {
        text.get = function (url, callback, errback) {
            var xhr = text.createXhr();
            xhr.open('GET', url, true);

            //Allow overrides specified in config
            if (masterConfig.onXhr) {
                masterConfig.onXhr(xhr, url);
            }

            xhr.onreadystatechange = function (evt) {
                var status, err;
                //Do not explicitly handle errors, those should be
                //visible via console output in the browser.
                if (xhr.readyState === 4) {
                    status = xhr.status;
                    if (status > 399 && status < 600) {
                        //An http 4xx or 5xx error. Signal an error.
                        err = new Error(url + ' HTTP status: ' + status);
                        err.xhr = xhr;
                        errback(err);
                    } else {
                        callback(xhr.responseText);
                    }
                }
            };
            xhr.send(null);
        };
    } else if (typeof Packages !== 'undefined') {
        //Why Java, why is this so awkward?
        text.get = function (url, callback) {
            var encoding = "utf-8",
                file = new java.io.File(url),
                lineSeparator = java.lang.System.getProperty("line.separator"),
                input = new java.io.BufferedReader(new java.io.InputStreamReader(new java.io.FileInputStream(file), encoding)),
                stringBuffer, line,
                content = '';
            try {
                stringBuffer = new java.lang.StringBuffer();
                line = input.readLine();

                // Byte Order Mark (BOM) - The Unicode Standard, version 3.0, page 324
                // http://www.unicode.org/faq/utf_bom.html

                // Note that when we use utf-8, the BOM should appear as "EF BB BF", but it doesn't due to this bug in the JDK:
                // http://bugs.sun.com/bugdatabase/view_bug.do?bug_id=4508058
                if (line && line.length() && line.charAt(0) === 0xfeff) {
                    // Eat the BOM, since we've already found the encoding on this file,
                    // and we plan to concatenating this buffer with others; the BOM should
                    // only appear at the top of a file.
                    line = line.substring(1);
                }

                stringBuffer.append(line);

                while ((line = input.readLine()) !== null) {
                    stringBuffer.append(lineSeparator);
                    stringBuffer.append(line);
                }
                //Make sure we return a JavaScript string and not a Java string.
                content = String(stringBuffer.toString()); //String
            } finally {
                input.close();
            }
            callback(content);
        };
    }

    return text;
});
define('text!templates/header.html',[],function () { return '<!--<a href="#" id="back-button">BACK</a>-->\n\n<a id="backbutton"><span>Back</span></a>\n\n<div id="flag">EUG Trials</div>\n\n<a href="/about" id="aboutbutton"><span>?</span></a>';});

define('text!templates/footer.html',[],function () { return '<div class="nav-wrapper">\n\t<div class="nav-button">\n\t\t<span class="nav-button-inner"><a href="/list">News</a></span>\n\t</div>\n\t<div class="nav-button">\n\t\t<span class="nav-button-inner"><a href="/schedule">Schedule</a></span>\n\t</div>\n\t<div class="nav-button">\n\t\t<span class="nav-button-inner"><a href="/photos">Fan Photos</a></span>\n\t</div>\n</div>';});

define('text!templates/schedule.html',[],function () { return '<div id="schedulewrapper">\n\n\t<ul>\n\t<li class="dateheader alternate">\n\t  Thursday, June 21\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">10:45 a.m.</div> \n\t  <div class="event">Hammer Throw</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Trials</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">1 p.m.</div> \n\t  <div class="event">Hammer Throw</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">3 p.m.</div> \n\t  <div class="event">Hammer Throw</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Trials</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">5 p.m.</div> \n\t  <div class="event">Hammer Throw</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="dateheader">\n\t  Friday, June 22\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">1 p.m.</div> \n\t  <div class="event">100m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Decathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">1:50 p.m.</div> \n\t  <div class="event">Long Jump</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Decathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">2:20 p.m.</div> \n\t  <div class="event">Discus Throw</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">3:05 p.m.</div> \n\t  <div class="event">Shot Put</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Decathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">3:10 p.m.</div> \n\t  <div class="event">400m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">1st Round</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">3:35 p.m.</div> \n\t  <div class="event">400m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">1st Round</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">4 p.m.</div> \n\t  <div class="event"></div>\n\t  <div>\n\t  <div class="gender"></div>\n\t  <div class="round"></div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">4:30 p.m.</div> \n\t  <div class="event">High Jump</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Decathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">5 p.m.</div> \n\t  <div class="event">800m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">1st Round</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">5:20 p.m.</div> \n\t  <div class="event">800m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">1st Round</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">5:30 p.m.</div> \n\t  <div class="event">Pole Vault</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">5:40 p.m.</div> \n\t  <div class="event">100m Hurdles</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">1st Round</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">5:45 p.m.</div> \n\t  <div class="event">Long Jump</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">6 p.m.</div> \n\t  <div class="event">100m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">6:30 p.m.</div> \n\t  <div class="event">400m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Decathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">6:45 p.m.</div> \n\t  <div class="event">10,000m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">7:20 p.m.</div> \n\t  <div class="event">10,000m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="dateheader">\n\t  Saturday, June 23\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">9:30 a.m.</div> \n\t  <div class="event">110m Hurdles</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Decathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">10:20 a.m.</div> \n\t  <div class="event">Discus Throw</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Decathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">12:30 p.m.</div> \n\t  <div class="event">Pole Vault</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Decathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">12:30 p.m.</div> \n\t  <div class="event">Javelin Throw</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">3 p.m.</div> \n\t  <div class="event">Shot Put</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">3 p.m.</div> \n\t  <div class="event">Javelin Throw</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Decathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">3:10 p.m.</div> \n\t  <div class="event"></div>\n\t  <div>\n\t  <div class="gender"></div>\n\t  <div class="round"></div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">3:15 p.m.</div> \n\t  <div class="event">100m Hurdles</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Semi-Finals</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">3:20 p.m.</div> \n\t  <div class="event">Triple Jump</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">3:40 p.m.</div> \n\t  <div class="event">100m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Semi-Finals</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">4 p.m.</div> \n\t  <div class="event">100m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">4:20 p.m.</div> \n\t  <div class="event">High Jump</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">4:30 p.m.</div> \n\t  <div class="event">800m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Semi-Finals</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">4:45 p.m.</div> \n\t  <div class="event">800m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Semi-Finals</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">5 p.m.</div> \n\t  <div class="event">400m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Semi-Finals</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">5:15 p.m.</div> \n\t  <div class="event">400m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Semi-Finals</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">5:30 p.m.</div> \n\t  <div class="event">1,500m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Decathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">5:45 p.m.</div> \n\t  <div class="event">100m Hurdles</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">5:52 p.m.</div> \n\t  <div class="event">100m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="dateheader">\n\t  Sunday, June 24\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">2:25 p.m.</div> \n\t  <div class="event">Pole Vault</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">2:30 p.m.</div> \n\t  <div class="event">100m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Semi-Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">2:55 p.m.</div> \n\t  <div class="event"></div>\n\t  <div>\n\t  <div class="gender"></div>\n\t  <div class="round"></div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">3 p.m.</div> \n\t  <div class="event">Long Jump</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">3:05 p.m.</div> \n\t  <div class="event">Discus Throw</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">3:30 p.m.</div> \n\t  <div class="event">Shot Put</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">4:20 p.m.</div> \n\t  <div class="event">400m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">4:35 p.m.</div> \n\t  <div class="event">400m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">4:48 p.m.</div> \n\t  <div class="event">100m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="dateheader">\n\t  Monday, June 25\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">3:30 p.m.</div> \n\t  <div class="event">Discus Throw</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">4:50 p.m.</div> \n\t  <div class="event">3,000m Steeplechase</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">5:20 p.m.</div> \n\t  <div class="event"></div>\n\t  <div>\n\t  <div class="gender"></div>\n\t  <div class="round"></div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">5:25 p.m.</div> \n\t  <div class="event">3,000m Steeplechase</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">5:30 p.m.</div> \n\t  <div class="event">Pole Vault</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">5:45 p.m.</div> \n\t  <div class="event">Triple Jump</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">5:50 p.m.</div> \n\t  <div class="event">High Jump</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">6 p.m.</div> \n\t  <div class="event">Javelin Throw</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">6:05 p.m.</div> \n\t  <div class="event">5,000m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">6:50 p.m.</div> \n\t  <div class="event">800m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">7 p.m.</div> \n\t  <div class="event">5,000m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">7:47 p.m.</div> \n\t  <div class="event">800m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="dateheader alternate">\n\t  Tuesday, June 26\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time"></div> \n\t  <div class="event"></div>\n\t  <div>\n\t  <div class="gender"></div>\n\t  <div class="round"></div>\n\t  </div>\n\t</li>\n\n\t<li class="dateheader alternate">\n\t  Wednesday, June 27\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time"></div> \n\t  <div class="event"></div>\n\t  <div>\n\t  <div class="gender"></div>\n\t  <div class="round"></div>\n\t  </div>\n\t</li>\n\n\t<li class="dateheader alternate">\n\t  Thursday, June 28\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">3:45 p.m.</div> \n\t  <div class="event"></div>\n\t  <div>\n\t  <div class="gender"></div>\n\t  <div class="round"></div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">4 p.m.</div> \n\t  <div class="event"></div>\n\t  <div>\n\t  <div class="gender"></div>\n\t  <div class="round"></div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">4:15 p.m.</div> \n\t  <div class="event"></div>\n\t  <div>\n\t  <div class="gender"></div>\n\t  <div class="round"></div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">4:20 p.m.</div> \n\t  <div class="event">1,500m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">4:30 p.m.</div> \n\t  <div class="event">Triple Jump</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">4:50 p.m.</div> \n\t  <div class="event">1,500m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">5 p.m.</div> \n\t  <div class="event">High Jump</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">5:05 p.m.</div> \n\t  <div class="event">Pole Vault</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">5:30 p.m.</div> \n\t  <div class="event">400m Hurdles</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">5:40 p.m.</div> \n\t  <div class="event">Shot Put</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">6 p.m.</div> \n\t  <div class="event">400m Hurdles</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">6:05 p.m.</div> \n\t  <div class="event">Discus Throw</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">6:30 p.m.</div> \n\t  <div class="event">3,000m Steeplechase</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">6:45 p.m.</div> \n\t  <div class="event">200m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">7:15 p.m.</div> \n\t  <div class="event">5,000m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">7:38 p.m.</div> \n\t  <div class="event">5,000m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="dateheader">\n\t  Friday, June 29\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">10:30 a.m.</div> \n\t  <div class="event">100m Hurdles</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Heptathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">11:30 a.m.</div> \n\t  <div class="event">High Jump</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Heptathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">1:15 p.m.</div> \n\t  <div class="event">Shot Put</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Heptathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">1:45 p.m.</div> \n\t  <div class="event">200m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">2:15 p.m.</div> \n\t  <div class="event">200m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Heptathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">2:30 p.m.</div> \n\t  <div class="event">Javelin Throw</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">2:35 p.m.</div> \n\t  <div class="event">Mile</div>\n\t  <div>\n\t  <div class="gender">Nike HS Girls</div>\n\t  <div class="round">Exhibition Event</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">2:45 p.m.</div> \n\t  <div class="event">Mile</div>\n\t  <div>\n\t  <div class="gender">Nike HS Boys</div>\n\t  <div class="round">Exhibition Event</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">2:55 p.m.</div> \n\t  <div class="event"></div>\n\t  <div>\n\t  <div class="gender"></div>\n\t  <div class="round"></div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">3 p.m.</div> \n\t  <div class="event">200m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Semi-Finals</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">3:20 p.m.</div> \n\t  <div class="event">400m Hurdles</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Semi-Finals</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">3:30 p.m.</div> \n\t  <div class="event">Shot Put</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">3:30 p.m.</div> \n\t  <div class="event">Long Jump</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">3:35 p.m.</div> \n\t  <div class="event">400m Hurdles</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Semi-Finals</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">3:45 p.m.</div> \n\t  <div class="event">1,500m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Semi-Finals</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">4:05 p.m.</div> \n\t  <div class="event">110m Hurdles</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Qualifying</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">4:25 p.m.</div> \n\t  <div class="event">1,500m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Semi-Finals</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">4:45 p.m.</div> \n\t  <div class="event">3,000m Steeplechase</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="dateheader alternate">\n\t  Saturday, June 30\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">7:30 a.m.</div> \n\t  <div class="event">20km Race Walk</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">3 p.m.</div> \n\t  <div class="event">Long Jump</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Heptathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">3:35 p.m.</div> \n\t  <div class="event">100m</div>\n\t  <div>\n\t  <div class="gender">Boys &amp; Girls</div>\n\t  <div class="round">Special Olympics</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">4:10 p.m.</div> \n\t  <div class="event"></div>\n\t  <div>\n\t  <div class="gender"></div>\n\t  <div class="round"></div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">4:15 p.m.</div> \n\t  <div class="event">Javelin Throw</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Heptathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">4:20 p.m.</div> \n\t  <div class="event">110m Hurdles</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Semi-Finals</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">4:40 p.m.</div> \n\t  <div class="event">Triple Jump</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">5 p.m.</div> \n\t  <div class="event">High Jump</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">5:20 p.m.</div> \n\t  <div class="event">200m</div>\n\t  <div>\n\t  <div class="gender">Boys &amp; Girls</div>\n\t  <div class="round">USATF Youth</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">5:40 p.m.</div> \n\t  <div class="event">400m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Masters</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">5:50 p.m.</div> \n\t  <div class="event">200m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Masters</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">6 p.m.</div> \n\t  <div class="event">200m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Semi-Finals</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">6:20 p.m.</div> \n\t  <div class="event">800m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Heptathlon</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">6:40 p.m.</div> \n\t  <div class="event">110m Hurdles</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">6:50 p.m.</div> \n\t  <div class="event">200m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="dateheader alternate">\n\t  Sunday, July 1\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">7:30 p.m.</div> \n\t  <div class="event">20km Race Walk</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">2:40 p.m.</div> \n\t  <div class="event"></div>\n\t  <div>\n\t  <div class="gender"></div>\n\t  <div class="round"></div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">2:45 p.m.</div> \n\t  <div class="event">Javelin Throw</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">3 p.m.</div> \n\t  <div class="event">Long Jump</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">4:02 p.m.</div> \n\t  <div class="event">400m Hurdles</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">4:12 p.m.</div> \n\t  <div class="event">400m Hurdles</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">4:23 p.m.</div> \n\t  <div class="event">1,500m</div>\n\t  <div>\n\t  <div class="gender">Women</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">4:37 p.m.</div> \n\t  <div class="event">1,500m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper">\n\t  <div class="time">4:50 p.m.</div> \n\t  <div class="event">200m</div>\n\t  <div>\n\t  <div class="gender">Men</div>\n\t  <div class="round">Final</div>\n\t  </div>\n\t</li>\n\n\t<li class="event-wrapper alternate">\n\t  <div class="time">4:55 p.m.</div> \n\t  <div class="event"></div>\n\t  <div>\n\t  <div class="gender"></div>\n\t  <div class="round"></div>\n\t  </div>\n\t</li>\n\t</ul>\n\n</div>';});

define('text!templates/loading.html',[],function () { return '<div id="loading">\n<h1>Loading...</h1>\n</div>';});

define('modules/story',[
  // Global application context.
  "app",
  "zepto", // TODO: remove. see L22 for the hide() which is awful
  // Third-party libraries.
  "backbone"
],

function(app, $, Backbone) {
  
  var Story = app.module();

  Story.Model = Backbone.Model.extend({
    // nothing yet
  });
  
  Story.Collection = Backbone.Collection.extend({
    model: Story.Model,
    url: 'http://dailyemerald.com/section/2012-olympic-trials/json?callback=?',
    parse: function(data) {

      data.forEach(function(story){
        //rewrite a smallThumbnail from the bigger one...
        if (typeof story.thumbnail === 'string') {
          var thumbnailRoot = story.thumbnail.split("-");
          thumbnailRoot.pop();
          story.smallThumbnail = thumbnailRoot.join("-") + "-150x150." + story.thumbnail.split('.').pop();
        } else {
          story.smallThumbnail = "http://dev.dailyemerald.com/emerald114.png"; //TODO: Where should this really go?
        }
        
        //rewrite the wordpress timestamp for 'timeago' relative time stuff
        story.timestamp = story.date.split(" ").join("T") + "Z";
        
      }); 

      console.log('Story.Collection: json data into parse:', data);

      return data;
    }
    
    
  });
    
///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////

  Story.Views.Master = Backbone.View.extend({
    template: "app/templates/story-master",
    tagName: "section",
    className: "page",

    initialize: function() {
      this.collection = app.StoryCollectionInstance;
      console.log("Story.View.List init, this.collection:", this.collection);
    
      this.collection.bind("reset", this.render, this);
    },

    render: function(done) {
      console.log('s v l: render: collection:', this.collection);
      // Fetch the template.
      var tmpl = app.fetchTemplate(this.template);

      // Set the template contents.
      this.$el.html(tmpl({ stories: this.collection.toJSON() }));
      //console.log(this.$el);
      $('time').timeago();
      
      return this;
    }
    
  });
  
  /*
  Story.Views.ListItem = Backbone.View.extend({
    tagName: 'li'
    className: 'story-list-item'
    template: "app/templates/story-list-item",
    
    render: function(done) {
      
    }
  });
  */


///////////////////////////////////////////////////////////////////////  
///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////

  
  // drill down into one story
  Story.Views.Detail = Backbone.View.extend({
    template: "app/templates/story-detail",
    tagName: "section",
    className: "page",

    initialize: function() {
      this.collection = app.StoryCollectionInstance;
      this.collection.bind('reset', this.render, this);
    },

    render: function(done) {
      // Fetch the template.
      //console.log('detail has this.id=',this.id);
      //console.log('this.collection in detail is', this.collection);
      
      this.model = this.collection.get(this.id);
      
      if (this.model) {

        //console.log('in story.views.detail', this.model);
        var tmpl = app.fetchTemplate(this.template);

        // Set the template contents.
        this.$el.html(tmpl({story: this.model.toJSON() }));
        $('time').timeago();
        
        return this;
      } else {
        //console.log('dont have a model yet in s v d');
        this.$el.html("Waiting for data...");
        return this;
      }
    }
  });
  

  //console.log('in story.js: ', Story);
  return Story;
});

define('modules/instagram',[
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

define('modules/schedule',[
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

define('modules/about',[
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

require([
  "app",

  // Libs
  "zepto",//"jquery",
  "backbone",
  //"masseuse",
  
  "text!templates/header.html",
  "text!templates/footer.html",
  "text!templates/schedule.html",
  "text!templates/loading.html",
  
  // Modules
  "modules/story",
  "modules/instagram",
  "modules/schedule",
  "modules/about"
],

function(app, $, Backbone, headerTemplate, footerTemplate, scheduleTemplate, loadingTemplate, Story, Instagram, Schedule, About) {

  // http://coenraets.org/blog/2012/01/backbone-js-lessons-learned-and-improved-sample-app/
  Backbone.View.prototype.close = function () {
      //console.log('close()-ing view:', this);
      if (this.beforeClose) {
          this.beforeClose();
      }
      this.remove();
      this.unbind();
      //console.log('post remove/unbind:', this);
  };

  app.pageHistory = [];
  app.allowClick = true;

  window.log = function(data) { // TODO: less hacky than the window bind?
    var urlBase = "http://dev.dailyemerald.com:4321/log/";
    $.ajaxJSONP({
      url: urlBase + JSON.stringify(data)
    });
  };

  // Defining the application router, you can attach sub routers here.
  var Router = Backbone.Router.extend({
    routes: {
      "": "storyMaster",
      "list": "storyMaster",
      "story/:id": "storyDetail",
      "schedule": "schedule",
      "photos": "instagram",
      "twitter": "twitter",
      "about" :"about",
      "*other": "gohome"
    },
    
    initialize: function(options){
      this.main = $('#main'); // cache the selector. is this useful?
      //this.pageWidth = window.innerWidth;
      //this.pageDirection = 1;
    },
    
    // http://coenraets.org/blog/2012/01/backbone-js-lessons-learned-and-improved-sample-app/
    showView: function(newView) {
      
      var pathname = window.location.pathname;
    
      log({
        "action": "showView", 
        "timestamp": new Date(), 
        "pathname": pathname
      });//TODO: hack
    
      if (this.currentView) {
        console.log('closing', this.currentView);
        this.currentView.close();
      }
      this.currentView = null;
    
      var newViewDOM = newView.render().$el;
      this.main.html(newViewDOM);
      
      if (pathname in app.ScrollPositions) {
        window.scrollTo(0, 1 + app.ScrollPositions[pathname]); 
      } else {
        window.scrollTo(0, 1);
        app.ScrollPositions[pathname] = 0;
      }
      //this.main.find('img').hide();
      //setTimeout(function() {
        console.log('calling timeago');
        $('time').timeago();  
      //}, 5);
      
      /*
      this.main.find('img').forEach(function($el) {
        $el.attr('src',$el.attr('data-img'));
      });
      */

      /*
      var self = this;
        
      this.main.animate({opacity: 0}, 100, 'linear', function() {
    
        $(this).html(newViewDOM); //$(this) is $("#main") (right?)
        
        if (self.currentView) {
          console.log('closing', self.currentView);
          self.currentView.close();
        }
        self.currentView = null;
        
        if (pathname in app.ScrollPositions) {
          window.scrollTo(0, 1 + app.ScrollPositions[pathname]); 
        } else {
          window.scrollTo(0, 1);
          app.ScrollPositions[pathname] = 0;
        }
        
        $('time').timeago();
        //app.allowClick = true;

        $(this).animate({opacity: 1}, 100, 'linear', function() {
          console.log('done');
          
          self.currentView = newView;
          
        });
        
        
    
      });
      */  
     

      
      
      /*while ($("#main").children().length > 1) {
        $("#main").children().eq(0).remove();
        console.log("blam!");
      }
      */
      
        
      //},1);
      /*$('img').css({opacity: 0});
      $('#main').css({opacity: 0}).show();
      
      $('#main').animate(  {translate3d: '0,0,0', opacity: 0}, 0,  'linear', function() {
        $('#main:not(img)').animate({translate3d: '0,0,0', opacity: 1}, 50, 'linear', function() {
          $('img').animate({translate3d: '0,0,0', opacity: 1}, 1000, 'linear')
        });  
      });
      */

      
    
    },
    
    storyMaster: function() {

      //this.pageDirection = -1;
      var list = new Story.Views.Master({ });   
      this.showView(list);
    
    },
    
    storyDetail: function(id) {
      //this.pageDirection = 1;

      var detail = new Story.Views.Detail({ id: id });
      this.showView(detail);
    },
    
    schedule: function() {      
      var view_ = new Schedule.Views.Master();
      this.showView(view_);
    },
    
    instagram: function() {
      var view_ = new Instagram.Views.Master();
      this.showView(view_);
    },
   
    gohome: function() {
      console.log('well, this is weird. to /');
      Backbone.history.navigate('/', true);
    },
    
    about: function() {
      var view_ = new About.Views.Master();
      this.showView(view_);
    }
    
  });

  // Treat the jQuery ready function as the entry point to the application.
  // Inside this function, kick-off all initialization, everything up to this
  // point should be definitions.
  $(function() {

    $("header").html(headerTemplate);
    $("footer").html(footerTemplate);
    //$("body").append(loadingTemplate);
    $("#backbutton").css({opacity:0});
    $("#backbutton").on('tap', function(evt) {
      console.log('backbutton tap');
      
      log({
        "action": "backbutton", 
        "timestamp": new Date()
      });//TODO: hack
      
      if (app.pageHistory.length > 0) {
        evt.preventDefault();
        window.history.back();

        //Backbone.history.navigate(lastPage, true);
        //app.pageHistory.pop();
        //window.history.back();
        if (app.pageHistory.length === 0) {
          //$("#backbutton").css({opacity:0});
        }
      } 
    });

   // $("#info").hide();

    app.ScrollPositions = {};

    // spin up the collection instance for stories. TODO: this feels like the wrong spot to have this. why?
    app.StoryCollectionInstance = new Story.Collection();
    app.StoryCollectionInstance.fetch();        
    app.router = new Router();
    
    //setTimeout(function() { window.scrollTo(0,1); }, 1);
    
    Backbone.history.start({ pushState: true });
  });
  
  // All navigation that is relative should be passed through the navigate
  // method, to be processed by the router.  If the link has a data-bypass
  // attribute, bypass the delegation completely.
  //$(document).on(mobileTapEvent, "a:not([data-bypass])", function(evt) {
  $(document).on('tap','a:not([data-bypass])', function(evt) {
    //console.log('inside', mobileTapEvent, "handler");
 
    var href = $(this).attr("href");
    var protocol = this.protocol + "//";

    if (href && href.slice(0, protocol.length) !== protocol && href.indexOf("javascript:") !== 0) {
      //$("#loading").show();
      evt.preventDefault();      
      
      if (app.allowClick === true) {
        
        app.allowClick = false;
        setTimeout(function() {
          app.allowClick = true; // TODO: seems way hacky.
        }, 450);
        
        app.pageHistory.push(href);
      
        if ($('#backbutton').css('opacity') < 1) {
          $('#backbutton').animate({opacity:1}, 500, 'linear');
        }
      
        app.ScrollPositions[window.location.pathname] = document.body.scrollTop;
      
        console.log('pageHistory:',app.pageHistory);
        
        log({
          "action": "tap", 
          "timestamp": new Date(), 
          "href": href
        });//TODO: hack
        
        Backbone.history.navigate(href, true);
      } else {
        console.log('allowClick false, but tap here...', href);
      }
    } 
      
  });
  
  // if we don't have a touchstart, make a click trigger a tap. because we're not on a mobile device that supports it. right?
  if (!('touchstart' in window)) {
    $(document).on('click', 'body', function(evt) {
      $(evt.target).trigger('tap');
      evt.preventDefault();
    });
  } else {
    $(document).on('click', 'body', function(evt) {
      evt.preventDefault();
      alert('got a click, even though weve got touchstart...');
      return false;
    });
  }

});

define("main", function(){});

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

define("config", function(){});
