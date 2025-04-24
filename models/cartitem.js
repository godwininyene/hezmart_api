'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class CartItem extends Model {
    static associate(models) {
      CartItem.belongsTo(models.Cart, { 
        foreignKey: 'cartId',
        onDelete: 'CASCADE' 
      });
      CartItem.belongsTo(models.Product, { 
        foreignKey: 'productId',
        as: 'product',
        onDelete: 'CASCADE'
      });
    }
  }
  CartItem.init({
    cartId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: {msg: 'Please provide cart id'},
        notEmpty: {msg: 'Cart id cannot be empty'}
      },
      references: {
        model: 'Carts',
        key: 'id'
      }
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: {msg: 'Please provide product id'},
        notEmpty: {msg: 'Product id cannot be empty'}
      },
      references: {
        model: 'Products',
        key: 'id'
      }
    },
    quantity: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      validate: {
        min: 1
      }
    },
    selectedOptions: {
      type: DataTypes.TEXT,
      defaultValue: '[]',
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('selectedOptions');
        return rawValue ? JSON.parse(rawValue) : [];
      },
      set(value) {
        this.setDataValue('selectedOptions', JSON.stringify(value || []));
      }
    }
  }, {
    sequelize,
    modelName: 'CartItem',
  });
  return CartItem;
};