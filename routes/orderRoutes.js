const express = require('express');
const authController = require('./../controllers/authController');
const orderController = require('./../controllers/orderController');


const router = express.Router();

router.post('/checkout-session', authController.protect, orderController.getCheckoutSession)

router.post('/flutterwave-webhook', orderController.handleFlutterwaveWebhook);
   

module.exports = router;