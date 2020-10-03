const express = require("express");
const { check, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
var crypto = require('crypto');
var nodemailer = require('nodemailer');
const router = express.Router();
const auth = require("../middleware/auth");
const User = require("../models/User")
const UsersDAO = require("../dataAccessLayer/UsersDAO");
const { json } = require("body-parser");
const { ObjectID } = require("mongodb");

/**
 * @method - POST
 * @param - /register
 * @description - Manager  Registration
 */
router.post("/register",
  [
    check("name", "Please enter a valid name").isString().isLength({ min: 4, max: 24 }),
    check("email", "Please enter a valid email").isEmail(),
    check("password", "Please enter a valid password").isLength({
      min: 6
    })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        errors: errors.array()
      });
    }

    try {
      const { name, email, password } = req.body;
      let user = await UsersDAO.findUserByMail(email);
      console.log("User Details :->", user);
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
        password: hashedPassword,
        role: "MANAGER",
        isVerified: false,
        isActive: true,
      }

      let newCreatedUser = await UsersDAO.saveUser(userObject);
      // console.log("new User :->", newUser);
      let tokenObject = { _userId: newCreatedUser.insertedId, token: crypto.randomBytes(16).toString('hex'), createdAt: new Date() };
      let savedToken = await UsersDAO.saveVerificationToken(tokenObject);
      // console.log("verification Token", savedToken.insertedId);
      const payload = { user: { id: newCreatedUser.insertedId } };
      jwt.sign(payload, "randomString", { expiresIn: 10000 }, (err, token) => {
        if (err) throw err;

        // Send the email
        var transporter = nodemailer.createTransport({ service: 'Sendgrid', auth: { user: process.env.SENDGRID_USERNAME, pass: process.env.SENDGRID_PASSWORD } });
        var mailOptions = { from: process.env.SENDGRID_USERNAME, to: userObject.email, subject: 'Account Verification Token', text: 'Hello,\n\n' + 'Please verify your account by clicking the link: \nhttp:\/\/' + req.headers.host + '\/user\/confirmation\/' + tokenObject.token + '\/userid\/' + newCreatedUser.insertedId + '\n' };
        transporter.sendMail(mailOptions, function (err) {
          if (err) { return res.status(500).send({ msg: err.message }); }
          // res.status(200).send('A verification email has been sent to ' + user.email + '.');
          res.status(200).json({ token: token, message: 'A verification email has been sent to ' + userObject.email + '.', userDetails: { name: userObject.name, role: userObject.role, id: newCreatedUser.insertedId } });
        });
      }
      );
    } catch (err) {
      console.log(err.message);
      res.status(500).send("Error while Saving User");
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
    console.log("Erros", errors);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        errors: errors.array()
      });
    }

    const { email, password } = req.body;
    try {
      let user = await UsersDAO.findUserByMail({ email });
      if (!user) {
        return res.status(400).json({
          message: "User Not Exist"
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({
          message: "Incorrect Password !"
        });
      }
      const payload = {
        user: {
          id: user.id
        }
      };

      // Make sure the user has been verified
      if (!user.isVerified) return res.status(401).send({ type: 'not-verified', msg: 'Your account has not been verified.' });

      jwt.sign(payload, "randomString", { expiresIn: "3600m" }, (err, token) => {
        if (err) throw err;
        res.status(200).json({ token });
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
 * @description - Registered User Confirmation Functionality 
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
    let userResponse = await UsersDAO.findUserById(userid);
    if (!userResponse) {
      return res.status(400).send({ msg: 'We were unable to find a user for this token.' });
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
 * @method - GET
 * @description - Get LoggedIn User
 * @param - /user/me
 */
router.get("/me", auth, async (req, res) => {
  try {
    // request.user is getting fetched from Middleware after token authentication
    const user = await User.findById(req.user.id);
    res.json({ "response": "success" });
  } catch (e) {
    res.send({ message: "Error in Fetching user" });
  }
});

router.get("/test", async (req, res) => {
  try {
    const Response = await UsersDAO.connnectionTest();
    res.send({ Response: Response })
  } catch (error) {
    res.status(500).json({ error: error })
  }
})


module.exports = router;


