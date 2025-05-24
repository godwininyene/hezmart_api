'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class OrderItem extends Model {
    static associate(models) {
      // associations can be defined here
      OrderItem.belongsTo(models.Order, {
        foreignKey: 'orderId',
        as: 'order'
      });
      
      OrderItem.belongsTo(models.Product, {
        foreignKey: 'productId',
        as: 'product'
      });

      OrderItem.belongsTo(models.User, {
        foreignKey: 'vendorId',
        as: 'vendor'
      });
    
    }

    getTotalPrice() {
      return (this.discountPrice || this.price) * this.quantity;
    }
  }
  
  OrderItem.init({
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: { msg: 'Order ID is required' },
        isInt: { msg: 'Order ID must be an integer' }
      },
      references: {
        model: 'Orders',
        key: 'id'
      }
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: { msg: 'Product ID is required' },
        isInt: { msg: 'Product ID must be an integer' }
      },
      references: {
        model: 'Products',
        key: 'id'
      }
    },
      vendorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: { msg: 'Vendor ID is required' },
        isInt: { msg: 'Vendor ID must be an integer' }
      },
      references: {
        model: 'Users', 
        key: 'id'
      }
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: { msg: 'Quantity is required' },
        isInt: { msg: 'Quantity must be an integer' },
        min: {
          args: [1],
          msg: 'Quantity must be at least 1'
        }
      }
    },
    price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        notNull: { msg: 'Price is required' },
        min: {
          args: [0],
          msg: 'Price cannot be negative'
        }
      }
    },
    discountPrice: {
      type: DataTypes.DECIMAL(12, 2),
      validate: {
        min: {
          args: [0],
          msg: 'Discount price cannot be negative'
        },
        lessThanPrice(value) {
          if (value && parseFloat(value) >= parseFloat(this.price)) {
            throw new Error('Discount price must be less than regular price');
          }
        }
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
    modelName: 'OrderItem',
    hooks: {
      beforeCreate: async (orderItem) => {
        // If discount price is not provided, set it to null
        if (orderItem.discountPrice === undefined || orderItem.discountPrice === 0) {
          orderItem.discountPrice = null;
        }
      }
    }
  });
  
  return OrderItem;
};