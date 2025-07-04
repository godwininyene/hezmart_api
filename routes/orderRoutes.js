const express = require('express');
const authController = require('./../controllers/authController');
const orderController = require('./../controllers/orderController');


const router = express.Router();

router.get('/', authController.protect, orderController.getUserOrders);
router.get('/:id', authController.protect, orderController.getOrder);
router.patch('/:id/cancel', authController.protect, orderController.cancelOrder);
router.patch('/:id/confirm-payment', authController.protect, authController.restrictTo('admin'), orderController.confirmPayment);
router.patch('/items/:itemId/status', authController.protect, authController.restrictTo('admin'), orderController.updateItemStatus);
router.post('/checkout-session', authController.protect, orderController.getCheckoutSession);
router.post('/crypto-checkout', authController.protect, orderController.createCryptoOrder);
router.post('/paystack-checkout', orderController.handlePaystackWebhook);
router.get('/verify-payment/:reference', authController.protect, orderController.verifyPayment);


module.exports = router;