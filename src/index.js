#!/usr/bin/env node

// @flow

const program = require("commander");
const deploy = require("./commands/deploy");
const listSites = require("./commands/list_sites");
const config = require("./config");

const chalk = require("chalk");
const updateNotifier = require("update-notifier");
const pkg = require("../package.json");
updateNotifier({ pkg }).notify();

const authEnvVar =
  "    - set ROAST_TOKEN env var for authentication in\n      CI environments otherwise a prompt will force\n      you through an auth flow that will persist a\n      token in ~/.roast/config)";

const usage =
  "[options] [command]\n\n" +
  `${authEnvVar}\n\n` +
  chalk.bold("    The fastest hosting service for JavaScript Apps\n\n") +
  "    https://www.roast.io/";

// a hack to force name, waiting for https://github.com/tj/commander.js/pull/605
program._name = "roast";

program.version(pkg.version).usage(usage);

const deployUsage = "[options]\n\n" + `${authEnvVar}`;

program
  .command("deploy")
  .usage(deployUsage)
  .option("-s --site-id [id]", "Deploy to site with <id>")
  .option("-p --path [path]", "Path to a directory to deploy")
  .action(config.wrap(program, deploy.cmd));

program.command("sites").action(config.wrap(program, listSites.cmd));

if (!process.argv.slice(2).length) {
  program.outputHelp();
} else {
  program.parse(process.argv);
}

// inexplicably... without this, this CLI when run after npm install -g
// (but NOT from actual source directory), exits with code 130
// but with this, it exits with 0... but the console.log statement is
// not printed - can't explain it
process.on("SIGINT", function() {
  console.log("\nGracefully shutting down from SIGINT (Ctrl+C)");

  process.exit();
});
