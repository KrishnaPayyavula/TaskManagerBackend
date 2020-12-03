const ObjectID = require("mongodb").ObjectID;
var _TASKMANAGERDB;
var _TASKSCOLLECTION;
require('dotenv').config();

class TasksDAO {

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
            _TASKSCOLLECTION = await _TASKMANAGERDB.collection("tasks");
        } catch (error) {
            console.error(`Unable to estalish the connection to the TestDB ${error}`);
            throw error
        }
    }
    /**
     * 
     * @param {ObjectID} userid 
     * @description - This function is for finding all tasks assigned to a particular user.
     * It takes userid as a required parameter
     */
    static async getAllTasksByUserId(userid) {
        try {
            return await _TASKSCOLLECTION.find({ assigned_to_id: ObjectID(userid) }).toArray();
        } catch (error) {
            return { error: error }
        }
    }
    /**
     * 
     * @param {Object} taskDetails 
     * @description - This function is for saving the task created by Manager
     * This function takes TaskDetails Object which contains all the properties related for the Task Document.
     */
    static async saveTask(taskDetails) {
        try {
            let savedResponse = await _TASKSCOLLECTION.insertOne(taskDetails);
            if (!savedResponse) return { error: "Error while saving the task" }
            return savedResponse
        } catch (error) {
            return { error: error }
        }
    }
    /**
        * 
        * @param {Object} udpateQuery 
        * @description - This function is for updating the task created by Manager
        * This function takes TaskDetails Object which contains all the properties related for the Task Document.
        * updateQuery contains the filter object and update object 
        */
    static async udpateTask(udpateQuery) {
        try {
            const updateResponse = await _TASKSCOLLECTION.updateOne(udpateQuery.filter, udpateQuery.update);
            return updateResponse
        } catch (error) {
            console.error(`Unable to update Task Details: ${error}`)
            return { error: error }
        }
    }
    /**
     * 
     * @param {Object} deleteQuery 
     * @description - This function is for deleting the task 
     * It takes taskid in the query Object
     */
    static async deleteTask(deleteQuery) {
        try {
            const updateResponse = await _TASKSCOLLECTION.deleteOne(deleteQuery.filter);
            return updateResponse
        } catch (error) {
            console.error(`Unable to delete the task Details: ${error}`)
            return { error: error }
        }
    }


    /**
 * 
 * @param {Object} query 
 * @description - This function is for finding the tasks by task status
 * @retu
 */
    static async getTasksByStatus(query) {
        try {
            return await _TASKSCOLLECTION.find(query.filter).toArray();
        } catch (error) {
            return { error: error }
        }
    }
}

module.exports = TasksDAO;