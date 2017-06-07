// const base64 = require('base64-js');
    // when   = require("when"),
    // nodefn = require("when/node"),
    // fn     = require("when/function"),
const http = require('http');
const https = require('https');




const Ticket = require('./models/Ticket');
const Site = require('./models/Site');

const Client = { models: { Ticket, Site } };

module.exports = class RoastApi {
  // typically { endpoint, client_id, access_point }
  static createClient (options) {
    return new this(options);
  }

  constructor (options = {}) {
    this.access_token = options.access_token;
    this.client_id = options.client_id;
    this.client_secret = options.client_secret;
    this.redirect_uri = options.redirect_uri;
    this.ENDPOINT = options.endpoint || 'https://api.roast.io';
    this.VERSION = options.version || 'v1';
    this.hostname = this.ENDPOINT.match(/^https?:\/\/([^:]+)/)[1];
    this.ssl = this.ENDPOINT.match(/^https:\/\//);
    this.port = this.ssl ? 443 : (this.ENDPOINT.match(/:(\d+)$/) || [])[1] || 80;
    this.http = options.http || (this.ssl ? https : http);
  }

  createTicket () {
    return this.request({
      url: Client.models.Ticket.path,
      type: 'post',
      body: {client_id: this.client_id}
    }).then(function (response) {
      return new Client.models.Ticket(response.client, response.data);
    });
  }

  isAuthorized () { return !(this.access_token == null); }

  withAuthorization () {
    if (!this.isAuthorized()) return Promise.reject('Not authorized: Instantiate client with access_token');
    return Promise.resolve(this);
  }

  request (options) {
    const client = this;
    const path = options.raw_path ? options.url : '/api/' + this.VERSION + options.url;
    const headers = options.headers || {};
    const retries = options.retries ? options.retries : options.retries === 0 ? 0 : 3;
    let body = null;

    headers['Content-Type'] = options.contentType || 'application/json';

    if (options.body) {
      body = prepareBody(options.body, headers);
    }

    headers['Content-Length'] = body ? (typeof body === 'string' ? Buffer.byteLength(body) : body.length) : 0;

    if (this.access_token && !options.auth) {
      headers['Authorization'] = 'Bearer ' + this.access_token;
    }

    var requestOptions = {
      method: (options.type || 'get').toLowerCase(),
      hostname: this.hostname,
      path: path,
      port: this.port,
      headers: headers,
      auth: options.auth ? options.auth.user + ':' + options.auth.password : null
    };

    return new Promise((resolve, reject) => {
      // console.log('making request to', requestOptions.path);
      // for error reporting
      if (!this.requestsMade) this.requestsMade = [];
      this.requestsMade.push({method: requestOptions.method, path: requestOptions.path});

      var request = this.http.request(requestOptions, (res) => {
        let body = '';
        let data = null;

        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            if (body && !options.ignoreResponse) {
              data = JSON.parse(body);
            }
            resolve({client, data: data, meta: metadata(res)});
          } else if (res.statusCode == 401 || res.statusCode == 403) {
            reject({data: 'Authentication failed', client, meta: metadata(res)});
          } else {
            if ((requestOptions.method === 'get' ||
                 requestOptions.method === 'put' ||
                 requestOptions.method === 'delete') &&
                (retries > 0 && res.statusCode !== 422 && res.statusCode !== 404)) {
              options.retries = retries - 1;
              setTimeout(() => { this.request(options).then(resolve).catch(reject); }, 500);
            } else {
              reject({client, data: body, meta: metadata(res)});
            }
          }
        });
      });

      request.setTimeout(300000, function () {
        request.abort();
      });

      request.on('error', (err) => {
        if ((requestOptions.method === 'get' ||
             requestOptions.method === 'put' ||
             requestOptions.method === 'delete') &&
             retries > 0) {
          options.retries = retries - 1;
          setTimeout(() => { this.request(options).then(resolve).catch(reject); }, 500);
        } else {
          reject({client, data: err, meta: null});
        }
      });

      if (body) {
        request.write(body);
      }
      request.end();
    });
  }

  createSite (options) {
    return this.withAuthorization().then(function (client) {
      if (options.dir) {
        return Client.models.Site.createFromDir(client, options.dir);
      } else if (options.zip) {
        return Client.models.Site.createFromZip(client, options.zip);
      } else {
        return Client.models.Site.create(client, options);
      }
    });
  }

  site (id) {
    return this.element({model: Client.models.Site, id: id});
  }

  // typically {page, per_page}
  sites (options) {
    return this.collection({model: Client.models.Site}, options);
  }

  create (options) {
    return this.withAuthorization().then(function (client) {
      return client.request({
        url: (options.prefix || '') + options.model.path,
        type: 'post',
        body: options.attributes
      })
      .then(response => new options.model(response.client, response.data));
    });
  }

  update (options) {
    return this.withAuthorization().then(function (client) {
      return client.request({
        url: (options.prefix || '') + options.element.apiPath,
        type: 'put',
        body: options.attributes
      }).then(function (response) {
        options.model.call(options.element, response.client, response.data);
        return options.element;
      });
    });
  }

  element (options) {
    return this.withAuthorization().then(function (client) {
      return client.request({
        url: (options.prefix || '') + options.model.path + '/' + options.id
      })
      .then(response => new options.model(response.client, response.data));
    });
  }

  collection (options, meta = {}) {
    const params = [];
    for (var key in meta.params || {}) {
      params.push(key + '=' + meta.params[key]);
    }
    if (meta.page) { params.push(['page', meta.page].join('=')); }
    if (meta.per_page) { params.push(['per_page', meta.per_page].join('=')); }

    return this.withAuthorization().then(function (client) {
      return client.request({
        url: (options.prefix || '') + options.model.path + (params.length ? '?' + params.join('&') : '')
      }).then(function (response) {
        const result = response.data.map(d => new options.model(response.client, d));
        result.meta = response.meta;
        return result;
      });
    });
  }

}

function prepareBody (body, headers) {
  return typeof (body) === 'string' ? body : (headers['Content-Type'] == 'application/json' ? JSON.stringify(body) : body);
}

function metadata (res) {
  const meta = {};
  const links = res.headers && res.headers.link;
  const limit = res.headers && res.headers['x-ratelimit-limit'];
  const remaining = res.headers && res.headers['x-ratelimit-remaining'];
  const reset = res.headers && res.headers['x-ratelimit-reset'];

  if (links) {
    meta.pagination = {};
    const parts = links.split(',');
    for (var i = 0, len = parts.length; i < len; i++) {
      var part = parts[i];
      var link = part.replace(/(^\s*|\s*$)/, '');
      var segments = link.split(';');

      var m = segments[0].match(/page=(\d+)/);
      var page = m && parseInt(m[1], 10);
      m = segments[0].match(/^<(.+)>\s*$/);

      if (segments[1].match(/last/)) {
        meta.pagination.last = page;
      } else if (segments[1].match(/next/)) {
        meta.pagination.next = page;
      } else if (segments[1].match(/prev/)) {
        meta.pagination.prev = page;
      } else if (segments[1].match(/first/)) {
        meta.pagination.first = page;
      }
    }
  }
  meta.rate = {};
  if (limit) {
    meta.rate.limit = parseInt(limit, 10);
  }
  if (remaining) {
    meta.rate.remaining = parseInt(remaining, 10);
  }
  if (reset) {
    meta.rate.reset = parseInt(reset, 10);
  }
  return meta;
}
