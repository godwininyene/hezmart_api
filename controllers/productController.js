const ProductService = require('../services/productService');
const { parseField, handleFileUploads } = require('../utils/productHelpers');
const APIFeatures = require("../utils/apiFeatures");
const { Product, Tag, ProductOption, OptionValue, sequelize } = require("../models");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const { getProductIncludes } = require('../utils/productHelpers');

exports.createProduct = catchAsync(async (req, res, next) => {
  //Handle Files upload
  handleFileUploads(req);
  //Parse field
  ['shippingCountries', 'options', 'tags'].forEach(field => {
    req.body[field] = parseField(field, req.body[field]);
  });

  //Create with association
  const product = await ProductService.createWithAssociations(req.body);
  //Send Response
  res.status(201).json({
    status: "success",
    data: { product }
  });
});

exports.getAllProducts = catchAsync(async(req, res, next) => {
  const features = new APIFeatures(req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const products = await Product.findAll(features.getOptions());
  
  res.status(200).json({
    status: "success",
    result: products.length,
    data: { products }
  });
});

exports.getProduct = catchAsync(async(req, res, next) => {
  const product = await Product.findByPk(req.params.id, {
    include: getProductIncludes()
  });

  if (!product) {
    return next(new AppError('No product found with that ID', '', 404));
  }
  
  res.status(200).json({
    status: "success",
    data: { product }
  });
});

exports.updateProduct = catchAsync(async (req, res, next) => {
  // 1. Handle file uploads
  const product = await Product.findByPk(req.params.id);
  if (!product) {
    return next(new AppError('No product found with that ID','', 404));
  }

  handleFileUploads(req, product.images || []);

  // 2. Parse JSON fields
  ['shippingCountries', 'options', 'tags'].forEach(field => {
    req.body[field] = parseField(field, req.body[field]);
  });

  try {
    // 3. Delegate to service layer
    const updatedProduct = await ProductService.updateWithAssociations(
      req.params.id, 
      req.body
    );

    res.status(200).json({
      status: "success",
      data: { product: updatedProduct }
    });

  } catch (error) {
    console.error('Product update failed:', error);
    return next(error)
  }
});


exports.deleteProduct = catchAsync(async (req, res, next) => {
  try {
    await ProductService.deleteProduct(req.params.id);
    res.status(204).json({
      status: "success",
      data: null
    });
  } catch (error) {
    console.log(error);
    
    if (error.message === 'Product not found') {
      return next(new AppError('No product found with that ID', '', 404));
    }
    return next(new AppError('Failed to delete product', '', 500));
  }
});