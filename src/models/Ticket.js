const Model = require("./Model");

module.exports = class Ticket extends Model {
  constructor(client, attributes) {
    super(client, attributes);
  }

  static get path() {
    return "/oauth/tickets";
  }

  exchange() {
    console.log("exchanging");
    return this.client
      .request({
        url: this.apiPath + "/exchange",
        type: "post"
      })
      .then(response => {
        this.client.access_token = response.data.access_token;
        return response.data;
      });
  }
};
