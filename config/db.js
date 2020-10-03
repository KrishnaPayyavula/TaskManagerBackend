const mongoose = require("mongoose");
const { MongoClient } = require("mongodb");
require('dotenv').config();
// Replace this with your MONGOURI.
const MONGOURI = process.env.MONGO_DB_CLUSTER_URL;
const UsersDAO = require("../dataAccessLayer/UsersDAO")
const InitiateMongoServer = async () => {
  try {
    //
    MongoClient.connect(MONGOURI, { useNewUrlParser: true, useUnifiedTopology: true }, async (err, client) => {
      if (err) {
        console.log("Server is running & Could'nt make connection with the DB");
        throw err;
      } else {
        console.log("Server is running && Made a connection with the DB");
        await UsersDAO.injectDB(client)
      }
    }
    );

    //


    // await mongoose.connect(MONGOURI, {
    //   useNewUrlParser: true,
    //   useUnifiedTopology: true
    // });
    // console.log("Connected to DB !!");
  } catch (e) {
    console.log(e);
    throw e;
  }
};
module.exports = InitiateMongoServer;