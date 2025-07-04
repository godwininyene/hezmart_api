const express = require('express');
const router = express.Router();
const {uploadWalletBarcode } = require('../utils/multerConfig');
const authController = require('../controllers/authController');
const paymentOptionController = require('./../controllers/paymentOptionController')

// Protect all the routes below
router.use(authController.protect);

router.route('/')
.post( 
    authController.restrictTo('admin'),
    uploadWalletBarcode,
    paymentOptionController.createPaymentOption
)
.get(paymentOptionController.getAllPaymentOptions)
router.route('/:id')
.patch(
    authController.restrictTo('admin'),
    uploadWalletBarcode,
    paymentOptionController.updatePayOption
)
.delete( authController.restrictTo('admin'), paymentOptionController.deletePayOption)


module.exports = router;