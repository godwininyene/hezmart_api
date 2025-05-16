const express = require('express');
const authController = require('./../controllers/authController');
const orderController = require('./../controllers/orderController');


const router = express.Router();

router.get('/', authController.protect, orderController.getUserOrders);
router.get('/orders/:id', authController.protect, orderController.getOrder);
router.patch('/orders/:id/cancel', authController.protect, orderController.cancelOrder);
router.post('/checkout-session', authController.protect, orderController.getCheckoutSession);
router.post('/paystack-webhook', orderController.handlePaystackWebhook);
router.get('/verify-payment/:reference', authController.protect, orderController.verifyPayment);


module.exports = router;