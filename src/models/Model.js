export default class Model {
  constructor (client, attributes) {
    for (var key in attributes) {
      this[key] = attributes[key];
    }

    this.client = client;
    this.apiPath = this.constructor.path + '/' + this.id;
  }

  refresh () {
    return this.client.request({ url: this.apiPath })
        .then(response => {
          return this.constructor.call(this, response.client, response.data);
        });
  }
}
