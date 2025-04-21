const productController = require('./../controllers/productController');
const authController = require('./../controllers/authController')

const {uploadProductImages } = require('../utils/multerConfig');
const express = require('express');

const router = express.Router();

router.route('/')
    .get(productController.getAllProducts)
    .post(
        authController.protect,
        authController.restrictTo('admin'),
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
        authController.restrictTo('admin', 'vendor'),
        uploadProductImages,
        productController.updateProduct
    )



module.exports = router;