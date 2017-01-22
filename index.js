/**
 * Copyright 2016 Kaustav Das Modak
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var fs = require("fs");
var mkdirp = require('mkdirp');
var nunjucks = require("nunjucks");
var path = require("path");
var url = require("url");

var config = {};

var defaultTemplate =
        "<!DOCTYPE HTML><html><head><meta charset='UTF-8'><title>Redirecting... Page moved</title>" +
        "<link rel='canonical' href='{{ item.to }}'><meta http-equiv=refresh content='0; url={{ item.to }}'></head>" +
        "<body><h1>Redirecting... Page moved...</h1>" +
        "<p><a href='{{ item.to }}'>Click here if you are not redirected</a></p>" +
        "<script>window.location.href='{{ item.to }}';</script>" +
        "</body></html>";

var getConfig = function(book) {
  var key = book.output.root();

  if (!config[key]) {
    config[key] = Object.assign(
      {},
      { basepath: "/",
        templateFile: "redirect.html",
        allowRelative: false,
        redirectsFile: "redirects.json",
        redirects: []
      },
      book.config.get("pluginsConfig.bulk-redirect"));
  }

  return config[key];
}

var validRedirect = function(item) {
  return (item.from && item.to);
}

var writeFile = function(book, conf, item) {
  var resolved = url.resolve(conf.basepath, item.to);

  var ctx = {
    book: book,
    item: Object.assign({}, item, {to: resolved})
  }

  var content = nunjucks.renderString(conf.template, ctx);

  var filename = path.join(book.output.root(), item.from);
  var outsideRoot = (path.relative(book.output.root(), filename)[0,3] == '../');

  if (outsideRoot && !conf.allowRelative)
    throw "Relative paths disabled";

  mkdirp.sync(path.dirname(filename));
  fs.writeFileSync(filename, content);

  book.log.debug("Redirect " + item.from + " -> " + resolved + "\n");
}

module.exports = {
  hooks: {
    "init": function() {
      var g = this;
      var conf = getConfig(this);

      return this.readFileAsString(conf.templateFile)

      .catch(function() {})

      .then(function(data) {
        conf.template = ( data || defaultTemplate );

        return g.readFileAsString(conf.redirectsFile)
      })

      .catch(function() {})

      .then(function(data) {
        var json = JSON.parse(data || "{}");

        if (json && json.redirects)
          conf.redirects = json.redirects.filter(validRedirect);
      })

      .then(function() {
        g.log.info.ln( "found " + conf.redirects.length + " redirects");
      })
    },

    "finish": function() {
      var conf = getConfig(this);
      var g = this;

      conf.redirects.forEach(function (item) {
        writeFile(g, conf, item);
      });
    }
  }
};
