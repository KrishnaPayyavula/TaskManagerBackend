const ObjectID = require("mongodb").ObjectID;
var TASKMANAGERDB;
require('dotenv').config();
class UsersDAO {

    /**
     * 
     * @param {*} connection 
     * @description connection Object is needed to create a connection with the database and makiing use of it in the entire class
     */
    static async injectDB(connection) {
        if (TASKMANAGERDB) {
            return;
        }
        try {
            TASKMANAGERDB = await connection.db(process.env.DATABASE);
        } catch (error) {
            console.error(`Unable to estalish the connection to the TestDB ${error}`);
            throw error
        }
    }



    static async findUserByMail(mail) {
        try {
            return await TASKMANAGERDB.collection("users").findOne({ email: mail })
        } catch (error) {
            return { error: error }
        }
    }

    static async findUserById(id) {
        try {
            return await TASKMANAGERDB.collection("users").findOne({ _id: ObjectID(id) })
        } catch (error) {
            return { error: error }
        }
    }

    static async saveUser(userObject) {
        try {
            let user = await TASKMANAGERDB.collection('users').insertOne(userObject);
            if (!user) return { error: "Error while saving the data" }
            return user;
        } catch (error) {
            return { error: error }
        }
    }

    static async saveVerificationToken(token) {
        try {
            // if(await TASKMANAGERDB.collection(""))
            if (!await TASKMANAGERDB.collection("tokens").indexExists(["createdAt"])) {
                await TASKMANAGERDB.collection("tokens").createIndex({ 'createdAt': 1 }, { expireAfterSeconds: 43200 })
            }
            let savedToken = await TASKMANAGERDB.collection('tokens').insertOne(token);
            if (!savedToken) return { error: "Error while saving the data" }
            return savedToken;
        } catch (error) {
            return { error: error }
        }
    }

    static async verifyToken(token) {
        try {
            return await TASKMANAGERDB.collection("tokens").findOne({ token: token })
        } catch (error) {
            return { error: error }
        }
    }

    static async updateUserStatus(query) {
        try {
            return await TASKMANAGERDB.collection('users').updateOne(query.filter, query.update)
        } catch (error) {
            return { error: error }
        }
    }


}

module.exports = UsersDAO