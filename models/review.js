'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Review extends Model {
    static associate(models) {
      Review.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'reviewUser',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
      Review.belongsTo(models.Product, {
        foreignKey: 'productId',
        as: 'user',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
    }

    static async calcAverageRatings(productId) {
      const { Review, Product } = require('../models');

      const result = await Review.findAll({
        where: { productId },
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('rating')), 'nRating'],
          [sequelize.fn('AVG', sequelize.col('rating')), 'avgRating']
        ],
        raw: true
      });

      const nRating = parseInt(result[0].nRating, 10) || 0;
      const avgRating = parseFloat(result[0].avgRating) || 0;

      await Product.update(
        {
          ratingsQuantity: nRating,
          ratingsAverage: avgRating
        },
        {
          where: { id: productId }
        }
      );
    }
  }

  Review.init({
    review: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: "Review cannot be empty" }
      }
    },
    rating: {
      type: DataTypes.INTEGER,
      validate: {
        min: { args: [1], msg: 'Rating must be above 1.0' },
        max: { args: [5], msg: 'Rating must be below 5.0' }
      }
    },
    productId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'Products',
        key: 'id'
      }
    },
    userId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    sequelize,
    modelName: 'Review',
  });

  // Hooks
  Review.afterCreate(async (review, options) => {
    await Review.calcAverageRatings(review.productId);
  });

  Review.afterUpdate(async (review, options) => {
    await Review.calcAverageRatings(review.productId);
  });

  Review.afterDestroy(async (review, options) => {
    await Review.calcAverageRatings(review.productId);
  });

  return Review;
};
