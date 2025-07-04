const { User, Category } = require('../models');
const APIFeatures = require("../utils/apiFeatures");
const catchAsync = require("../utils/catchAsync");
const AppError = require('../utils/appError');
const Email = require('../utils/email');
const generatePaginationMeta = require('../utils/pagination');


exports.getAllUsers = catchAsync(async(req, res, next)=>{
    // Initialize APIFeatures with query params
    const features = new APIFeatures(req.query, 'User')
    .filter()
    .sort()
    .limitFields()
    .paginate();

    // Include category model
    features.queryOptions.include = 
        {
          model: Category,
          as:'category',
          attributes:['name']
        };
    
    // Execute the query with count
    const { count, rows: users } = await User.findAndCountAll(features.getOptions());
    const { page, limit } = features.getPaginationInfo();
    const pagination = generatePaginationMeta({ count, page, limit, req });
    
    //Send Response
    res.status(200).json({
        status:"success",
        result:users.length,
        pagination,
        data:{
            users
        }
    })
});

exports.getUser = catchAsync(async(req, res, next)=>{
    
    const user = await User.findByPk(req.params.id)
    if(!user){
        return next(new AppError('No user was found with that ID', '', 404));
    }
    res.status(200).json({
        status:"success",
        user
    });
})


const updateApprovalStatus = async (user, newStatus) => {
    const validStatuses = ['approve', 'deny', 'deactivate', 'pending'];
    // Check if newStatus is valid
    if (!validStatuses.includes(newStatus)) {
        throw new AppError("Invalid data", {status:`Status must be one of: ${validStatuses.join(', ')}`}, 400);
    }
    // Prevent redundant status updates
    if (newStatus === 'approve' && user.status === 'active') {
        throw new AppError("User account already approved!", '', 400);
    }
    if (newStatus === 'deny' && user.status === 'denied') {
        throw new AppError("User account approval already denied!", '', 400);
    }
    if (newStatus === 'deactivate' && user.status === 'deactivated') {
        throw new AppError("User account already deactivated!", '', 400);
    }
    if (newStatus === 'pending' && user.status === 'pending') {
        throw new AppError("User account is pending already!", '', 400);
    }

    // Update the status
    if (newStatus === 'approve') {
        user.status = 'active';
        console.log('Currently approving');
        
    } else if (newStatus === 'deny') {
        console.log('Currently denying');
        
        user.status = 'denied';
    } else if (newStatus === 'deactivate') {
        console.log("Currently deactivating")
        user.status = 'deactivated';
    }else if (newStatus === 'pending') {
        console.log("Currently pending")
        user.status = 'pending';
    }


    await user.save({ validateBeforeSave: false });
    return user;
};


exports.updateStatus = catchAsync(async(req, res, next)=>{
    //Getting status and checking if it there
    let{status} = req.body
    if(!status){
        return next(new AppError("Invalid data", {status: 'Please provide status'}, 404))
    }
    
    let type;
    const user = await User.findByPk(req.params.id);
    User

    if(!user){
        return next(new AppError("No user found with that ID", '', 404))
    }
    let url = `${req.get('referer')}manage/investor/dashboard`
   
    if (status === 'approve')type='account_approved'
    
    if (status === 'deny') type='account_denied'
     
    if (status === 'deactivate') type="account_deactivated"
    
    if (status === 'pending') type="account_pending"
       
    try {
        const updatedUser = await updateApprovalStatus(user, status)
        await new Email(user, '', url, type).sendStatus();
        res.status(200).json({
            status: 'success',
            message: `User's account mark as ${status} successfully!`,
            data:{
                user:updatedUser
            }
        });
    } catch (error) {
        if (error instanceof AppError) {
            return next(error);
        }
        return next(new AppError("User's status updated successfull but there was a problem sending the email.", '', 500));
    }
})



const filterObj = (obj, ...allowedFields) => {
    const newObj = {};
    Object.keys(obj).forEach(el => {
        if (allowedFields.includes(el)) newObj[el] = obj[el];
    });
    return newObj;
};

exports.updateMe = catchAsync(async (req, res, next) => {
    // 1) Create error if user POSTs password data
    if (req.body.password || req.body.passwordConfirm) {
        return next(new AppError('This route is not for password updates. Please use /updateMyPassword route!', '', 400));
    }

    // 2) Filter out unwanted fields and only allow specific updates
    const allowedFields = [
        'firstName', 
        'lastName', 
        'email', 
        'primaryPhone', 
        'state', 
        'primaryAddress', 
        'photo'
    ];
    
    const filteredBody = filterObj(req.body, ...allowedFields);
    
    // Handle file upload if present
    if (req.file) {
       filteredBody.photo = `${host}/uploads/users/${req.file.filename}`;
    }

    // 3) Update user document 
    const user = await User.findByPk(req.user.id);
    if (!user) {
        return next(new AppError('User not found', '', 404));
    }

    // Update the user with the filtered data
    await user.update(filteredBody, {
        fields: allowedFields, // Only update allowed fields
        validate: true // Run model validations
    });

    // Optionally: If you want to return the updated user without sensitive data
    const userData = user.get({ plain: true });
    delete userData.password;
    delete userData.passwordResetToken;
    delete userData.passwordResetExpires;
    delete userData.emailVerificationCode;
    delete userData.emailVerificationExpires;

    res.status(200).json({
        status: 'success',
        data: {
            user: userData
        }
    });
});

exports.getMe = (req, res, next)=>{
    req.params.id = req.user.id;
    next();
}