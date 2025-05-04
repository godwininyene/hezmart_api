const { User } = require('../models');
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const Email = require('../utils/email');
const { Op } = require('sequelize');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const {promisify} = require('util')

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

    if (error instanceof AppError) {
      return next(error);
  }
    console.log('Record processing error:', error);

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
        [Op.gt]: Date.now()
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

  try {
    // Send welcome email
    await new Email(user, user.role, '').sendOnBoard();
    createSendToken(user, req, res, 200)
  } catch (error) {
    if (error.name === 'AppError') {
      return next(error);
    }
    if (error instanceof AppError) {
      return next(error);
  }
    console.log('Record processing error:', error);
    return next(new AppError(
      "Email verified successfully but there was a problem sendingg welcome email.",
      '',
      500
    ));
  }
});

exports.resendVerificationEmail = catchAsync(async (req, res, next) => {
  const { email } = req.body;
  // 1. Check if email was provided
  if (!email) {
    return next(new AppError("Missing email address", { email: "Please provide your email address" }, 400));
  }
  // 2. Find user by email
  const user = await User.findOne({ where: { email } });
  if (!user) {
    return next(new AppError("No user found with this email address", '', 404));
  }
  // 3. If already verified, don't send again
  if (user.isEmailVerified) {
    return next(new AppError("This email has already been verified", '', 400));
  }
  // 4. Generate a new verification code
  const verificationCode = user.createEmailVerificationCode();
  await user.save({ validateBeforeSave: false });
  // 5. Send the email
  try {
    await new Email(user, verificationCode).sendVerificationEmail();

    res.status(200).json({
      status: 'success',
      message: 'Verification email resent successfully'
    });
  } catch (error) {
    console.error('Email sending error:', error);
    return next(new AppError("Failed to send verification email. Please try again later.", '', 500));
  }
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


exports.protect = catchAsync(async(req, res, next) =>{
  // 1) Get token and check if it there
  let token;
  if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')){
      token = req.headers.authorization.split(' ')[1]
  }else if(req.cookies.jwt){
      token = req.cookies.jwt;
  }

  if(!token){
    return next(new AppError('You are not log in! Please log in to get access', '', 401))
  }

  // 2) validate token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET)

  // 3) Check if user still exist
  // const currentUser = await User.findById(decoded.id)
  const currentUser = await User.findByPk(decoded.id);
  if(!currentUser){
      return next(new AppError('The user belonging to this token does no longer exist.', '', 401))
  }

  // 4) Check if user change password after token was issued
 if( currentUser.changedPasswordAfter(decoded.iat)){
  return next(new AppError('User recently changed password. Please log in again.', '', 401))
 }
  //GRANT ACCESS TO  PROTECTED ROUTE
  req.user = currentUser;
  next();
});

exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
    secure:true,
    sameSite: 'None',
  });
  res.status(200).json({ status: 'success' });
};



exports.restrictTo = (...roles)=>{
  return(req, res, next)=>{
    if(!roles.includes(req.user.role) ){
        return next(new AppError("You do not have the permission to perform this operation", '', 403))
    }
    next()
  }
};


exports.forgotPassword = catchAsync(async(req, res, next)=>{
  const{email} = req.body;

  //1) Check if there is email and password
   if(!email){
    return next(new AppError("Missing required field", 
    {email:"Please provide your email address"}, 401))
  }

  
  // 2) Get user based on POSTed email
  const user = await User.findOne({ where: {email}})
  if(!user){
    return next(new AppError("No user was found with that email!", '', 404))
  }

  //3) Generate random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({validateBeforeSave:false});
  const resetURL = `${req.get('referer')}resetPassword?token=${resetToken}`
 
  //4) Send token to client's email
  try{
    await new Email(user, '', resetURL).sendPasswordReset()
    res.status(200).json({
      status:"success",
      message:"Token has been sent to email!"
    });
  }catch(err){
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({validateBeforeSave:false});
    return next(new AppError("There was a problem sending email. Please try again later!",'', 500))
  }
});

exports.resetPassword = catchAsync(async(req, res, next)=>{
  // 1) Get user base on token
  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({
    where: {
      passwordResetToken: hashedToken,
      passwordResetExpires: {
        [Op.gt]: new Date()
      }
    }
  });


  // 2) If token has not expire, and there is a user, set password
  if(!user){
    return next(new AppError("Invalid token or token has expired!", '', 404))
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  await user.save();

  // 3) Update passwordChangedAt property for the user

  // 4) Log in the user, send JWT
  createSendToken(user, req, res, 200)
})


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