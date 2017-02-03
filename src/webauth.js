const webui = require('./helpers/webui');

// http://www.2ality.com/2014/10/es6-promises-api.html
function delay (ms) {
  return new Promise(function (resolve, reject) {
    setTimeout(resolve, ms); // (A)
  });
}

function waitForTicket (ticket, waitUntil) {
  if (waitUntil && new Date() > waitUntil) {
    return Promise.reject('Timeout while waiting for ticket grant');
  }

  if (ticket.authorized) {
    return Promise.resolve(ticket);
  } else {
    return delay(500)
      .then(ticket.refresh.bind(ticket))
      .then(t => waitForTicket(t, waitUntil));
  }
}

exports.login = function (options) {
  return options.client.createTicket().then(function (ticket) {
    return webui.open('/authorize?response_type=ticket&ticket=' + ticket.id).then(function () {
      var ts = new Date();
      ts.setHours(ts.getHours() + 1);
      return waitForTicket(ticket, ts).then(function (ticket) {
        return ticket.exchange();
      });
    });
  }).catch(function (err) {
    console.log('Error generating authorization ticket: %s', err);
    process.exit(1);
  });
};
