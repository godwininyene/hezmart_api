'use strict';
const { Model, Op } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Order extends Model {
    static associate(models) {
      // associations can be defined here
      Order.belongsTo(models.User, { 
        foreignKey: 'userId',
        as: 'user'
      });
      
      Order.hasMany(models.OrderItem, {
        foreignKey: 'orderId',
        as: 'items'
      });
      
      Order.hasOne(models.Payment, {
        foreignKey: 'orderId',
        as: 'payment'
      });
      
      Order.hasOne(models.Shipment, {
        foreignKey: 'orderId',
        as: 'shipment'
      });
    }

    static async generateOrderNumber() {
      const prefix = 'ORD';
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      return `${prefix}-${timestamp}-${random}`;
    }

    async calculateTotals() {
      const items = await this.getItems();
      let subtotal = 0;
      let discount = 0;
      
      items.forEach(item => {
        subtotal += item.price * item.quantity;
        if (item.discountPrice) {
          discount += (item.price - item.discountPrice) * item.quantity;
        }
      });
      
      this.subtotal = subtotal;
      this.discount = discount;
      this.total = subtotal - discount + (this.deliveryFee || 0) + (this.tax || 0);
      return this;
    }
  }
  
  Order.init({
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: { msg: 'User ID is required' },
        isInt: { msg: 'User ID must be an integer' }
      },
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    orderNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notNull: { msg: 'Order number is required' },
        notEmpty: { msg: 'Order number cannot be empty' }
      }
    },
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'),
      defaultValue: 'pending',
      validate: {
        isIn: {
          args: [['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']],
          msg: 'Invalid order status'
        }
      }
    },
    subtotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        notNull: { msg: 'Subtotal is required' },
        min: {
          args: [0],
          msg: 'Subtotal cannot be negative'
        }
      }
    },
    discount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00,
      validate: {
        min: {
          args: [0],
          msg: 'Discount cannot be negative'
        }
      }
    },
    deliveryFee: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00,
      validate: {
        min: {
          args: [0],
          msg: 'Delivery fee cannot be negative'
        }
      }
    },
    tax: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00,
      validate: {
        min: {
          args: [0],
          msg: 'Tax cannot be negative'
        }
      }
    },
    total: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        notNull: { msg: 'Total is required' },
        min: {
          args: [0],
          msg: 'Total cannot be negative'
        }
      }
    },
    paymentMethod: {
      type: DataTypes.ENUM('card', 'bank_transfer', 'wallet', 'cash_on_delivery'),
      allowNull: false,
      validate: {
        notNull: { msg: 'Payment method is required' },
        isIn: {
          args: [['card', 'bank_transfer', 'wallet', 'cash_on_delivery']],
          msg: 'Invalid payment method'
        }
      }
    },
    paymentStatus: {
      type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'),
      defaultValue: 'pending',
      validate: {
        isIn: {
          args: [['pending', 'paid', 'failed', 'refunded']],
          msg: 'Invalid payment status'
        }
      }
    },
    deliveryAddress: {
      type: DataTypes.TEXT,
      allowNull: false,
      get() {
        const rawValue = this.getDataValue('deliveryAddress');
        try {
          return JSON.parse(rawValue);
        } catch (e) {
          return null;
        }
      },
      set(value) {
        if (typeof value === 'object' && value !== null) {
          this.setDataValue('deliveryAddress', JSON.stringify(value));
        } else {
          throw new Error('Delivery address must be an object');
        }
      },
      validate: {
        notNull: { msg: 'Delivery address is required' },
        isValidAddress(value) {
        
          
          let addressObj;
          try {
            addressObj = typeof value === 'string' ? JSON.parse(value) : value;
          } catch (err) {
            throw new Error('Delivery address must be a valid JSON object');
          }
          if (
            !addressObj.primaryAddress ||
            !addressObj.city ||
            !addressObj.country ||
            !addressObj.primaryPhone ||
            !addressObj.firstName
          ) {
            throw new Error('Delivery address must include primary address, name, city, primary phone, and country');
          }
        }
      }
    },
    trackingNumber: {
      type: DataTypes.STRING,
      validate: {
        notEmpty: { msg: 'Tracking number cannot be empty if provided' }
      }
    },
    notes: {
      type: DataTypes.TEXT,
      validate: {
        len: {
          args: [0, 500],
          msg: 'Notes cannot exceed 500 characters'
        }
      }
    }
  }, {
    sequelize,
    modelName: 'Order',
    paranoid: true,
    hooks: {
      beforeCreate: async (order) => {
        if (!order.orderNumber) {
          order.orderNumber = await Order.generateOrderNumber();
        }
      },
      beforeSave: async (order) => {
        if (order.changed('status') && order.status === 'cancelled') {
          order.paymentStatus = 'refunded';
        }
      },
      afterCreate: async (order) => {
        // Create payment record if needed
        const { Payment } = sequelize.models;
        if (order.paymentMethod !== 'cash_on_delivery') {
          await Payment.create({
            orderId: order.id,
            amount: order.total,
            status: 'pending',
            method: order.paymentMethod
          });
        }
      }
    },
    scopes: {
      withItems: {
        include: ['items']
      },
      active: {
        where: {
          status: {
            [Op.notIn]: ['cancelled', 'refunded']
          }
        }
      }
    }
  });
  
  return Order;
};