var _ = require("underscore");
var request = require("request");

var silent = false;

var config;
try {
  config = require("./config");
} catch(e) {
  if (!silent) console.log("Failed to find local config, falling back to environment variables");
  config = {
    producthunt_token: process.env.PRODUCTHUNT_TOKEN,
    pusher_app_id: process.env.PUSHER_APP_ID,
    pusher_key: process.env.PUSHER_APP_KEY,
    pusher_secret: process.env.PUSHER_APP_SECRET,
    sentry_dsl: process.env.SENTRY_DSL
  }
}

var express = require("express");
var bodyParser = require("body-parser");
var errorHandler = require("errorhandler");

var app = express();


// --------------------------------------------------------------------
// EXCEPTION HANDLER
// --------------------------------------------------------------------

process.on('uncaughtException', function(err) {
  if (!silent) console.log("Attempting to restart scraper");

  if (!silent) console.log("Aborting previous request");
  if (scrapeRequest) {
    scrapeRequest.abort();
  }

  scrapeListings();
});


// --------------------------------------------------------------------
// SET UP PUSHER
// --------------------------------------------------------------------
var Pusher = require("pusher");
var pusher = new Pusher({
  appId: config.pusher_app_id,
  key: config.pusher_key,
  secret: config.pusher_secret
});


// --------------------------------------------------------------------
// SET UP EXPRESS
// --------------------------------------------------------------------

// Parse application/json and application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());

// Get stats for past 24 hours
// app.get("/stats/24hours.json", function(req, res, next) {
//   var output = {
//     item: [
//       {
//         text: "Past 24 hours",
//         value: stats.overall.past24.total
//       },
//       JSON.parse(JSON.stringify(stats.overall.past24.data)).reverse()
//     ]
//   };

//   res.json(output);
// });

// Sentry
// app.use(raven.middleware.express(ravenClient));

// Simple logger
app.use(function(req, res, next){
  if (!silent) console.log("%s %s", req.method, req.url);
  if (!silent) console.log(req.body);
  next();
});

// Error handler
app.use(errorHandler({
  dumpExceptions: true,
  showStack: true
}));

// Open server on specified port
if (!silent) console.log("Starting Express server");
app.listen(process.env.PORT || 5001);


// --------------------------------------------------------------------
// PRODUCT HUNT
// --------------------------------------------------------------------

var scrapeTimer;
var scrapeRequest;
var etag;
var lastId;

var stats = {
  overall: {
    past24: {
      total: 0,
      lastTime: null,
      // Per-hour, with anything after 24-hours removed
      data: []
    }
  }
};

var getNewListings = function(callback) {
  if (!silent) console.log("getNewListings()");

  var url = "https://api.producthunt.com/v1/posts";

  var options = {
    url: url,
    auth: {
      bearer: config.producthunt_token
    },
    headers: {
      "User-Agent": "realtime-producthunt/0.0.1 by Pusher"
    },
    json: true,
    // gzip: true,
    timeout: 10000
  };

  if (etag) {
    options.headers["If-None-Match"] = etag;
  }

  if (!silent) console.log("Requesting new listings");
  scrapeRequest = request(options, function(error, response, body) {
    if (!silent) console.log("New listings request callback");

    if (error) {
      if (!silent) console.log("New listings request error");
      console.log(error);
      if (!silent) console.log(response);

      setImmediate(callback);
      return;
    }
    
    // Re-authenticate
    if (response.statusCode && response.statusCode != 200) {
      if (!silent) console.log("Not HTTP 200 on /v1/posts");
      if (!silent) console.log("Status code: " + response.statusCode);
      setImmediate(callback);
      return;
    }

    if (!response.headers["etag"]) {
      if (!silent) console.log("ETag header not found on /v1/posts");
      setImmediate(callback);
      return;
    } else {
      if (!silent) console.log("ETag header found on /v1/posts: " + response.headers["etag"]);
      etag = response.headers["etag"];
    }

    try {
      if (body.posts && body.posts.length > 0) {
        console.log(body.posts.length);
        // processListings(body.posts);

        // Check this is actually the last ID, or is it the first?
        lastId = body.posts[0].id;
      }
    } catch(e) {
      setImmediate(callback);
      return;
    }

    setImmediate(callback);
  });
};

var scrapeListings = function() {
  if (!silent) console.log("------------------------------------------");
  if (!silent) console.log(new Date().toString());
  if (!silent) console.log("scrapeListings()");
  try {
    if (!silent) console.log("Clearing scrape timer");
    clearTimeout(scrapeTimer);

    getNewListings(function() {
      if (!silent) console.log("Starting scrape timer");
      scrapeTimer = setTimeout(function() {
        scrapeListings();
      }, 2000);
    });
  } catch(e) {
    if (!silent) console.log("Error");
    if (!silent) console.log(e);

    scrapeTimer = setTimeout(function() {
      scrapeListings();
    }, 2000);
  };
};

scrapeListings();


// var options = {
//   url: "https://api.producthunt.com/v1/posts?" + Date.now(),
//   // method: "HEAD",
//   auth: {
//     bearer: config.producthunt_token
//   },
//   json: true,
//   timeout: 10000
// };

// request(options, function(error, response, body) {
//   if (error) {
//     if (!silent) console.log("GET /posts request error");
//     console.log(error);
//     return;
//   }

//   console.log(response.headers);
//   console.log(new Date(body.posts[0].created_at), body.posts[0].name);
//   console.log(new Date(body.posts[body.posts.length-1].created_at), body.posts[body.posts.length-1].name);
// });