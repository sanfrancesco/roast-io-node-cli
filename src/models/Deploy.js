const semaphore = require("semaphore");
const fs = require("graceful-fs");
const fsReadPromise = function(absDir) {
  return new Promise(function(resolve, reject) {
    fs.readFile(absDir, function(err, statRes) {
      if (err) return reject(err);
      return resolve(statRes);
    });
  });
};

// http://www.2ality.com/2014/10/es6-promises-api.html
function delay(ms) {
  return new Promise(function(resolve, reject) {
    setTimeout(resolve, ms); // (A)
  });
}

const Model = require("./Model");

module.exports = class Deploy extends Model {
  constructor(client, attributes) {
    super(client, attributes);
  }

  fakeConstructor(client, attributes) {
    return new Deploy(client, attributes);
  }

  static get path() {
    return "/deploys";
  }

  isReady() {
    return this.state == "ready" || this.state == "current";
  }
  isPrepared() {
    return this.isReady() || this.state === "prepared";
  }
  restore() {
    var self = this;
    return this.client
      .request({
        url: "/sites/" + this.site_id + "/deploys/" + this.id + "/restore",
        type: "post"
      })
      .then(function(response) {
        Deploy.call(self, response.client, response.data);
        return self;
      })
      .catch(function(response) {
        return Promise.reject(response.data);
      });
  }
  publish() {
    return this.restore();
  }
  waitForReady() {
    if (this.isReady()) {
      return Promise.resolve(this);
    } else {
      return delay(1000)
        .then(this.refresh.bind(this))
        .then(this.waitForReady.bind(this));
    }
  }
  waitForPreparation() {
    if (this.isPrepared()) {
      return Promise.resolve(this);
    } else {
      return delay(1000)
        .then(this.refresh.bind(this))
        .then(this.waitForPreparation.bind(this));
    }
  }
  uploadFiles(files, progress) {
    if (!(this.state == "uploading" || this.state == "prepared"))
      return Promise.resolve(this);
    if (files.length == 0) {
      return this.refresh();
    }

    progress && progress("start", { total: files.length });

    var self = this;
    var sem = semaphore(20);
    var results = files.map(function(file) {
      return new Promise(function(resolve, reject) {
        sem.take(function() {
          return fsReadPromise(file.abs).then(function(data) {
            var filePath = file.rel
              .split("/")
              .map(function(segment) {
                return encodeURIComponent(segment);
              })
              .join("/");

            return self.client
              .request({
                url: "/deploys/" + self.id + "/files/" + filePath,
                type: "put",
                body: data,
                contentType: "application/octet-stream",
                ignoreResponse: true
              })
              .then(function(response) {
                progress &&
                  progress("upload", { file: file, total: files.length });
                sem.leave();
                return resolve(file);
              })
              .catch(function(response) {
                progress &&
                  progress("uploadError", {
                    file: file,
                    message: response.data
                  });
                sem.leave();
                return reject(response);
              });
          });
        });
      });
    });

    return Promise.all(results).then(self.refresh.bind(self));
  }
};
