const express = require('express');
const authController = require('./../controllers/authController');
const categoryController = require('./../controllers/categoryController');

const router = express.Router();

router.route('/')
    .post(
        // authController.protect,
        authController.restrictTo('admin'),
        categoryController.createCategory   
    )
    .get(categoryController.getAllCategories)

router.route('/:id')
    .get(categoryController.getCategory)
    .delete(
        // authController.protect,
        authController.restrictTo('admin'),
        categoryController.deleteCategory
    )

module.exports = router;