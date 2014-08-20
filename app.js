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

// Retrieve latest posts
app.get("/posts", function(req, res) {
  var listings = [];

  if (previousListingsFull.length > 0) {
    listings = previousListingsFull.slice(0, 49);
  }

  res.json(listings);
});

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
var previousListings = [];
var previousListingsFull = [];
var scrapeTimeout = 2000;

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
    options.headers["If-None-Match"] = etag.replace('"', '');
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
    
    // Non-200 response
    if (response.statusCode && response.statusCode != 200) {
      if (!silent) console.log("Not HTTP 200 on /v1/posts");
      if (!silent) console.log("Status code: " + response.statusCode);
      setImmediate(callback);
      return;
    }

    var etagPrev = etag;

    if (!response.headers["etag"]) {
      if (!silent) console.log("ETag header not found on /v1/posts");
      setImmediate(callback);
      return;
    } else {
      if (!silent) console.log("ETag header found on /v1/posts: " + response.headers["etag"]);
      etag = response.headers["etag"];
    }

    if (etag == etagPrev) {
      if (!silent) console.log("ETag header is identical to last request, ignoring content");
      setImmediate(callback);
      return;
    }

    try {
      if (body.posts && body.posts.length > 0) {
        // Sort by ID - oldest to newest
        body.posts.sort(function(a, b) {
          if (a.id < b.id) {
            return -1;
          }

          if (a.id > b.id) {
            return 1;
          }

          return 0;
        });

        processListings(body.posts);
        
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
      }, scrapeTimeout);
    });
  } catch(e) {
    if (!silent) console.log("Error");
    if (!silent) console.log(e);

    scrapeTimer = setTimeout(function() {
      scrapeListings();
    }, scrapeTimeout);
  };
};

// TODO: Identify and process changes in comments and upvotes
// As per: https://github.com/producthunt/producthunt-api/issues/8#issuecomment-52677116
var processListings = function(listings) {
  if (!silent) console.log("processListings()");

  var count = 0;

  _.each(listings, function(listing, index) {
    // Look for existing listing
    if (previousListings.length === 0 || previousListings.indexOf(listing.id) < 0) {
      if (!silent) console.log("Adding listing to previous listings");
      
      previousListings.unshift(listing.id);
      previousListingsFull.unshift(listing);

      // Cap previous listings
      if (previousListings.length > 200) {
        if (!silent) console.log("Cropping previous listings");
        previousListings.splice(199);
        previousListingsFull.splice(199);
      }

      if (!silent) console.log("Triggering message on Pusher");
      pusher.trigger(["ph-posts"], "new-post", listing);
      count++;
    }
  });

  // Current time for stats
  var statsTime = new Date();

  // New minute
  if (!stats.overall.past24.lastTime || stats.overall.past24.lastTime.getHours() != statsTime.getHours()) {
    if (!silent) console.log("Adding to new stats minute");

    stats.overall.past24.data.unshift(count);
    stats.overall.past24.total += count;

    // Crop array to last 24 hours
    if (stats.overall.past24.data.length > 24) {
      if (!silent) console.log("Cropping stats array for past 24 hours");

      // Crop
      var removed = stats.overall.past24.data.splice(23);

      // Update total
      _.each(removed, function(value) {
        stats.overall.past24.total -= value;
      });
    }

    stats.overall.past24.lastTime = statsTime;
  } else {
    // Add to most recent minute
    if (!silent) console.log("Adding to existing stats minute");
    stats.overall.past24.data[0] += count;
    stats.overall.past24.total += count;
  }

  if (!silent) console.log(count + " new listings");
};

scrapeListings();