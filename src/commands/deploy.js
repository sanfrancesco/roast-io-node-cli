const chalk = require("chalk");
const inquirer = require("inquirer");
const fs = require("fs");
const confirm = require("../helpers/confirm");
const sitePicker = require("../helpers/site_picker");
const errorLogger = require("../helpers/error_logger");

// const spinner = [
//   '/ Processing',
//   '| Processing',
//   '\\ Processing',
//   '- Processing'
// ];

const spinner = ["◐", "◓", "◑", "◒"];

function getSpinner(state, idx) {
  var spinnerIcon = spinner[idx % spinner.length];

  const displayState = state === "prerendering"
    ? "server side rendering"
    : state;

  return spinnerIcon + `  ${displayState}  `;
}

/* Warnings about typical gotchas for deploying the root dir */
const fileChecksCWD = {
  "_config.yml":
    "It looks like this folder is a Jekyll site, but you're deploying the root\n" +
      "directory directly.\n" +
      "Unless this is what you intend to do, you might want to run " +
      chalk.bold("jekyll build") +
      " and\n" +
      "deploy the " +
      chalk.bold("_site") +
      " folder.",
  node_modules:
    "It looks like there's a node_modules folder in the directory you're deploying.\n" +
      "Try to avoid deploying all your node dependencies since most of these will be\n" +
      "server-side libraries, and instead use a build tool to copy just the relevant\n" +
      "files into a folder that only has front-end libraries.",
  "Gruntfile.js":
    "It looks like this is a Grunt based project, but you're deploying the root\n" +
      "directory directly.\n" +
      "Unless this is what you intend to do, you might want to run " +
      chalk.bold("grunt build") +
      " and\n" +
      "deploy the " +
      chalk.bold("dist") +
      " folder.",
  "gulpfile.js":
    "It looks like this is a Gulp based project, but you're deploying the root\n" +
      "directory directly.\n" +
      "Unless this is what you intend to do, you might want to run " +
      chalk.bold("gulp build") +
      " and\n" +
      "deploy the " +
      chalk.bold("dist") +
      " folder."
};

function withPath(config, cmd) {
  var path = config.getPath(cmd);

  if (path) {
    return Promise.resolve(path);
  } else {
    return inquirer
      .prompt({ name: "path", message: "Path to deploy? (current dir)" })
      .then(function(result) {
        return result.path || process.cwd();
      });
  }
}

function sanityCheck(config) {
  return function(path) {
    if (!config.existing && path === process.cwd()) {
      for (var file in fileChecksCWD) {
        if (fs.existsSync(file)) {
          return confirm.withWarning(path, fileChecksCWD[file]);
        }
      }
    }
    return Promise.resolve(path);
  };
}

exports.cmd = function(config, cmd) {
  const siteId = config.getSiteId(cmd);
  let sitePromise = null;

  if (siteId) {
    sitePromise = config.client.site(siteId);
  } else {
    sitePromise = inquirer
      .prompt([
        {
          name: "confirm",
          type: "confirm",
          message: "No site id specified, create a new site"
        }
      ])
      .then(function(result) {
        if (result.confirm) {
          return config.client.createSite({});
        }
        return sitePicker.pickSite(config.client, {});
      });
  }

  sitePromise
    .then(function(site) {
      return withPath(config, cmd)
        .then(sanityCheck(config))
        .then(function(path) {
          var options = {};
          var ui = null;
          var uploaded = 0;

          ui = new inquirer.ui.BottomBar();

          options.draft = cmd.draft;
          options[path.match(/\.zip$/) ? "zip" : "dir"] = path;

          options.progress = function(event, data) {
            if (ui == null) {
              return;
            }
            if (event === "start" && data.total) {
              ui &&
                ui.updateBottomBar(
                  "[                                        ] Uploading"
                );
            }
            if (event === "upload") {
              uploaded++;
              var progress = "[";
              for (var i = 0; i < 40; i++) {
                if (i <= 40 * uploaded / data.total) {
                  progress += "=";
                } else {
                  progress += " ";
                }
              }
              progress += "] Uploading";
              ui.updateBottomBar(progress);
            }
          };

          console.log(
            `🔥  Roasting deploy from ${(options.dir && "folder") ||
              "zip"} ${chalk.bold(path)}`
          );
          return site.createDeploy(options).then(function(deploy) {
            config.writeLocalConfig({ site_id: site.id, path: path });

            if (ui && uploaded > 1) {
              ui &&
                ui.updateBottomBar(
                  "[========================================] Uploading"
                );
            }
            // this runs in parallel to the code updating the
            // file upload progress UI (so just leave it running
            // while adding any other indicators)
            let lastState;
            if (ui) {
              var i = 0;
              var spin = setInterval(function() {
                if (
                  !process.env.CI ||
                  (process.env.CI && deploy.state !== lastState)
                ) {
                  ui.updateBottomBar(getSpinner(deploy.state, i++));
                  lastState = deploy.state;
                }
              }, 130);
            }

            return deploy.waitForReady().then(function(deploy) {
              if (ui) {
                ui.updateBottomBar("");
                clearInterval(spin);
              }
              if (cmd.draft) {
                console.log(
                  "\nDraft deploy " +
                    chalk.bold(deploy.id) +
                    ":\n  " +
                    chalk.bold(deploy.deploy_url)
                );
                process.exit(0);
              } else {
                console.log(`\n☕  ${chalk.bold("Deploy roasted!")}`);
                console.log(`\n✨  ${chalk.bold(deploy.url)}`);
                // console.log('\nDeploy is live (permalink):\n  ' + chalk.bold(deploy.deploy_url));
                // console.log('\nLast build is always accessible on ' + chalk.bold(deploy.url));
                process.exit(0);
              }
            });
          });
        });
    })
    .catch(function(err) {
      console.log(err);
      errorLogger.log("\nError during deploy: ", err);
      process.exit(1);
    });
};
