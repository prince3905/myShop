const express = require ('express');
const app = express();

const UserRoutes = require('./routes/allUsersRoutes')

//Middleware
app.use(express.json());  // Parse JSON requests
app.use(express.urlencoded({ extended: false })); // Parse URL-encoded requests


app.use('/api/user', UserRoutes)

module.exports = app;
