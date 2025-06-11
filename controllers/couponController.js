const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const { Coupon, Product, Category,Cart, CartItem, CouponRedemption, sequelize } = require('../models');
const generatePaginationMeta = require('../utils/pagination');
const APIFeatures = require("../utils/apiFeatures");

exports.createCoupon = catchAsync(async(req, res, next) => {
    const { 
        code, name, type, value, duration, durationDays, 
        appliesTo, usageLimit, limitAmount,
        productIds = [], categoryIds = []
    } = req.body;

    // Validate associations first (before creating coupon)
    if (appliesTo === 'products') {
        if (productIds.length === 0) {
           return next(new AppError('', { products: 'At least one product required' }, 400));
        }
        const products = await Product.findAll({ where: { id: productIds } });
        if (products.length !== productIds.length) {
              return next(new AppError('', { categories: 'At least one category required' }, 400));
        }
    }

    if (appliesTo === 'categories') {
        if (categoryIds.length === 0) {
            return next(new AppError('At least one category must be selected', 400));
        }
        const categories = await Category.findAll({ where: { id: categoryIds } });
        if (categories.length !== categoryIds.length) {
            return next(new AppError('One or more categories not found', 404));
        }
    }

    // Create coupon - model validations will handle field-level validation
    const coupon = await Coupon.create({
        code, name, type, value,
        duration,
        durationDays: duration === 'set' ? durationDays : null,
        appliesTo,
        usageLimit,
        remainingUses:usageLimit === 'limited' ? limitAmount : null,
        limitAmount: usageLimit === 'limited' ? limitAmount : null
    });

    // Establish associations
    if (appliesTo === 'products') {
        await coupon.addProducts(productIds);
    } else if (appliesTo === 'categories') {
        await coupon.addCategories(categoryIds);
    }

    // Fetch with associations
    const includeOptions = appliesTo === 'products' ? ['products'] : 
                         appliesTo === 'categories' ? ['categories'] : [];
    
    const createdCoupon = await Coupon.findByPk(coupon.id, {
        include: includeOptions
    });

    res.status(201).json({
        status: 'success',
        data: { coupon: createdCoupon }
    });
});

async function validateCouponForUser(code, userId, sessionId) {
  if (!code) {
    return {
      valid: false,
      message: 'Coupon code is required',
      errorCode: 'MISSING_CODE',
      statusCode: 400
    };
  }

  // Find coupon with associations
  const coupon = await Coupon.findOne({
    where: { code },
    include: [
      { 
        model: Product, 
        as: 'products',
        attributes: ['id'],
        through: { attributes: [] }
      },
      { 
        model: Category, 
        as: 'categories',
        attributes: ['id'],
        through: { attributes: [] }
      }
    ]
  });

  if (!coupon) {
    return {
      valid: false,
      message: 'Invalid coupon code',
      errorCode: 'INVALID_CODE',
      statusCode: 404
    };
  }

  // Check expiration
  if (coupon.duration === 'set' && coupon.durationDays) {
    const expirationDate = new Date(coupon.createdAt);
    expirationDate.setDate(expirationDate.getDate() + coupon.durationDays);
    
    if (new Date() > expirationDate) {
      return {
        valid: false,
        message: 'This coupon has expired',
        errorCode: 'EXPIRED_COUPON',
        statusCode: 400
      };
    }
  }

  // Check usage limits
  if (coupon.usageLimit === 'limited') {
    const usageCount = await CouponRedemption.count({
      where: { 
        couponId: coupon.id,
        userId
      }
    });

    if (usageCount >= coupon.limitAmount) {
      return {
        valid: false,
        message: 'This coupon has reached its usage limit',
        errorCode: 'USAGE_LIMIT_REACHED',
        statusCode: 400
      };
    }
  }

  // Validate against cart items
  const cart = await Cart.findOne({
   where: userId ? { userId } : { sessionId },
    include: {
      model: CartItem,
      as: 'items',
      include: [{
        model: Product,
        as: 'product',
        attributes: ['id', 'price', 'discountPrice', 'categoryId'],
        include: [{
          model: Category,
          as: 'category',
          attributes: ['id'] // Only need the ID for category
        }]
      }]
    }
  });

  if (!cart?.items?.length) {
    return {
      valid: false,
      message: 'Your cart is empty',
      errorCode: 'EMPTY_CART',
      statusCode: 400
    };
  }
  
  // Prepare cart items data
   const cartItems = cart.items.map(item => ({
    productId: item.product.id,
    categoryId: item.product.categoryId,
    price: parseFloat(item.product.discountPrice || item.product.price),
    quantity: item.quantity
  }));

  // Check applicability
  let applicableItems = [];
  switch (coupon.appliesTo) {
    case 'products':
      const couponProductIds = coupon.products.map(p => p.id);
      applicableItems = cartItems.filter(item => 
        couponProductIds.includes(item.productId)
      );
      break;

    case 'categories':
      const couponCategoryIds = coupon.categories.map(c => c.id);
      applicableItems = cartItems.filter(item => 
        item.categoryId && couponCategoryIds.includes(item.categoryId)
      );
      break;

    case 'all':
      applicableItems = [...cartItems];
      break;
  }

  if (!applicableItems.length) {
    return {
      valid: false,
      message: 'Coupon not applicable to cart items',
      errorCode: 'INAPPLICABLE_COUPON',
      statusCode: 400
    };
  }

  // Calculate discount
  const subtotal = applicableItems.reduce((sum, item) => 
    sum + (item.price * item.quantity), 0);
  
  let discountAmount = 0;
  switch (coupon.type) {
    case 'fixed':
      discountAmount = Math.min(coupon.value, subtotal);
      
      break;
    case 'percentage':
      discountAmount = subtotal * (coupon.value / 100);
      break;
    case 'priceDiscount':
      discountAmount = subtotal >= coupon.value ? coupon.value : 0;
      break;
    case 'freeShipping':
      discountAmount = 0; // Will be handled in shipping calculation
      break;
  }

  return {
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      name: coupon.name,
      type: coupon.type,
      discountAmount,
      appliesTo: coupon.appliesTo
    }
  };
}

async function getCartSummary(userId, sessionId, transaction = null) {
  const options = {
    where: userId ? { userId } : { sessionId },
    include: [{
      model: CartItem,
      as: 'items',
      include: [{
        model: Product,
        as: 'product',
        attributes: ['id', 'name', 'price', 'discountPrice']
      }]
    }],
    ...(transaction && { transaction })
  };

  const cart = await Cart.findOne(options);
  if (!cart) {
    throw new Error('Cart not found');
  }

  // Calculate totals
  let subtotal = 0;
  let itemCount = 0;
  
  const items = cart.items.map(item => {
    const price = item.product.discountPrice || item.product.price;
    const total = price * item.quantity;
    subtotal += total;
    itemCount += item.quantity;
    
    return {
      id: item.id,
      productId: item.product.id,
      name: item.product.name,
      price,
      quantity: item.quantity,
      total
    };
  });

  const discount = cart.discountAmount || 0;
  const total = Math.max(0, subtotal - discount);

  return {
    subtotal,
    discount,
    total,
    itemCount,
    items
  };
}
exports.applyCoupon = catchAsync(async (req, res, next) => {
  const { code } = req.body;
  const userId = req.user?.id || null;
  const sessionId = req.sessionId;

  // 1. Validate the coupon
  const validation = await validateCouponForUser(code, userId, sessionId);
  if (!validation.valid) {
    return next(new AppError(
      validation.message || 'Invalid coupon',
      { code: validation.errorCode || 'INVALID_COUPON' },
      validation.statusCode || 400
    ));
  }

  // 2. Apply to cart
  const transaction = await sequelize.transaction();
  try {
    // Update cart with coupon
   const updateFields = {
        couponId: validation.coupon.id,
        discountAmount: validation.coupon.discountAmount,
        ...(userId ? { userId } : { sessionId })
    };
    const whereClause = userId ? { userId } : { sessionId };

   await Cart.update(updateFields, {
      where: whereClause,
        transaction
    });

    // Create redemption record
    await CouponRedemption.create({
      couponId: validation.coupon.id,
      userId,
      redeemedAt: new Date()
    }, { transaction });

    // Decrease remainingUses if usageLimit is limited
    const coupon = await Coupon.findByPk(validation.coupon.id, { transaction });
    await coupon.decrementUsage(transaction);

    // Get updated cart summary
    const cartSummary = await getCartSummary(userId, sessionId, transaction);

    await transaction.commit();

    res.status(200).json({
      status: 'success',
      data: {
        appliedCoupon: validation.coupon.code,
        discount: validation.coupon.discountAmount,
        ...cartSummary
      }
    });

  } catch (error) {
    console.log('Error', error);
    
    await transaction.rollback();
    return next(new AppError(
      'Failed to apply coupon',
      { code: 'APPLICATION_ERROR' },
      500
    ));
  }
});

exports.getAllCoupons = catchAsync(async (req, res, next) => {
    console.log(req.query);
    
  // 1. Initialize APIFeatures
  const features = new APIFeatures(req.query, 'Coupon')
    .filter()
    .sort()
    .limitFields()
    .paginate();

  // 2. Add coupon-specific includes if needed
  if (req.query.include === 'products') {
    features.queryOptions.include.push({
      model: Product,
      as: 'products',
      attributes: ['id', 'name'],
      through: { attributes: [] }
    });
  }

  if (req.query.include === 'categories') {
    features.queryOptions.include.push({
      model: Category,
      as: 'categories',
      attributes: ['id', 'name'],
      through: { attributes: [] }
    });
  }

  // 3. Execute query with count
  const { count, rows: coupons } = await Coupon.findAndCountAll(features.getOptions());
  const { page, limit } = features.getPaginationInfo();
  const pagination = generatePaginationMeta({ count, page, limit, req });

  // 4. Send response
  res.status(200).json({
    status: "success",
    results: coupons.length,
    pagination,
    data: {
      coupons
    }
  });
});



exports.deleteCoupon = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  // 1. Find the coupon 
  const coupon = await Coupon.findByPk(id);
  
  if (!coupon) {
    return next(new AppError('No coupon found with that ID','', 404));
  }

  // 2. Delete the coupon
  await coupon.destroy();
  // 3. Send success response
  res.status(204).json({
    status: 'success',
    data: null
  });
});


// Helper function to format coupon value display
function formatCouponValue(coupon) {
  switch (coupon.type) {
    case 'percentage':
      return `${coupon.value}% off`;
    case 'fixed':
      return `$${coupon.value} off`;
    case 'freeShipping':
      return 'Free Shipping';
    case 'priceDiscount':
      return `$${coupon.value} discount`;
    default:
      return coupon.value;
  }
}

exports.getCoupon = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // 1. Determine which associations to include based on query params
  const include = [];
  
  if (req.query.include === 'all' || req.query.include?.includes('products')) {
    include.push({
      model: Product,
      as: 'products',
      attributes: ['id', 'name', 'price'],
      through: { attributes: [] } // Exclude junction table attributes
    });
  }

  if (req.query.include === 'all' || req.query.include?.includes('categories')) {
    include.push({
      model: Category,
      as: 'categories',
      attributes: ['id', 'name'],
      through: { attributes: [] }
    });
  }

  // 2. Fetch the coupon with selected associations
  const coupon = await Coupon.findByPk(id, {
    include,
    attributes: {
      exclude: ['updatedAt'] // Exclude if not needed
    }
  });

  // 3. Handle not found case
  if (!coupon) {
    return next(new AppError('No coupon found with that ID', '', 404));
  }

  // 4. Format the response based on coupon type
  const formattedCoupon = {
    ...coupon.get({ plain: true }),
    displayValue: formatCouponValue(coupon)
  };

  // 5. Send response
  res.status(200).json({
    status: 'success',
    data: {
      coupon: formattedCoupon
    }
  });
});


exports.updateCoupon = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const {
    code,
    name,
    type,
    value,
    duration,
    durationDays,
    appliesTo,
    usageLimit,
    limitAmount,
    productIds = [],
    categoryIds = []
  } = req.body;

  // 1. Start a transaction
  const transaction = await sequelize.transaction();

  try {
    // 2. Find the coupon
    const coupon = await Coupon.findByPk(id, { transaction });
    if (!coupon) {
      await transaction.rollback();
      return next(new AppError('No coupon found with that ID','', 404));
    }

    // 3. Validate associations exist if specified
    if (appliesTo === 'products' && productIds.length > 0) {
      const products = await Product.findAll({
        where: { id: productIds },
        transaction
      });
      if (products.length !== productIds.length) {
        await transaction.rollback();
        return next(new AppError('One or more products not found','', 404));
      }
    }

    if (appliesTo === 'categories' && categoryIds.length > 0) {
      const categories = await Category.findAll({
        where: { id: categoryIds },
        transaction
      });
      if (categories.length !== categoryIds.length) {
        await transaction.rollback();
        return next(new AppError('One or more categories not found','', 404));
      }
    }

    // 4. Update coupon fields
    await coupon.update({
      code,
      name,
      type,
      value,
      duration,
      durationDays: duration === 'set' ? durationDays : null,
      appliesTo,
      usageLimit,
      limitAmount: usageLimit === 'limited' ? limitAmount : null
    }, { transaction });

    // 5. Update associations
    if (appliesTo === 'products') {
      await coupon.setProducts(productIds, { transaction });
    } else if (appliesTo === 'categories') {
      await coupon.setCategories(categoryIds, { transaction });
    } else {
      // For 'all', remove all associations
      await coupon.setProducts([], { transaction });
      await coupon.setCategories([], { transaction });
    }

    // 6. Commit the transaction
    await transaction.commit();

    // 7. Fetch the updated coupon with associations
    const include = [];
    if (appliesTo === 'products') {
      include.push({
        model: Product,
        as: 'products',
        attributes: ['id', 'name'],
        through: { attributes: [] }
      });
    } else if (appliesTo === 'categories') {
      include.push({
        model: Category,
        as: 'categories',
        attributes: ['id', 'name'],
        through: { attributes: [] }
      });
    }

    const updatedCoupon = await Coupon.findByPk(id, {
      include,
      attributes: { exclude: ['updatedAt'] }
    });

    res.status(200).json({
      status: 'success',
      data: {
        coupon: updatedCoupon
      }
    });

  } catch (error) {
    await transaction.rollback();
    return next(new AppError(error.message || 'Failed to update coupon','', 500));
  }
});
