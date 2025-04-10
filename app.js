const express = require('express');
const app = express();
const globalErrorController = require('./controllers/errorController');
const categoryRouter = require('./routes/categoryRoutes');
const userRouter = require('./routes/userRoutes');
const AppError = require('./utils/appError');
const cookieParser = require('cookie-parser')

//Body parser, read data from req.body into body
app.use(express.json());
app.use(cookieParser())


// 3) ROUTES
app.use('/api/v1/users', userRouter);
app.use('/api/v1/categories', categoryRouter)

app.all('*', (req, res, next)=>{
  next(new AppError(`The requested url ${req.originalUrl} was not found on this server!`, 'fail', 404))
});


app.use(globalErrorController)
module.exports = app;