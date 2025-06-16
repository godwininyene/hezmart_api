const { Product, User, Like, sequelize } = require('../models');
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

// Optimized toggle like controller
exports.toggleLike = catchAsync(async (req, res, next) => {
  const { productId } = req.params;
  const userId = req.user.id;

  const result = await sequelize.transaction(async (t) => {
    // First check if product exists
    const product = await Product.findByPk(productId, { transaction: t });
    if (!product) {
      throw new AppError('No product found with that ID','', 404);
    }

    // Check if like exists and toggle in one operation
    const [like, created] = await Like.findOrCreate({
      where: { productId, userId },
      defaults: { productId, userId },
      transaction: t
    });

    if (!created) {
      // Unlike - destroy existing like
      await like.destroy({ transaction: t });
      await product.decrement('likesCount', { by: 1, transaction: t });
      return { liked: false, likesCount: product.likesCount - 1 };
    } else {
      // Like - increment count
      await product.increment('likesCount', { by: 1, transaction: t });
      return { liked: true, likesCount: product.likesCount + 1 };
    }
  });

  res.status(200).json({
    status: "success",
    data: result
  });
});

exports.deleteLike = catchAsync(async (req, res, next) => {
  const { productId } = req.params;
  const userId = req.user.id;

  // Start transaction to ensure data consistency
  const result = await sequelize.transaction(async (t) => {
    // 1. Find the like to be deleted
    const like = await Like.findOne({
      where: { productId, userId },
      transaction: t
    });

    if (!like) {
      throw new AppError('You have not liked this product','', 404);
    }

    // 2. Find the associated product
    const product = await Product.findByPk(productId, { transaction: t });
    if (!product) {
      throw new AppError('Product not found', '', 404);
    }

    // 3. Delete the like and decrement count
    await like.destroy({ transaction: t });
    await product.decrement('likesCount', { by: 1, transaction: t });

    return {
      liked: false,
      likesCount: product.likesCount - 1
    };
  });

  res.status(204).end();
});




// Get like status for a product
exports.getLikeStatus = catchAsync(async (req, res, next) => {
  const { productId } = req.params;
  const userId = req.user?.id;

  const product = await Product.findByPk(productId, {
    attributes: ['id', 'likesCount']
  });
  if (!product) {
    return next(new AppError('No product found with that ID', '', 404));
  }

  let liked = false;
  if (userId) {
    const like = await Like.findOne({
      where: { productId, userId }
    });
    liked = !!like;
  }

  res.status(200).json({
    status: "success",
    data: {
      liked,
      likesCount: product.likesCount
    }
  });
});



// Get all liked products for authenticated user
exports.getUserLikes = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const likes = await Like.findAll({
    where: { userId },
    include: [{
      model: Product,
      as: 'product',
      attributes: ['id', 'name', 'price', 'discountPrice', 'stockQuantity', 'coverImage', 'slug'],
      where: { status: 'active' }
    }],
    order: [['createdAt', 'DESC']]
  });

  res.status(200).json({
    status: "success",
    results: likes.length,
    data: {
      likes
    }
  });
});

// Get likes for a specific product
exports.getProductLikes = catchAsync(async (req, res, next) => {
  const { productId } = req.params;

  const likes = await Like.findAll({
    where: { productId },
    include: [{
      model: User,
      as: 'user',
      attributes: ['id', 'firstName', 'lastName', 'photo']
    }],
    order: [['createdAt', 'DESC']]
  });

  res.status(200).json({
    status: "success",
    results: likes.length,
    data: {
      likes
    }
  });
});

// Get most liked products
exports.getPopularProducts = catchAsync(async (req, res, next) => {
  const { limit = 10 } = req.query;

  const products = await Product.findAll({
    attributes: [
      'id', 
      'name', 
      'price', 
      'discountPrice', 
      'coverImage', 
      'slug',
      'likesCount',
      [sequelize.literal('(SELECT COUNT(*) FROM "likes" WHERE "likes"."productId" = "Product"."id")'), 'totalLikes']
    ],
    order: [
      [sequelize.literal('totalLikes'), 'DESC']
    ],
    limit: parseInt(limit),
    where: {
      status: 'active'
    }
  });

  res.status(200).json({
    status: "success",
    results: products.length,
    data: {
      products
    }
  });
});