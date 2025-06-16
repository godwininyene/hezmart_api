'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Like extends Model {
    static associate(models) {
      Like.belongsTo(models.Product, { 
        foreignKey: 'productId',
        as: 'product',
        onDelete: 'CASCADE'
      });
      Like.belongsTo(models.User, { 
        foreignKey: 'userId',
        as: 'user',
        onDelete: 'CASCADE'
      });
    }
  }
  Like.init({
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: { msg: 'Please provide product id' },
        notEmpty: { msg: 'Product id cannot be empty' },
        isInt: { msg: 'Product id must be an integer' }
      },
      references: {
        model: 'Products',
        key: 'id'
      }
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: { msg: 'Please provide user id' },
        notEmpty: { msg: 'User id cannot be empty' },
        isInt: { msg: 'User id must be an integer' }
      },
      references: {
        model: 'Users',
        key: 'id'
      }
    }
  }, {
    sequelize,
    modelName: 'Like',
    tableName: 'likes', 
    indexes: [
      {
        unique: true,
        fields: ['productId', 'userId'],
        name: 'unique_like_constraint'
      }
    ]
  });
  return Like;
};