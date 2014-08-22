var request = require("request");

if (process.env.PING_URL) {
  request(process.env.PING_URL, function(error, response, body) {
    console.log(response);
  });
}