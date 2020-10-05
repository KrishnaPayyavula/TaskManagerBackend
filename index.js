const express = require('express')
const cors = require('cors')
const app = express()
const bodyParser = require('body-parser');
const user = require("./routes/users");
const tasks = require("./routes/tasks");

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const port = process.env.PORT || 5000
const InitiateMongoServer = require("./config/db");
InitiateMongoServer();

app.use(cors())
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.use("/api/user", user);
app.use("/api/tasks", tasks)

app.listen(port, (error) => {
  if (error) throw error;
  console.log("Server is Running on PORT", port);
})