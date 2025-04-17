const catchAsync = require("../utils/catchAsync");
const { Category, Subcategory } = require('../models');
const AppError = require('../utils/appError');

// Create category
exports.createCategory = catchAsync(async (req, res, next) => {
  const category = await Category.create(req.body);
  res.status(200).json({
    status: "success",
    data: {
      category
    }
  });
});

// Get all categories
exports.getAllCategories = catchAsync(async (req, res, next) => {
  const categories = await Category.findAll();
  res.status(200).json({
    status: "success",
    result: categories.length,
    data: {
      categories
    }
  });
});

// Get category by ID with subcategories
exports.getCategory = catchAsync(async (req, res, next) => {
  const category = await Category.findByPk(req.params.id, {
    include: {
      model: Subcategory,
      as: 'subcategories' 
    }
  });

  if (!category) {
    return next(new AppError('No category was found with that ID', '', 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      category
    }
  });
});

// Delete category and its subcategories
exports.deleteCategory = catchAsync(async (req, res, next) => {
  // Then delete the category
  const deletedCount = await Category.destroy({
    where: { id: req.params.id }
  });

  if (deletedCount === 0) {
    return next(new AppError('No category was found with that ID', '', 404));
  }

  res.status(204).json({
    status: "success",
    data: null
  });
});
