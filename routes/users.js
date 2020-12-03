const express = require("express");
const { check, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
var crypto = require('crypto');
var nodemailer = require('nodemailer');
const router = express.Router();
const auth = require("../middleware/auth");
const UsersDAO = require("../dataAccessLayer/UsersDAO");
const { ObjectID } = require("mongodb");

/**
 * @method - POST
 * @path - /register
 * @description - MANAGER/WORKER  Registration/ SIGNUP - Only User with MANAGER role can signUP from the singup page and If registration is successfull , This API will send an email verication link to the User mail ID , 
 * Once the User is  verified with in 12 hours, He can able to login to the application. MANAGER Can able to create the user with WORKER role by passing all the details along with IsMANAGER=false
 */
router.post("/register",
  [
    check("name", "Please enter a valid name").isString().isLength({ min: 4, max: 24 }),
    check("isManager", "Please send a valid UserType").isBoolean(),
    check("email", "Please enter a valid email").isEmail(),
    check("password", "Please enter a valid password").isLength({ min: 6 }),
    check("mobile", "Please enter a valid mobile number").isMobilePhone().isLength({ min: 10, max: 13 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        errors: errors.array()
      });
    }

    try {
      const { name, email, password, mobile, isManager } = req.body;
      let user = await UsersDAO.findUserByMail(email);
      // console.log("User Details :->", user);
      if (user) {
        return res.status(400).json({
          msg: "User already exists"
        });
      }
      const salt = await bcrypt.genSalt(10);
      let hashedPassword = await bcrypt.hash(password, salt);
      let userObject = {
        name: name,
        email: email,
        mobile: mobile,
        password: hashedPassword,
        role: isManager ? "MANAGER" : "WORKER",
        isVerified: false,
        isActive: true,
        paginationLimit: 10,
        reward_points: !isManager ? 0 : null,
        rewards: !isManager ? [] : null
      }

      let newCreatedUser = await UsersDAO.saveUser(userObject);
      // console.log("new User :->", newUser);
      let tokenObject = { _userId: newCreatedUser.insertedId, token: crypto.randomBytes(16).toString('hex'), createdAt: new Date() };
      let savedToken = await UsersDAO.saveVerificationToken(tokenObject);
      console.log("verification Token", savedToken.insertedId);
      const payload = { user: { id: newCreatedUser.insertedId } };
      jwt.sign(payload, "randomString", { expiresIn: 10000 }, (err) => {
        if (err) throw err;
        // Sending the email to the registered user.
        var transporter = nodemailer.createTransport({ service: 'Sendgrid', auth: { user: process.env.SENDGRID_USERNAME, pass: process.env.SENDGRID_PASSWORD } });
        var mailOptions = { from: process.env.SENDGRID_USERNAME, to: userObject.email, subject: 'Account Verification Token', text: 'Hello,\n\n' + 'Please verify your account by clicking the link: \nhttp:\/\/' + req.headers.host + '\/api\/user\/confirmation\/' + tokenObject.token + '\/userid\/' + newCreatedUser.insertedId + '\n' };
        transporter.sendMail(mailOptions, function (err) {
          if (err) { return res.status(500).send({ msg: err.message }); }
          res.status(200).send('A verification email has been sent to ' + userObject.email + '.');
          // res.status(200).json({ token: token, message: 'A verification email has been sent to ' + userObject.email + '.', userDetails: { name: userObject.name, role: userObject.role, id: newCreatedUser.insertedId } });
        });
      }
      );
    } catch (err) {
      console.log(err.message);
      res.status(500).send("Error while Saving Manager");
    }
  }
);

/**
 * @method - POST
 * @param - /login
 * @description - User Login Functionality 
 */
router.post("/login", [
  check("email", "Please enter a valid email").isEmail(),
  check("password", "Please enter a valid password").isLength({
    min: 6
  })
],
  async (req, res) => {
    const errors = validationResult(req);
    // console.log("Erros", errors);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        errors: errors.array()
      });
    }

    const { email, password } = req.body;
    try {
      let user = await UsersDAO.findUserByMail(email);
      // console.log("User Details :_>", user)
      if (!user) {
        return res.status(401).send({ message: "User Not Exist" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).send({ message: "Incorrect Password !" });
      }

      //Making User the User is verified and Active
      if (!user.isActive || !user.isVerified) {
        return res.status(401).send({ message: "User is not active/verified" })
      }
      const payload = {
        user: {
          id: user._id,
          name: user.name,
          role: user.role,
          paginationLimit: user.paginationLimit
        }
      };


      jwt.sign(payload, "randomString", { expiresIn: "3600m" }, (err, token) => {
        if (err) throw err;
        res.status(200).json({ userdetails: payload, token: token });
      }
      );
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Server Error" });
    }
  }
);
/**
 * @method - GET
 * @param - /confirmation
 * @description - Registered User Confirmation Functionality API. User need to verify the API with in 12 hours other wise the verication token sent on the verication link will expire after 12 hours. 
 * We need to resend the verication link inorder to verify the user post 12 hours.
 */
router.get('/confirmation/:token/userid/:userid', [
  check("token", "Please send a valid token").isLength({ min: 20 }).isString(),
  check("userid", "Please send a valid userid").isLength({ min: 24 }).isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    // console.log("Erros", errors);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        errors: errors.array()
      });
    }

    let { token, userid } = req.params;

    let tokenResponse = await UsersDAO.verifyToken(token);

    if (!tokenResponse) {
      return res.status(400).send({ type: 'not-verified', msg: 'We were unable to find a valid token/Your token my have expired.' })
    }
    let query = {
      filter: { _id: ObjectID(userid) },
      options: { projection: { name: 1, role: 1, email: 1 } }
    }
    let userResponse = await UsersDAO.findUserById(query);
    if (!userResponse) {
      return res.status(400).send({ msg: 'We were unable to find a user for this userId.' });
    }
    if (userResponse.isVerified) {
      return res.status(400).send({ type: 'already-verified', msg: 'This user has already been verified.' });
    }

    let updateUserQuery = {
      filter: { _id: ObjectID(userid) },
      update: { $set: { isVerified: true } }
    }
    let userUpdateResponse = await UsersDAO.updateUserStatus(updateUserQuery);
    let { error } = userUpdateResponse;
    if (error) {
      return res.status(400).send({ msg: 'Error while updating the token in database' });
    }
    res.status(200).send("The account has been verified. Please log in.");
  } catch (errors) {
    res.status(500).send({ error: "Error while verifying the user" });
  }
})


/**
 * @method - POST
 * @path - /get-workers
 * @description - Getting all the users whose role is WORKER with default pagelimit to 20 if not provided.
 */
router.post("/get-workers", auth,
  [check("pageLimit", "Please send a proper pageLimit").isNumeric()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        errors: errors.array()
      })
    }
    try {
      let { pageLimit } = req.body;
      const TASKS_PER_PAGE = pageLimit || 20
      const { taskList, totalUsers } = await UsersDAO.getWorkers()
      let response = {
        tasks: taskList,
        page: 0,
        filters: {},
        entries_per_page: TASKS_PER_PAGE,
        total_results: totalUsers,
      }
      res.json(response);
    } catch (error) {
      console.log(err.message);
      res.status(500).send("Error while getting the tasks");
    }
  })


/**
 * @method - POST
 * @path - /get-user-by-id 
 * @description - Getting the user (Manager/worker) by his id. when the user Logs in to the application. This API used for showing the profile details in the home.
 */
router.post("/get-user-by-id", auth, [
  check("id", "Please send a valid user id").isString().isLength({ min: 24 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      errors: errors.array()
    })
  }
  try {
    let { id } = req.body;
    let query = {
      filter: { _id: ObjectID(id) },
      options: { projection: { password: 0, isVerified: 0 } }
    }
    let userDetails = await UsersDAO.findUserById(query);
    if (!userDetails) {
      return res.status(400).send({ msg: 'We were unable to find a user for this userId.' });
    }
    res.status(200).json({ user: userDetails })
  } catch (error) {
    res.status(500).send({ status: "Error while getting the user", message: error });
  }
})


/**
 * @method - PUT
 * @path - /udpate-user-details
 * @description - Updating the user details with latest information. This API Takes the 5 required parameters (name,mobile,isAcitve,id and Pagination Limit),
 * We can use the same API for updating the User with MANAGER/WORKER Roles.
 */
router.put('/udpate-user-details', auth, [
  check("id", "Please send a valid user id").isString().isLength({ min: 24 }),
  check("name", "Please enter a valid name").isString().isLength({ min: 4, max: 24 }),
  check("mobile", "Please enter a valid mobile number").isMobilePhone().isLength({ min: 10, max: 13 }),
  check("isActive", "Please send a active status").isBoolean(),
  check("paginationLimit", "Please send a valid pagelimit value").isNumeric()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      errors: errors.array()
    })
  }
  try {
    let { id, name, mobile, isActive, paginationLimit } = req.body;
    let query = {
      filter: { _id: ObjectID(id) },
      update: {
        $set: {
          name: name,
          mobile: mobile,
          isActive: isActive,
          pagination_limit: paginationLimit
        }
      }
    };

    const updateResponse = await UsersDAO.updateWorker(query);
    var { error } = updateResponse;
    if (error) {
      res.status(400).json({ error })
    }

    if (updateResponse.modifiedCount === 0) {
      throw new Error("unable to update  Worker");
    }
    res.json({ status: "Ok", message: "Worker has been updated Successfully" });
  }
  catch (error) {
    res.status(500).send({ status: "Error", message: "Cannot update the same Data" });
  }
})

/**
* @method - POST
* @path - /update-task-status
* @description -API for Updating/Giving the reward points for the user by Manager once the task has been successfully completed.
* This API takes 3 parameters (user_id,task_id,rewardPoints)
*/
router.post("/update-reward-points", auth,
  [
    check("user_id", "Please send a valid user id").isString().isLength({ min: 24 }),
    check("task_id", "Please send a valid task id").isString().isLength({ min: 24 }),
    check("rewardPoints", "Please send a valid status").isNumeric()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        errors: errors.array()
      })
    }
    try {
      let { user_id, task_id, rewardPoints } = req.body;
      let rewardPointsObject = {
        task_id: ObjectID(task_id),
        reward_points: rewardPoints
      }
      let query = {
        filter: {
          _id: ObjectID(user_id)
        },
        update: {
          $addToSet: { rewards: rewardPointsObject },
          $inc: { reward_points: rewardPoints }
        }
      }
      const updateResponse = await UsersDAO.updateWorker(query);
      var { error } = updateResponse;
      if (error) {
        res.status(400).json({ status: "Error", message: error })
      }
      if (updateResponse.modifiedCount === 0) {
        throw new Error("unable to update  reward Points");
      }
      res.json({ status: "Ok", message: "Reward Points has been updated Successfully" });

    } catch (error) {
      console.log(err.message);
      res.status(500).send({ status: "Error", error: "Error while updating the Reward Points" });
    }
  })




module.exports = router;


