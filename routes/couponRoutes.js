const express = require('express');
const authController = require('./../controllers/authController');
const couponController = require('./../controllers/couponController');

const router = express.Router();

router.route('/')
    .post(authController.protect, authController.restrictTo('admin'), couponController.createCoupon)
    .get(authController.protect, authController.restrictTo('admin'), couponController.getAllCoupons)

router.route('/:id')
    .get(
        authController.protect,
        authController.restrictTo('admin'),
        couponController.getCoupon
    )
    .delete(
        authController.protect,
        authController.restrictTo('admin'),
        couponController.deleteCoupon
    )
    .patch(
        authController.protect,
        authController.restrictTo('admin'),
        couponController.updateCoupon
    );
router.post('/apply',authController.maybeProtect, couponController.applyCoupon)


module.exports = router;