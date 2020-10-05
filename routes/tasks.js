const express = require("express");
const http = require("http");
const { check, validationResult } = require("express-validator");
const router = express.Router();
const auth = require("../middleware/auth");
const multer = require('multer');
const multerS3 = require('multer-s3');
const AWS = require('aws-sdk')
const { v4: uuidv4 } = require('uuid');
const { ObjectID } = require("mongodb");
const TasksDAO = require("../dataAccessLayer/TasksDAO");

// Initializing S3 Interface
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});




//Disk  Configuration (S3) for the Multer 
const uploadS3 = multer({

    storage: multerS3({
        s3: s3,
        acl: 'public-read',
        bucket: process.env.AWS_BUCKET_NAME,
        metadata: (req, file, callBack) => {
            callBack(null, { fieldName: file.fieldname })
        },
        key: (req, file, callBack) => {
            var fullPath = 'attachments/' + file.originalname;
            callBack(null, fullPath)
        }
    }),
    limits: { fileSize: 20000000 }, // In bytes: 2000000 bytes = 20 MB
    // fileFilter: function (req, file, cb) {
    //     checkFileType(file, cb);
    // }
}).array('attachments', 1);



/**
* @method - POST
* @path - /save-task
* @description - API for creating/saving the task. This API takes 
*    (taskname,description,priority,estimatedTime,category, createdById, assignedToId) as the required parameters. 
*    Remaining parameters will be added at the time of creation of task.
*    If we did not provide the assigneed while creating the task , defaultly it is setting as a null value.
*/
router.post("/save-task", auth,
    [
        check("taskname", "Please send a proper task name").isString().isLength({ min: 3 }),
        check("description", "Description is required").isString(),
        check("priority", "Please send a priority").isString(),
        check("status", "Please send a valid status").isString(),
        check("estimatedTime", "Please send a proper estimatedTime").isString(),
        check("category", "Category is required").isString(),
        check("createdById", "Please send created by Id").isString().isLength({ min: 24 }),
        check("assignedToId", "Assigned to filed is required").isString()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array()
            })
        }
        try {
            let taskDetails = req.body;
            let updatedTask = {
                taskname: taskDetails.taskname,
                description: taskDetails.description,
                priority: taskDetails.priority,
                status: taskDetails.status,
                estimated_time: new Date(taskDetails.estimatedTime),
                created_on: new Date(),
                category: taskDetails.category,
                created_by_id: ObjectID(taskDetails.createdById),
                assigned_to_id: taskDetails.assignedToId !== null ? ObjectID(taskDetails.assignedToId) : null
            }
            let savedTaskResponse = await TasksDAO.saveTask(updatedTask);
            // console.log("Saved Response ", savedTaskResponse);
            if (!savedTaskResponse) {
                res.status(500).json({ message: "error while saving the task" });
            }
            res.status(200).json({ status: "Ok", message: "Task saved successfully", insertedId: savedTaskResponse.insertedId })

        } catch (error) {
            console.log(error.message);
            res.status(500).send({ status: "Error", error: "Error while saving the task" });
        }
    })


/**
 * @method - POST
 * @path - /getAllTasks
 * @description - To get all the tasks which are assigned to the user. This API Takes userid as a required parameter inorder to 
 * get all the tasks related to particular user.
 */
router.post("/get-all-tasks", auth,
    [
        check("userid", "Please send a proper user id").isString().isLength({ min: 24 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array()
            })
        }
        try {
            let { userid } = req.body;
            let tasks = await TasksDAO.getAllTasksByUserId(userid)
            if (!tasks) {
                res.status(204).json({ message: "No data Found" });
            }
            res.send({ userid: userid, tasks: tasks })

        } catch (error) {
            console.log(error.message);
            res.status(500).send("Error while getting the tasks");
        }
    })

/**
 * @method - POST
 * @path - /get-tasks-by-status
 * @description - To get all the tasks which are assigned to the user.
 */
router.post("/get-tasks-by-status", auth,
    [
        check("userid", "Please send a proper user id").isString().isLength({ min: 24 }),
        check("status", "Please send valid status").isArray()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array()
            })
        }
        try {
            let { userid, status } = req.body;
            if (!Array.isArray(status) && !status.length > 0) {
                res.status(400).json({ error: "Status Array should not be empty" })
            }

            let query = {
                filter: {
                    created_by_id: ObjectID(userid),
                    status: { $in: status }
                }
            }
            let tasks = await TasksDAO.getTasksByStatus(query)
            if (!tasks) {
                res.status(204).json({ message: "No data Found" });
            }
            res.send({ userid: userid, status: status, tasks: tasks })

        } catch (error) {
            console.log(error.message);
            res.status(500).send("Error while getting the tasks");
        }
    })






/**
* @method - POST
* @path - /update-task-status
* @description - Updating the task status , This API takes Two (task_id,status ) as required parameters
* It takes COMPLETED,PENDING,ASSIGNED,NOTASSIGNED as status values
*/
router.put("/update-task-status", auth,
    [
        check("task_id", "Please send a valid task Id").isString().isLength({ min: 24, max: 24 }),
        check("status", "Please send a valid status").isString().isLength({ min: 5 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array()
            })
        }
        try {
            let { task_id, status } = req.body;
            let statusArray = ["COMPLETED", "PENDING", "ASSIGNED", "NOTASSIGNED"];
            if (!statusArray.includes(status)) {
                return res.status(400).json({ error: "Status is incorrect it should be only  " + statusArray });
            }

            let query = {
                filter: {
                    _id: ObjectID(task_id)
                },
                update: {
                    $set: { status: status }
                }
            }
            let updatedTaskResponse = await TasksDAO.udpateTask(query);
            if (!updatedTaskResponse) {
                res.status(500).json({ message: "error while updating the task status" });
            }
            if (updatedTaskResponse.modifiedCount === 0) {
                throw new Error("Unable to update the task status")
            }
            res.status(200).json({ status: "Ok", message: "Task status updated successfully" })

        } catch (error) {
            console.log(error.message);
            res.status(500).send({ status: "Error", error: "Error while updating the task" + error });
        }
    })


/**
* @method - POST
* @path - /update-task-attachments
* @description - Updating the task attchments which are submitted by the user with role WORKER while submitting the task to MANAGER.
* It can multiple attachments from the form and stores them in the AMAZON S3 Bucket and in the task document it adds a attachment id as a reference.
* Don't forget the enctype="multipart/form-data" in your form.
* form header name/key should be attachments while sending the data.
* API takes attachments and task_id as a required properties.
*/
router.post("/update-task-attachments",
    [
        check("task_id", "Please send a valid task Id").isString().isLength({ min: 24 })
    ],
    async (req, res) => {

        uploadS3(req, res, (error) => {
            console.log('files', req.files);
            if (error) {
                console.log('errors', error);
                res.status(500).json({
                    status: 'fail',
                    error: error
                });
            } else {
                // If File not found
                if (req.files === undefined) {
                    console.log('uploadProductsImages Error: No File Selected!');
                    res.status(500).json({
                        status: 'fail',
                        message: 'Error: No File Selected'
                    });
                } else {
                    // If Success
                    let fileArray = req.files,
                        fileLocation;
                    const images = [];
                    for (let i = 0; i < fileArray.length; i++) {
                        fileLocation = fileArray[i].location;
                        console.log('fileName', fileLocation);
                        images.push(fileLocation)
                    }
                    // Save the file name into database
                    return res.status(200).json({
                        status: 'ok',
                        filesArray: fileArray,
                        locationArray: images
                    });

                }
            }
        })


    })


/**
* @method - POST
* @path - /update-task
* @description - API for updating the task. This API takes 
*    (taskname,description,priority,estimatedTime,category, createdById, assignedToId) as the required parameters. 
*    Remaining parameters will be added at the time of creation of task.
*    If we did not provide the assigneed while creating the task , defaultly it is setting as a null value.
*/
router.put("/update-task", auth,
    [
        check("id", "Please send a valid task Id").isString().isLength({ min: 24 }),
        check("taskname", "Please send a proper user id").isString().isLength({ min: 3 }),
        check("description", "Description is required").isString(),
        check("priority", "Please send a priority").isString(),
        check("status", "Please send a valid status").isString(),
        check("estimatedTime", "Please send a proper startDate").isString(),
        check("category", "Category is required").isString(),
        check("createdById", "Please send created by Id").isString().isLength({ min: 24 }),
        check("assignedToId", "Assigned to feild is required").isString()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array()
            })
        }
        try {
            let taskDetails = req.body;
            let updatedTask = {
                taskname: taskDetails.taskname,
                description: taskDetails.description,
                priority: taskDetails.priority,
                status: taskDetails.status,
                estimated_time: taskDetails.estimatedTime,
                created_on: new Date(),
                category: taskDetails.category,
                created_by_id: ObjectID(taskDetails.createdById),
                assigned_to_id: taskDetails.assignedToId !== null ? ObjectID(taskDetails.assignedToId) : null
            }

            let query = {
                filter: {
                    _id: ObjectID(taskDetails.id)
                },
                update: {
                    $set: updatedTask
                }
            }
            let updatedTaskResponse = await TasksDAO.udpateTask(query);
            if (!updatedTaskResponse) {
                res.status(500).json({ message: "error while updating the task" });
            }
            if (updatedTaskResponse.modifiedCount === 0) {
                throw new Error("unable to update the task")
            }
            res.status(200).json({ status: "Ok", message: "Task updating successfully" })

        } catch (error) {
            console.log(error.message);
            res.status(500).send({ status: "Error", error: "Error while updating the task" });
        }
    })


/**
* @method - DELETE
* @path - /delete-task
* @description - API for deleting the task which accepts the task id as a required parameter, and deletes the task.
*/
router.delete("/delete-task", auth,
    [
        check("id", "Please send a valid task Id").isString().isLength({ min: 24, max: 24 }),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array()
            })
        }
        try {
            let { id } = req.body;
            let query = {
                filter: {
                    _id: ObjectID(id)
                }
            }
            let deletedTaskResponse = await TasksDAO.deleteTask(query);
            if (!deletedTaskResponse) {
                res.status(500).json({ message: "error while deleting the task" });
            }
            if (deletedTaskResponse.deletedCount === 0) {
                throw new Error("No task found with given id to delete")
            }
            res.status(200).json({ status: "Ok", message: "Task deleted successfully" })
        } catch (error) {
            // console.log(error.message);
            res.status(500).send({ status: "Error", error: "Error while deleting the task" + error });
        }
    })



module.exports = router