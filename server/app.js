const express = require ('express');
const app = express();

const UserRoutes = require('./routes/allUsersRoutes')
const authRouter = require('./routes/authRoutes');


//Middleware
app.use(express.json());  // Parse JSON requests
app.use(express.urlencoded({ extended: false })); // Parse URL-encoded requests


app.use('/api/user', UserRoutes)
app.use('/api/auth', authRouter);

module.exports = app;
