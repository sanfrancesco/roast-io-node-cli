var chalk = require("chalk");

exports.log = function(prefix, error) {
  // for showing a "stack trace" of HTTP requests
  var requestsMade;
  if (error.client && error.client.requestsMade) {
    requestsMade = error.client.requestsMade;
  }

  var msg;
  if (typeof error === "string") {
    msg = error;
  } else if (error.message) {
    msg = error.message;
  } else if (error.data) {
    var data;
    try {
      data = JSON.parse(error.data);
      if (!data.message) {
        // for field errors: {"files":"must be present"}
        var fieldErrors = [];
        Object.keys(data).forEach(key => {
          fieldErrors.push(`'${key}' ${data[key]}`);
        });
        data.message = fieldErrors.join(",");
      }
    } catch (err) {
      // for strings: "Authentication failed"
      data = error.data;
    }
    msg = (data && data.message) || data;
  } else {
    msg = error.toString();
  }

  console.log(prefix, chalk.bold(msg));

  if (requestsMade) {
    console.log('\nHTTP requests:')
    requestsMade.reverse().forEach(function(request) {
      console.log(' -', chalk.bold(request.method.toUpperCase()), request.path);
    })
  }

};
