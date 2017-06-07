const path = require("path");
// when       = require("when"),
// nodefn     = require("when/node"),
const glob = require("glob");
// from https://github.com/isaacs/node-glob/pull/243#issuecomment-172262447
glob.promise = function(pattern, options) {
  return new Promise(function(resolve, reject) {
    var g = new glob.Glob(pattern, options);
    g.once("end", resolve);
    g.once("error", reject);
  });
};

const crypto = require("crypto");

const fs = require("graceful-fs");
const fsReadPromise = function(absDir) {
  return new Promise(function(resolve, reject) {
    fs.readFile(absDir, function(err, statRes) {
      if (err) return reject(err);
      return resolve(statRes);
    });
  });
};
const fsLstatPromise = function(absDir) {
  return new Promise(function(resolve, reject) {
    fs.lstat(absDir, function(err, statRes) {
      if (err) return reject(err);
      return resolve(statRes);
    });
  });
};
const fsStatPromise = function(dir) {
  return new Promise(function(resolve, reject) {
    fs.stat(dir, function(err, statRes) {
      if (err) return reject(err);
      return resolve(statRes);
    });
  });
};

const Deploy = require("./Deploy");
const Model = require("./Model");

const MaxFilesForSyncDeploy = 1000;

module.exports = class Site extends Model {
  constructor(client, attributes) {
    super(client, attributes);
  }

  static get path() {
    return "/sites";
  }

  static createFromDir(client, dir, progress) {
    return this.create(client, {}).then(function(site) {
      return site
        .createDeploy({ dir: dir, progress: progress })
        .then(function(deploy) {
          site.deploy_id = deploy.id;
          return site;
        });
    });
  }
  static createFromZip(client, zip) {
    return Site.create(client, {}).then(function(site) {
      return site.createDeploy({ zip: zip }).then(function(deploy) {
        site.deploy_id = deploy.id;
        return site;
      });
    });
  }
  static create(client, attributes) {
    return client.create({
      model: Site,
      attributes: siteAttributesForUpdate(attributes)
    });
  }

  createDeploy(attributes) {
    if (attributes.dir) {
      return deployFromDir(
        this,
        attributes.dir,
        attributes.draft || false,
        attributes.progress
      );
    } else if (attributes.zip) {
      return deployFromZip(this, attributes.zip, attributes.draft || false);
    } else {
      return Promise.reject("You must specify a 'dir' or a 'zip' to deploy");
    }
  }
};

function calculateShas(files) {
  var shas = files.map(function(file) {
    return fsReadPromise(file.abs).then(function(data) {
      var shasum = crypto.createHash("sha256");
      shasum.update(data);
      file.sha = shasum.digest("hex");
      return true;
    });
  });

  return Promise.all(shas).then(function() {
    var result = {};
    files.forEach(function(file) {
      result[file.rel] = file.sha;
    });
    return { files: files, shas: result };
  });
}

function filterFiles(filesAndDirs) {
  var lstats = filesAndDirs.map(fileOrDir => fsLstatPromise(fileOrDir.abs));

  return Promise.all(lstats).then(function(fileData) {
    var result = [];
    for (var i = 0, len = fileData.length; i < len; i++) {
      const file = filesAndDirs[i];
      const data = fileData[i];

      if (data.isFile()) {
        result.push(file);
      }
    }
    return result;
  });
}

function globFiles(dir) {
  return glob.promise("**/*", { cwd: dir }).then(function(files) {
    var filtered = files
      .filter(function(file) {
        return file.match(/(\/__MACOSX|\/\.)/) ? false : true;
      })
      .map(function(file) {
        return { rel: file, abs: path.resolve(dir, file) };
      });

    return filterFiles(filtered);
  });
}

function siteAttributesForUpdate(attributes) {
  const mapping = {
    name: "name",
    customDomain: "custom_domain",
    notificationEmail: "notification_email",
    password: "password",
    github: "github",
    repo: "repo",
    domainAliases: "domain_aliases"
  };
  const result = {};

  for (var key in attributes) {
    if (mapping[key]) result[mapping[key]] = attributes[key];
  }

  return result;
}

function deployFromDir(site, dir, draft, progress) {
  var fullDir = path.resolve(dir);

  return fsStatPromise(fullDir).then(function(stat) {
    if (stat.isFile()) {
      throw new Error("No such dir " + dir + " (" + fullDir + ")");
    }

    return globFiles(fullDir).then(calculateShas).then(function(filesWithShas) {
      var params = {
        files: filesWithShas.shas,
        draft: draft
      };
      if (Object.keys(filesWithShas.shas).length > MaxFilesForSyncDeploy) {
        params.async = true;
      }

      return site.client
        .request({
          url: site.apiPath + "/deploys",
          type: "post",
          body: JSON.stringify(params)
        })
        .then(function(response) {
          return new Deploy(site.client, response.data);
        })
        .then(function(deploy) {
          return params.async ? deploy.waitForPreparation() : deploy;
        })
        .then(function(deploy) {
          var shas = {};
          deploy.required.forEach(function(sha) {
            shas[sha] = true;
          });
          var filtered = filesWithShas.files.filter(function(file) {
            return shas[file.sha];
          });
          return deploy.uploadFiles(filtered, progress);
        });
    });
  });
}

function deployFromZip(site, zip, draft) {
  var fullPath = zip.match(/^\//) ? zip : process.cwd() + "/" + zip;

  return fsReadPromise(fullPath).then(function(zipData) {
    var path = site.apiPath + "/deploys";

    if (draft) {
      path += "?draft=true";
    }

    return site.client
      .request({
        url: path,
        type: "post",
        body: zipData,
        contentType: "application/zip"
      })
      .then(function(response) {
        return new Deploy(site.client, response.data);
      });
  });
}
