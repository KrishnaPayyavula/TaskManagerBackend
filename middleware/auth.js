const jwt = require("jsonwebtoken");
const { ObjectID } = require("mongodb");
const UsersDAO = require("../dataAccessLayer/UsersDAO")
module.exports = async function (req, res, next) {



  const extractToken = (req) => {
    if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
      return req.headers.authorization.split(' ')[1];
    } else if (req.query && req.query.token) {
      return req.query.token;
    }
    return null;
  }
  const token = extractToken(req);

  // console.log("Token", token);
  if (!token) return res.status(401).json({ message: "Authentication Error" });

  try {
    const decoded = jwt.verify(token, "randomString");
    req.user = decoded.user;
    let query = {
      filter: { _id: ObjectID(decoded.user.id) },
      options: { projection: { name: 1, role: 1, email: 1 } }
    }
    const user = await UsersDAO.findUserById(query);

    if (!user) {
      return res.status(500).send({ message: "Insufficient privileges" });
    }

    next();
  } catch (e) {
    console.error(e);
    res.status(500).send({ message: "Invalid Token" });
  }
};