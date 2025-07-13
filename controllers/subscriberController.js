const Email = require('../utils/email');
const { Subscriber } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require("../utils/catchAsync");
const generatePaginationMeta = require('../utils/pagination');
const APIFeatures = require("../utils/apiFeatures");

exports.createSubscriber = catchAsync(async(req, res, next)=>{
    
    const subscriber = await Subscriber.create(req.body);
    //send email to subscriber
     try {
        await new Email(subscriber, null, null,null).sendSubscriber(subscriber.name)
        // Send response after successful email
        res.status(201).json({
            status: 'success',
            data: {
                subscriber,
            },
        });
    } catch (error) {
        console.log('Error in controller',error)
        return next(new AppError("Record created successfully but there was a problem sending the email.", '', 500))
    }
});

exports.getAllSubscribers = catchAsync(async(req, res, next)=>{
    // const subscribers = await Subscriber.findAll();
    const features = new APIFeatures(req.query, 'Subscriber').paginate();
    const { count, rows: subscribers } = await Subscriber.findAndCountAll(features.getOptions());
    const { page, limit } = features.getPaginationInfo();
    const pagination = generatePaginationMeta({ count, page, limit, req });
    res.status(200).json({
        status: "success",
        result: subscribers.length,
        pagination,
        data:{
            subscribers
        }
    });
})