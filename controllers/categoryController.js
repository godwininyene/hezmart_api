const catchAsync = require("../utils/catchAsync");
const { Category, SubCategory } = require('../models');
const AppError = require('../utils/appError');
const APIFeatures = require("../utils/apiFeatures");

// Create category
exports.createCategory = catchAsync(async (req, res, next) => {
  
  const host = `${req.protocol}://${req.get('host')}`;

  if (req.file) {
    req.body.icon = `${host}/uploads/categoryIcons/${req.file.filename}`;
  }
  const category = await Category.create(req.body);

  res.status(200).json({
    status: "success",
    data: {
      category
    }
  });
});

// Update category
exports.updateCategory = catchAsync(async (req, res, next) => {
  const host = `${req.protocol}://${req.get('host')}`;

  // Update icon path if file was uploaded
  if (req.file) {
    req.body.icon = `${host}/uploads/categoryIcons/${req.file.filename}`;
  }

  // Update the category
  const [affectedRows] = await Category.update(req.body, {
    where: { id: req.params.id }
  });

  // Check if any rows were affected
  if (affectedRows === 0) {
    return next(new AppError('No category was found with that ID','', 404));
  }

  // Fetch the updated category
  const updatedCategory = await Category.findByPk(req.params.id, {
    include: {
      model: SubCategory,
      as: 'subcategories'
    }
  });

  res.status(200).json({
    status: "success",
    data: {
      category: updatedCategory
    }
  });
});

// Get all categories
exports.getAllCategories = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(req.query)
  .limitFields()
   // Include category model
   features.queryOptions.include = 
   {
     model: SubCategory,
     as:'subcategories',
     attributes:['name', 'id']
   };

const categories = await Category.findAll(features.getOptions());

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
      model: SubCategory,
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
