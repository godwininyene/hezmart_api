const express = require('express');
const subscriberController = require('./../controllers/subscriberController');
const authController = require('./../controllers/authController')
const router = express.Router();

router.route('/')
    .post(subscriberController.createSubscriber)
    .get(
        authController.protect,
        authController.restrictTo('admin'),
        subscriberController.getAllSubscribers
    )

module.exports = router;