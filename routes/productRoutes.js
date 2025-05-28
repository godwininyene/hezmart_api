const productController = require('./../controllers/productController');
const authController = require('./../controllers/authController')
const {uploadProductImages } = require('../utils/multerConfig');
const reviewRouter = require('./reviewRoutes')
const express = require('express');

const router = express.Router();
router.use('/:productId/reviews', reviewRouter);

router.route('/')
    .get(authController.maybeProtect, productController.getAllProducts)
    .post(
        authController.protect,
        authController.restrictTo('vendor'),
        uploadProductImages,
        productController.createProduct
    )
router.route('/:id')
    .get(productController.getProduct)
    .delete(
        authController.protect,
        authController.restrictTo('admin', 'vendor'),
        productController.deleteProduct
    )
    .patch(
        authController.protect,
        authController.restrictTo('vendor'),
        uploadProductImages,
        productController.updateProduct
    )

    router.route('/:id/status').patch(
        authController.protect,
        authController.restrictTo('admin'),
        productController.updateStatus)

module.exports = router;