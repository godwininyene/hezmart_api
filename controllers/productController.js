const ProductService = require('../services/productService');
const { parseField, handleFileUploads } = require('../utils/productHelpers');
const APIFeatures = require("../utils/apiFeatures");
const { Product,  User, Category } = require("../models");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const { getProductIncludes } = require('../utils/productHelpers');
const Email = require('../utils/email');
const generatePaginationMeta = require('../utils/pagination');

exports.createProduct = catchAsync(async (req, res, next) => {
  //Handle Files upload
  handleFileUploads(req);
  //Parse field
  ['shippingCountries', 'options', 'tags'].forEach(field => {
    req.body[field] = parseField(field, req.body[field]);
  });

  //Create with association
  req.body.userId =req.user.id
  const product = await ProductService.createWithAssociations(req.body);
  //Send Response
  res.status(201).json({
    status: "success",
    data: { product }
  });
});

exports.getAllProducts = catchAsync(async(req, res, next) => {
  const features = new APIFeatures(req.query, 'Product')
    .filter()
    .sort()
    .limitFields()
    .paginate();

    // Include category model
   features.queryOptions.include = 
   [
    {
      model: Category,
      as:'category',
      attributes:['name', 'id']
    },
    {
      model: User,
      as:'user',
      attributes:['businessName', 'id']
    }
   ];

    // Execute the query with count
    const { count, rows: products } = await Product.findAndCountAll(features.getOptions());
    const { page, limit } = features.getPaginationInfo();
    const pagination = generatePaginationMeta({ count, page, limit, req });

  
  res.status(200).json({
    status: "success",
    result: products.length,
    pagination,
    data:{
      products
    }
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

exports.updateStatus = catchAsync(async(req, res, next)=>{

  const { action } = req.params; // approve, reject or suspend
  // Retrieve product, and user
  let product = await Product.findByPk(req.params.id, {
    include:[
      {
        model:User,
        as:'user',
        attributes:['firstName', 'lastName', 'email']
      }
    ]
  });

  if (!product) {
    return next(new AppError("No product was found with that ID", '', 404));
  }

  // Status checks
  switch(action) {
    case 'approve':
      if (product.status === 'active') {
        return next(new AppError("Product already approved!", '', 400));
      }
      product.status = 'active';
      break;
    case 'reject':
      if (product.status === 'declined') {
        return next(new AppError("Product already declined!", '', 400));
      }
      product.status = 'declined';
      break;
    case 'suspend':
      if (product.status === 'suspended') {
        return next(new AppError("Product already suspended!", '', 400));
      }
      product.status = 'suspended';
      break;
    default:
      return next(new AppError("Invalid action provided", '', 400));
  }
  




  // Prepare email info
  const referer = req.get('referer') || `${req.protocol}://${req.get('host')}`;
  const url = `${referer}/manage/vendor/dashboard`;
  
     
  const types = {
    approve: 'approved_product',
    suspend:'suspended_product',
    reject:'declined_product'
  };
  
  // Set email info based on action and transaction type
  const type = types[action];
  
  //save updates
  await product.save({ validateBeforeSave: false });

  const actionMessages = {
    approve: 'approved',
    reject: 'rejected',
    suspend: 'suspended'
  };
  
  const pastAction = actionMessages[action];
  

  try {
    // Send email to vendor
    await new Email(product.user, '', url, type).sendProductStatus()
    res.status(200).json({
      status: 'success',
      message: `Product ${pastAction} successfully!`,
      data: { product }
    });
  } catch (error) {
   
    console.log('Product processing error:', error);
    return next(new AppError(
      `Product ${pastAction} successfully but there was a problem sending email notification.`,
      '',
      500
    ));
  }
})