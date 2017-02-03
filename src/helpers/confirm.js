const chalk = require('chalk');
const inquire = require('inquirer');

exports.withConfirmation = function (options) {
  if (options.skip) {
    return Promise.resolve(true);
  }
  return inquire.prompt([{
    name: 'confirm',
    type: 'confirm',
    message: options.msg || 'Are you sure?'
  }]).then(function (answers) {
    if (answers.confirm) {
      return true;
    }
    process.exit(1);
  });
};

exports.withWarning = function (value, warning) {
  console.log('\n');
  console.log(chalk.bold('Warning: ') + warning);
  console.log('\n');

  return inquire.promt({name: 'continue', message: 'Are you sure you want to continue?', type: 'confirm'})
      .then(function (result) {
        if (result.continue) {
          return value;
        }
        process.exit(1);
      });
};
