#!/usr/bin/env node

// @flow

import program from 'commander';

import deploy from './commands/deploy';
import listSites from './commands/list_sites';
import config from './config';

const updateNotifier = require('update-notifier');
const pkg = require('../package.json');
updateNotifier({pkg}).notify();

program
  .version(pkg.version)
  .usage('[options] [command]');

program
  .command('deploy')
  // .alias('it')
  .action(config.wrap(program, deploy.cmd));

program
  .command('sites')
  // .alias('it')
  .action(config.wrap(program, listSites.cmd));

if (!process.argv.slice(2).length) {
  program.outputHelp();
} else {
  program.parse(process.argv);
}
