
  import RoastApi from './roast-api';
  const path = require('path');
  const homeDir = require('home-dir');
  const fs = require('fs');
  const chalk = require('chalk');
  const webauth = require('./webauth');

  const CLIENT_ID = process.env.ROAST_CLIENT_ID || '88d63585-be90-443f-9c49-00f297652e26';
  const API_ENDPOINT = process.env.ROAST_ENDPOINT;
  const PREVIEW_DOMAIN = process.env.ROAST_PREVIEW_DOMAIN || 'roast.io';
  const CONFIG_DIR = path.join(homeDir(), process.env.ROAST_CONFIG_DIR_NAME || '.roast');
  const CONFIG_PATH = path.join(CONFIG_DIR, 'config');
  const LOCAL_CONFIG_PATH = path.join(process.cwd(), '.roast');

  var readLocalConfig = function (env) {
    if (fs.existsSync(LOCAL_CONFIG_PATH)) {
      const conf = JSON.parse(fs.readFileSync(LOCAL_CONFIG_PATH));
      return env ? conf[env] : conf;
    }
    return null;
  };

  var Config = function (options) {
    for (var k in options) {
      this[k] = options[k];
    }
  };

  var isUUID = function (val) {
    if (val.indexOf('-') === -1) { return false; }
    var parts = val.split('-');
    return parts[0].length === 8 &&
         parts[1].length === 4 &&
         parts[2].length === 4 &&
         parts[3].length === 4 &&
         parts[4].length === 12;
  };

  Config.prototype.getSiteId = function (cmd) {
    var siteId = cmd.siteId || this.siteId;

    if (siteId == null) { return null; }

    if (isUUID(siteId) || siteId.indexOf('.') > 0) {
      return siteId;
    } else {
      return siteId + '.' + PREVIEW_DOMAIN;
    }
  };

  Config.prototype.getSite = function (cmd) {
    var siteId = this.getSiteId(cmd);

    if (siteId == null) {
      console.log('No site id specified');
      process.exit(1);
    }

    return this.client.site(siteId).catch(function (err) {
      console.log('Site not found: ' + chalk.bold(err));
      process.exit(1);
    });
  };

  // if this is run in a different environment where an absolute path
  // no longer matches, this will attempt to find a matching relative path
  // from current dir
  // the most common use case:
  //   your laptop has: /users/myname/work/project/build
  //   your ci env is:  /ubuntu/home/project/build
  //   this function ensures the build dir is returned
  const findDeployPath = inputConfigPath => {
    const configPath = inputConfigPath.replace(/^\.\//, "");

    if (fs.existsSync(configPath)) return configPath === "" ? "./" : configPath;

    const oneDirUp = configPath
      .split("/")
      .slice(configPath.startsWith("/") ? 2 : 1)
      .join("/");

    if (oneDirUp && oneDirUp.length) return findDeployPath(oneDirUp);

    return "./";
  };

  Config.prototype.getPath = function (cmd) {
    const path = cmd.path || this.path;
    if (path) return findDeployPath(path);
    return path;
  };

  Config.prototype.writeLocalConfig = function (options) {
    const local = readLocalConfig() || {};
    let conf = local;

    if (this.env) {
      local[this.env] = {};
      conf = local[this.env];
    }

    conf.site_id = options.site_id;
    conf.path = options.path;

    fs.writeFileSync(LOCAL_CONFIG_PATH, JSON.stringify(local));
  };

  Config.prototype.deleteLocalConfig = function () {
    this.writeLocalConfig({});
  };

  Config.prototype.write = function (data) {
    var config = readConfig();
    for (var key in data) {
      this[key] = data[key];
      config[key] = data[key];
    }
    writeConfig(config);
  };

  var readConfig = function() {
    // read from env var if exists
    if (process.env.ROAST_TOKEN && `${process.env.ROAST_TOKEN}`.length)
      return { access_token: process.env.ROAST_TOKEN };

    // next, config path
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH));
    }

    // if in CI env, warn about ROAST_TOKEN env var and exit
    if (process.env.CI) {
      console.log(
        "CI environments must set the ROAST_TOKEN environment variable. Get your token from ~/.roast/config or when you sign in to https://www.roast.io"
      );
      return process.exit(1);
    }

    return null;
  };

  var writeConfig = function (data) {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR);
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(data));
  };

  function readOrCreateConfig (options) {
    var config = readConfig();
    if (config) {
      return Promise.resolve(config);
    } else if (options.accessToken) {
      return Promise.resolve({access_token: options.accessToken});
    } else {
      let client = RoastApi.createClient({client_id: CLIENT_ID, endpoint: API_ENDPOINT});
      return webauth.login({client: client}).then(function (token) {
        config = {access_token: token.access_token};
        writeConfig(config);
        return config;
      });
    }
  }

  function newConfig (program) {
    var local = readLocalConfig(program.env);
    return readOrCreateConfig(program).then(function (config) {
      config.client = RoastApi.createClient({
        client_id: CLIENT_ID,
        access_token: program.accessToken || (local && local.access_token) || config.access_token,
        endpoint: API_ENDPOINT
      });
      config.siteId = program.siteId || (local && local.site_id);
      config.path = program.path || (local && local.path);
      config.env = program.env;
      config.existing = !!local;
      return config;
    });
  }

/* Wrap a function with the config loader.
   Load config from file, from cli options or create a new config
   through web authentication. */
  exports.wrap = function (program, method) {
    return function (cmd) {
      var args = Array.prototype.slice.call(arguments, 0);
      newConfig(program).then(function (config) {
        method.apply(method, [new Config(config)].concat(args));
      });
    };
  };
