const { User } = require('../models');
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const Email = require('../utils/email');
const { Op } = require('sequelize');

exports.signup = catchAsync(async(req, res, next) => {
  // Extract common fields for all users
  const { name, email, password, passwordConfirm, role } = req.body;  
  // Base user data
  const userData = {
    name,
    email,
    password,
    passwordConfirm,
    role
  };

  // If user is a vendor, add vendor-specific fields
  if (role === 'vendor') {
    const { 
      phone1, 
      phone2, 
      ninNumber, 
      address, 
      businessName, 
      businessCategoryId, 
      businessLogo 
    } = req.body;

    Object.assign(userData, {
      phone1,
      phone2,
      ninNumber,
      address,
      businessName,
      businessCategoryId,
      businessLogo,
      status: 'pending'// Vendors start as pending
    });
  }
  if(req.file) userData.businessLogo = req.file.filename
  const user = await User.create(userData);

  // Generate email verification token
  const verificationCode = user.createEmailVerificationCode();
  await user.save({ validateBeforeSave: false }); // <-- Save the user after setting the code
 
  // Send verification email
  await new Email(user, role,  verificationCode).sendVerificationEmail();

  return res.status(201).json({ 
    message: "User registered successfully. Please verify your email." ,
    status:'success',
  });
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