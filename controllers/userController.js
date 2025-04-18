const { User } = require('../models');
const APIFeatures = require("../utils/apiFeatures");
const catchAsync = require("../utils/catchAsync");
const AppError = require('../utils/appError');
const Email = require('../utils/email');

exports.getAllUsers = catchAsync(async(req, res, next)=>{
    // Initialize APIFeatures with query params
    const features = new APIFeatures(req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();
    // Execute the query with the options
    const users = await User.findAll(features.getOptions())
    
    //Send Response
    res.status(200).json({
        status:"success",
        result:users.length,
        data:{
            users
        }
    })
});


const updateApprovalStatus = async (user, newStatus) => {
    const validStatuses = ['approve', 'deny', 'deactivate'];
    // Check if newStatus is valid
    if (!validStatuses.includes(newStatus)) {
        throw new AppError("Invalid data", {status:`Status must be one of: ${validStatuses.join(', ')}`}, '', 400);
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
       
    try {
        const updatedUser = await updateApprovalStatus(user, status)
        await new Email(user, '', url, type).sendStatus();
        res.status(200).json({
            status: 'success',
            essage: `User's account ${updatedUser.status} successfully!`,
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