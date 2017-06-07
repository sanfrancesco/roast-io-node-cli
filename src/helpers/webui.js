const join = require("path").join;
const open = require("open");
const chalk = require("chalk");

var WEBUI = process.env.ROAST_WEB_UI || "https://roast.io";

exports.open = function(path) {
  const url = WEBUI + join("", path);
  const p = open(url);

  return new Promise(function(resolve, reject) {
    p.on("exit", function(code) {
      if (parseInt(code) > 0) {
        console.log(
          "Please visit this authentication URL in your browser:\n  " +
            chalk.bold(url)
        );
      } else {
        console.log("Opening " + chalk.bold(url));
      }

      resolve(code);
    });
  });
};
