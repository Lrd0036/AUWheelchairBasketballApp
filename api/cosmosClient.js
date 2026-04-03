const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = client.database(process.env.COSMOS_DATABASE || "apex");

function getContainer(name) {
  return database.container(name);
}

module.exports = { getContainer };
