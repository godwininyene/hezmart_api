const express = require('express');
const authController = require('./../controllers/authController');
const categoryController = require('./../controllers/categoryController');
const subcategoryRouter = require('./subCategoryRoutes')
const {uploadCategoryIcon } = require('../utils/multerConfig');

const router = express.Router();

router.use('/:categoryId/subcategories', subcategoryRouter);

router.route('/')
    .post(
        authController.protect,
        authController.restrictTo('admin'),
        uploadCategoryIcon,
        categoryController.createCategory   
    )
    .get(categoryController.getAllCategories)

router.route('/:id')
    .get(categoryController.getCategory)
    .delete(
        authController.protect,
        authController.restrictTo('admin'),
        categoryController.deleteCategory
    )
    .patch(
        authController.protect,
        authController.restrictTo('admin'),
        uploadCategoryIcon,
        categoryController.updateCategory
    )

module.exports = router;