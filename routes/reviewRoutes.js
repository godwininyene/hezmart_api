const express = require('express');
const authController = require('./../controllers/authController');
const reviewController = require('./../controllers/reviewController');

const router = express.Router({mergeParams:true});

router.use(authController.protect);
router.route('/')
    .get(
        reviewController.getAllReviews
    )
    .post(
        authController.restrictTo('customer'),
        reviewController.createReview
    )
router.route('/:id')
    .delete(
        authController.restrictTo('admin', 'customer'),
        reviewController.deleteReview
    )
    .patch(
        authController.restrictTo('admin','customer'),
        reviewController.updateReview
    )

module.exports = router;
