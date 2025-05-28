'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Review extends Model {
    static associate(models) {
      // define association here
      Review.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'reviewUser',
        onDelete: 'CASCADE', // If user is deleted, delete their reviews
        onUpdate: 'CASCADE'
      });
      Review.belongsTo(models.Product, {
        foreignKey: 'productId',
        as: 'user',
        onDelete: 'CASCADE', // If product is deleted, delete their reviews
        onUpdate: 'CASCADE'
      });
    }
  }
  Review.init({
    review:{
      type: DataTypes.STRING,
      allowNull:false,
      validate:{
        notNull:{msg: "Review cannot be empty"}
      }
    },
    rating:{
      type:DataTypes.INTEGER,
      validate: {
        min: {
          args: [1],
          msg: 'Rating must be above 1.0'
        },
        max: {
          args: [5],
          msg: 'Rating must be below 5.0'
        }
      }
    },
    productId:{
      type: DataTypes.INTEGER,
      references:{
        model:'Products',
        key: 'id'
      }
    },
    userId: {
      type: DataTypes.INTEGER,
      references:{
        model:'users',
        key: 'id'
      }
    }
  }, {
    sequelize,
    modelName: 'Review',
  });
  return Review;
};