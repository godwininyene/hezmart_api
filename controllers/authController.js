const { User } = require('../models');
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const Email = require('../utils/email');
const { Op } = require('sequelize');
const jwt = require('jsonwebtoken')

const signToken = user =>{
  return jwt.sign({id:user.id}, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRESIN
  })
}

const createSendToken = (user, req, res, statusCode)=>{
  const token = signToken(user);

  const cookieOption = {
    httpOnly:true,
    expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRESIN * 24 * 60 * 60 * 1000)

  }
  // Set 'secure' flag in production or if the request is secure
  if (process.env.NODE_ENV === 'production' || req.secure) {
    cookieOption.secure = true;
  }
  //Send the cookie
  res.cookie('jwt', token, cookieOption);
  //Remove Password from output
  user.password = undefined;
  res.status(statusCode).json({
    status:"success",
    token,
    data:{
        user
    }
  })
}

exports.signup = catchAsync(async(req, res, next) => {
  // Extract common fields for all users
  // const { name, email, password, passwordConfirm, role } = req.body;  
  // Base user data
  // const userData = {
  //   role,
  //   firstName,
  //   lastName,
  //   email,
  //   primaryPhone,
  //   secondaryPhone,
  //   primaryAddress,
  //   secondaryAddress,
  //   password,
  //   passwordConfirm,
  //   city,
  // };

  // If user is a vendor, add vendor-specific fields
  // if (role === 'vendor') {
  //   const { 
  //     phone1, 
  //     phone2, 
  //     ninNumber, 
  //     address, 
  //     businessName, 
  //     businessCategoryId, 
  //     businessLogo 
  //   } = req.body;

  //   Object.assign(userData, {
  //     phone1,
  //     phone2,
  //     ninNumber,
  //     address,
  //     businessName,
  //     businessCategoryId,
  //     businessLogo,
  //     status: 'pending'// Vendors start as pending
  //   });
  // }
  
  const app_url =  process.env.APP_URL || 'http://127.0.0.1:6000'; 
  if(req.file) req.body.businessLogo = `${app_url}/uploads/businesses/logos/${req.file.filename}`;
  const user = await User.create(req.body);

  // Generate email verification token
  const verificationCode = user.createEmailVerificationCode();
  await user.save({ validateBeforeSave: false }); // <-- Save the user after setting the code
  //Remove password from output;
  user.password=undefined;
  user.passwordConfirm=undefined;

  try {
    // Send verification email
    await new Email(user, verificationCode).sendVerificationEmail();
    return res.status(201).json({ 
      message: "User registered successfully. Please verify your email." ,
      status:'success',
      data:user
    });
  } catch (error) {
    if (error.name === 'AppError') {
      return next(error);
    }
    console.log('Transaction processing error:', error);
    return next(new AppError(
      "User registered successfully but there was a problem sendng email verification code.",
      '',
      500
    ));
  }
});



exports.verifyEmail = catchAsync(async (req, res, next) => {
  const { code } = req.body;
  
  
  // 1) Find the user with the verification code and check if it's still valid
  const user = await User.findOne({
    where: {
      emailVerificationCode: code,
      emailVerificationExpires: {
        [Op.gt]: Date.now() // Sequelize equivalent of {$gt: Date.now()}
      }
    }
  });
 
  

  // 2) If no user is found, return an error
  if (!user) {
    return next(new AppError("Invalid or expired verification code!", '', 400));
  }

  // 3) Check if the user is already verified
  if (user.isEmailVerified) {
    return next(new AppError("This email is already verified!", '', 400));
  }
  // 4) Mark the email as verified and remove verification details
  user.isEmailVerified = true;
  user.emailVerificationCode = null;
  user.emailVerificationExpires = null;
  await user.save({ validate: false });
  // 5) Send verification email
  await new Email(user, user.role, '').sendOnBoard();
  // 6) Send response
  res.status(200).json({
    status: 'success',
    message: 'Email verified successfully!',
  });
});

exports.login = catchAsync(async(req, res, next)=>{
  const{email, password} = req.body;

  //1) Check if there is email and password
  if(!email || !password){
    return next(new AppError("Missing log in credentials", 
    {credentials:"Please provide email and password "}, 401))
  }

  //2) Check if user exist and password is correct
  const user = await User.scope('withPassword').findOne({
    where: { email }
  });

  if( !user || !(await user.correctPassword(password, user.password))){
    return next(new AppError("Password or email is incorrect", '', 401))
  }

  //3) Check if email is verified
   if (!user.isEmailVerified) {
    return next(new AppError("Please verify your email before logging in.",'', 400));
  }

  // 4) Everything is ok, send token to client
  createSendToken(user, req, res, 200)
});



exports.restrictTo = (...roles)=>{
  return(req, res, next)=>{
    if(!roles.includes(req.user.role) ){
        return next(new AppError("You do not have the permission to perform this operation", '', 403))
    }
    next()
  }
};


// In your authController.js
exports.createAdmin = catchAsync(async (req, res, next) => {
    // Only allow existing admins to create new admins
    if (req.user.role !== 'admin') {
      return next(new AppError('Only admins can create admin accounts', 403));
    }
  
    const admin = await User.create({
      ...req.body,
      role: 'admin',
      status: 'active'
    });
  
    res.status(201).json({
      status: 'success',
      data: {
        user: admin
      }
    });
  });