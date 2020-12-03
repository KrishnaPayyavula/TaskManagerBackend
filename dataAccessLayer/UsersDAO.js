const ObjectID = require("mongodb").ObjectID;
var _TASKMANAGERDB;
var _USERSCOLLECTION;
require('dotenv').config();
class UsersDAO {

    /**
     * 
     * @param {*} connection 
     * @description connection Object is needed to create a connection with the database and makiing use of it in the entire class methods
     */
    static async injectDB(connection) {
        if (_TASKMANAGERDB) {
            return;
        }
        try {
            _TASKMANAGERDB = await connection.db(process.env.DATABASE);
            _USERSCOLLECTION = await _TASKMANAGERDB.collection("users");
        } catch (error) {
            console.error(`Unable to estalish the connection to the TestDB ${error}`);
            throw error
        }
    }


    /**
     * 
     * @param {String} mail 
     * @description - This function is for getting the user by e mail address.
     * @returns - User details Object 
     */
    static async findUserByMail(mail) {
        try {
            return await _USERSCOLLECTION.findOne({ email: mail })
        } catch (error) {
            return { error: error }
        }
    }


    /**
     * 
     * @param {Object} query 
     * @description This functions finds the users documents by its id.
     * query contains the filter object and options which contains the projection parameters
     */
    static async findUserById(query) {
        try {
            return await _USERSCOLLECTION.findOne(query.filter, query.options)
        } catch (error) {
            return { error: error }
        }
    }

    /**
     * 
     * @param {Object} userObject 
     * @description This functions is saving the user once it is modified.
     * userObject contains the properties of the user document.
     */
    static async saveUser(userObject) {
        try {
            let user = await _USERSCOLLECTION.insertOne(userObject);
            if (!user) return { error: "Error while saving the data" }
            return user;
        } catch (error) {
            return { error: error }
        }
    }

    /**
     * 
     * @param {String} token 
     * @description This function is for the saving the email verication token , Once the user has been registerd, 
     * This is token will expire automatically after 12 hours of creation. This is done by creating an TimeToLive property for MongoDB Collection.
     * 
     */
    static async saveVerificationToken(token) {
        try {
            // Checing the index is already created or not in the TASKMANAGER Collection. 
            // If it is not created ,we are creating the index on createAt field with an expiration time of 12 Hours
            if (!await _TASKMANAGERDB.collection("tokens").indexExists(["createdAt"])) {
                await _TASKMANAGERDB.collection("tokens").createIndex({ 'createdAt': 1 }, { expireAfterSeconds: 43200 }) // 12 hours
            }
            let savedToken = await _TASKMANAGERDB.collection('tokens').insertOne(token);
            if (!savedToken) return { error: "Error while saving the data" }
            return savedToken;
        } catch (error) {
            return { error: error }
        }
    }

    /**
     * 
     * @param {String} token 
     * @description This function is gets the verification token for email verification.
     */
    static async verifyToken(token) {
        try {
            return await _TASKMANAGERDB.collection("tokens").findOne({ token: token })
        } catch (error) {
            return { error: error }
        }
    }

    /**
     * 
     * @param {Object} query 
     * @description This function is for updating the user status 
     * query object contains the filter and updation properties.
     */
    static async updateUserStatus(query) {
        try {
            return await _USERSCOLLECTION.updateOne(query.filter, query.update)
        } catch (error) {
            return { error: error }
        }
    }

    /**
     * 
     * @param {} 
     * @description This function is for fetching all the users with Role "WORKER" 
     * By default this it will fetch first 20 Users and when the page number changes it fetches the next 20 users 
     * 
     */
    static async getWorkers({
        // here's where the default parameters are set for the getWorkers method
        filters = { role: "WORKER" },
        page = 0,
        usersPerPage = 20,
    } = {}) {

        let cursor;
        let query = filters;
        let project = { password: 0, isVerified: 0 };
        try {
            cursor = await _USERSCOLLECTION
                .find(query)
                .project(project);
        } catch (e) {
            console.error(`Unable to issue find command, ${e}`)
            return { taskList: [], totalUsers: 0 }
        }

        const displayCursor = cursor.limit(usersPerPage)

        try {
            const taskList = await displayCursor.toArray()
            const totalUsers = page === 0 ? await _USERSCOLLECTION.countDocuments(query) : 0;
            return { taskList, totalUsers }
        } catch (e) {
            console.error(
                `Unable to convert cursor to array or problem counting documents, ${e}`,
            )
            return { taskList: [], totalUsers: 0 }
        }

    }

    /**
     * 
     * @param {Object} udpateQuery 
     * @description This function is for updating the user profiles
     * This updateQuery contains the filter and updation object
     */
    static async updateWorker(udpateQuery) {
        try {
            const updateResponse = await _USERSCOLLECTION.updateOne(udpateQuery.filter, udpateQuery.update);
            return updateResponse
        } catch (error) {
            console.error(`Unable to update worker details: ${error}`)
            return { error: error }
        }
    }






}

module.exports = UsersDAO