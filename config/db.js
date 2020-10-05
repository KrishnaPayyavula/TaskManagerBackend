
const { MongoClient } = require("mongodb");
require('dotenv').config();
// Replace this with your MONGOURI.
const MONGOURI = process.env.MONGO_DB_CLUSTER_URL;

// Importing the Data Access Layers to make connection with the database before starting the server.
const UsersDAO = require("../dataAccessLayer/UsersDAO");
const TasksDAO = require("../dataAccessLayer/TasksDAO");
const InitiateMongoServer = async () => {
  try {
    //
    MongoClient.connect(MONGOURI, { useNewUrlParser: true, useUnifiedTopology: true }, async (err, client) => {
      if (err) {
        console.log(" Couldn't make connection with the DB");
        throw err;
      } else {
        console.log(" Made a connection with the DB");
        await UsersDAO.injectDB(client);
        await TasksDAO.injectDB(client);
      }
    }
    );

  } catch (e) {
    console.log(e);
    throw e;
  }
};
module.exports = InitiateMongoServer;