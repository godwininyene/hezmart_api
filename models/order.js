'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Order extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Order.belongsTo(models.User, { 
        foreignKey: 'userId',
        as: 'user'
      });
      
      Order.hasMany(models.OrderItem, {
        foreignKey: 'orderId',
        as: 'items'
      });
    }

    static async generateOrderNumber() {
      const prefix = 'ORD';
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      return `${prefix}-${timestamp}-${random}`;
    }

    async calculateOrderStatus() {
      const items = await this.getItems();
      
      if (items.every(item => item.fulfillmentStatus === 'received')) {
        return 'completed';
      }
      if (items.every(item => ['received', 'returned'].includes(item.fulfillmentStatus))) {
        return 'closed';
      }
      if (items.some(item => item.fulfillmentStatus === 'received')) {
        return 'partially_received';
      }
      if (items.every(item => item.fulfillmentStatus === 'delivered')) {
        return 'delivered';
      }
      if (items.some(item => item.fulfillmentStatus === 'delivered')) {
        return 'partially_delivered';
      }
      if (items.some(item => item.fulfillmentStatus === 'shipped')) {
        return 'partially_shipped';
      }
      if (items.every(item => item.fulfillmentStatus === 'processing')) {
        return 'processing';
      }
      if (items.some(item => item.fulfillmentStatus === 'cancelled')) {
        return items.every(item => 
          item.fulfillmentStatus === 'cancelled') ? 'cancelled' : 'partially_cancelled';
      }
      return 'pending';
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
      type: DataTypes.ENUM(
        'pending',
        'processing',
        'partially_shipped',
        'shipped',
        'partially_delivered',
        'delivered',
        'partially_received',
        'completed',
        'partially_cancelled',
        'cancelled',
        'closed',
        'refunded'
      ),
      defaultValue: 'pending',
      validate: {
        isIn: {
          args: [[
            'pending',
            'processing',
            'partially_shipped',
            'shipped',
            'partially_delivered',
            'delivered',
            'partially_received',
            'completed',
            'partially_cancelled',
            'cancelled',
            'closed',
            'refunded'
          ]],
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
     customerNotes: {
      type: DataTypes.TEXT,
      validate: {
        len: {
          args: [0, 500],
          msg: 'Customer notes cannot exceed 500 characters'
        }
      }
    }
  }, {
    sequelize,
    modelName: 'Order',
    hooks:{
      afterUpdate: async (order) => {
        // Update order status based on items when relevant fields change
        if (order.changed('status') || order.changed('paymentStatus')) {
          const newStatus = await order.calculateOrderStatus();
          if (newStatus !== order.status) {
            await order.update({ status: newStatus });
          }
        }
      }
    }
  });
  return Order;
};