const express = require('express');
const authController = require('./../controllers/authController');
const orderController = require('./../controllers/orderController');


const router = express.Router();

router.get('/', authController.protect, orderController.getUserOrders);
router.get('/:id', authController.protect, orderController.getOrder);
router.patch('/:id/cancel', authController.protect, orderController.cancelOrder);
router.patch('/items/:itemId/status', authController.protect, orderController.updateItemStatus);
router.post('/checkout-session', authController.protect, orderController.getCheckoutSession);
router.post('/paystack-checkout', orderController.handlePaystackWebhook);
router.get('/verify-payment/:reference', authController.protect, orderController.verifyPayment);


module.exports = router;