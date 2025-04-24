const express = require('express');
const app = express();
const globalErrorController = require('./controllers/errorController');
const categoryRouter = require('./routes/categoryRoutes');
const subcategoryRouter = require('./routes/subCategoryRoutes');
const productRouter = require('./routes/productRoutes')
const userRouter = require('./routes/userRoutes');
const cartRouter = require('./routes/cartRoutes');
const AppError = require('./utils/appError');
const cookieParser = require('cookie-parser')
const path = require('path')
const cors = require('cors');
require('./cronJobs/cleanExpiredCarts');



//Implement cors
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,               // Allow credentials such as cookies
}));

app.options('*', cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
}));
//Body parser, read data from req.body into body
app.use(express.json());
app.use(cookieParser())

//Serve static files
app.use(express.static(path.join(__dirname, 'public')))


// 3) ROUTES
app.use('/api', (req, res, next) => {
  if (!req.cookies.sessionId) {
    const sessionId = require('crypto').randomUUID();
    res.cookie('sessionId', sessionId, { maxAge: 1000 * 60 * 60 * 24 * 7 }); // 7 days
    req.sessionId = sessionId;
  } else {
    req.sessionId = req.cookies.sessionId;
  }
  next();
});

app.use('/api/v1/users', userRouter);
app.use('/api/v1/categories', categoryRouter);
app.use('/api/v1/subcategories', subcategoryRouter);
app.use('/api/v1/products', productRouter);
app.use('/api/v1/cart', cartRouter);

app.all('*', (req, res, next)=>{
  next(new AppError(`The requested url ${req.originalUrl} was not found on this server!`, 'fail', 404))
});


app.use(globalErrorController)
module.exports = app;