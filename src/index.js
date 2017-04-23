#!/usr/bin/env node

// @flow

import program from "commander";

import deploy from "./commands/deploy";
import listSites from "./commands/list_sites";
import config from "./config";

const chalk = require("chalk");
const updateNotifier = require("update-notifier");
const pkg = require("../package.json");
updateNotifier({ pkg }).notify();

const usage =
  "[options] [command]\n\n" +
  chalk.bold("    The fastest hosting service for JavaScript Apps\n\n") +
  "    https://www.roast.io/";

// a hack to force name, waiting for https://github.com/tj/commander.js/pull/605
program._name = "roast";

program.version(pkg.version).usage(usage);

program
  .command("deploy")
  // .alias('it')
  .action(config.wrap(program, deploy.cmd));

program
  .command("sites")
  // .alias('it')
  .action(config.wrap(program, listSites.cmd));

if (!process.argv.slice(2).length) {
  program.outputHelp();
} else {
  program.parse(process.argv);
}
