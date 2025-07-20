'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Order extends Model {
    static associate(models) {
      // define association here
      Order.belongsTo(models.User, { 
        foreignKey: 'userId',
        as: 'user'
      });
      
      Order.hasMany(models.OrderItem, {
        foreignKey: 'orderId',
        as: 'items',
        onDelete: 'CASCADE'// If order is deleted, delete its orderItem
      });
      Order.belongsTo(models.Coupon, {
        foreignKey: 'couponId',
        as: 'coupon'
      });
    }

    static async generateOrderNumber() {
      const prefix = 'HE';
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
      type: DataTypes.ENUM('card', 'bank_transfer', 'wallet', 'cash_on_delivery', 'crypto'),
      allowNull: false,
      validate: {
        notNull: { msg: 'Payment method is required' },
        isIn: {
          args: [['card', 'bank_transfer', 'wallet', 'cash_on_delivery', 'crypto']],
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
    deliveryOption: {
      type: DataTypes.ENUM('door', 'pickup'),
      allowNull: false,
      validate: {
        notNull: { msg: 'Delivery option is required and the values are pickup or door' }
      }
    },
    stateFeeDetails: {
      type: DataTypes.TEXT,
      allowNull: true, // Only required for pickup
      get() {
        const rawValue = this.getDataValue('stateFeeDetails');
        try {
          return JSON.parse(rawValue);
        } catch (e) {
          return null;
        }
      },
      set(value) {
        if(value){
          if (typeof value === 'object' && value !== null) {
            this.setDataValue('stateFeeDetails', JSON.stringify(value));
          } else {
            throw new Error('State fee Details address must be an object');
          }
        }
      },
    },
    pickupStationDetails: {
      type: DataTypes.TEXT,
      allowNull: true, // Only required for pickup
      get() {
        const rawValue = this.getDataValue('pickupStationDetails');
        try {
          return JSON.parse(rawValue);
        } catch (e) {
          return null;
        }
      },
      set(value) {
        if(value){
          if (typeof value === 'object' && value !== null) {
            this.setDataValue('pickupStationDetails', JSON.stringify(value));
          } else {
            throw new Error('Pickup station Details address must be an object');
          }
        }
      },
    },
    walletDetails: {
      type: DataTypes.TEXT,
      allowNull: true, // Only required for crypto payment method
       get() {
        const rawValue = this.getDataValue('walletDetails');
        try {
          return JSON.parse(rawValue);
        } catch (e) {
          return null;
        }
      },
      set(value) {
        if(value){
          if (typeof value === 'object' && value !== null) {
            this.setDataValue('walletDetails', JSON.stringify(value));
          } else {
            throw new Error('wallet Details address must be an object');
          }
        }
      },
    },
    couponId: DataTypes.INTEGER,
    couponCode: DataTypes.STRING,
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
            !addressObj.state ||
            !addressObj.primaryPhone ||
            !addressObj.firstName ||
            !addressObj.lastName || 
            !addressObj.email
          ) {
            throw new Error('Delivery address must include primary address, firstname, lastname, state, email, and primary phone');
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