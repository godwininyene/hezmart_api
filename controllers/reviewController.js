const catchAsync = require("../utils/catchAsync");
const {Review} = require('./../models');
const AppError = require('./../utils/appError')


exports.getAllReviews = catchAsync(async(req, res, next)=>{
    let filter = {};
    if(req.params.productId) filter.where={productId: req.params.productId}

   filter.order = [['createdAt', 'DESC']];
    const reviews = await Review.findAll(filter);

    res.status(200).json({
        status:"success",
        result:reviews.length,
        data:{
            reviews
        }
    })
});

exports.createReview = catchAsync(async(req, res, next)=>{
    //Allow nested routes
    if(!req.body.productId) req.body.productId = req.params.productId
    if(!req.body.userId) req.body.userId = req.user.id
    const review = await Review.create(req.body);

    res.status(201).json({
        status:"success",
        data:{
            review
        }
    });
});

exports.updateReview = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { rating, review } = req.body;

    const existingReview = await Review.findByPk(id);

    if (!existingReview) {
        return next(new AppError("No review found with that ID", "", 404));
    }

    // Update the fields if they are provided
    if (rating !== undefined) existingReview.rating = rating;
    if (review !== undefined) existingReview.review = review;

    await existingReview.save();

    res.status(200).json({
        status: "success",
        data: {
            review: existingReview
        }
    });
});


exports.deleteReview = catchAsync(async (req, res, next) => {
    const review = await Review.findByPk(req.params.id);

    if (!review) {
        return next(new AppError("No review found with that ID", "", 404));
    }

    await review.destroy();

    res.status(204).json({
        data: null
    });
});
