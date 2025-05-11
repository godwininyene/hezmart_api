'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Payment extends Model {
    static associate(models) {
      Payment.belongsTo(models.Order, {
        foreignKey: 'orderId',
        as: 'order'
      });
    }

    static async logPaymentEvent(orderId, eventData) {
      return this.create({
        orderId,
        status: eventData.status,
        amount: eventData.amount,
        method: eventData.method,
        reference: eventData.reference,
        gateway: eventData.gateway,
        details: eventData.rawResponse
      });
    }
  }

  Payment.init({
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: { msg: 'Order ID is required' },
        isInt: { msg: 'Order ID must be an integer' }
      }
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        notNull: { msg: 'Amount is required' },
        min: {
          args: [0.01],
          msg: 'Amount must be at least 0.01'
        }
      }
    },
    status: {
      type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'),
      defaultValue: 'pending',
      validate: {
        isIn: {
          args: [['pending', 'paid', 'failed', 'refunded']],
          msg: 'Invalid payment status'
        }
      }
    },
    method: {
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
    reference: {
      type: DataTypes.STRING,
      unique: true,
      validate: {
        notEmpty: { msg: 'Payment reference cannot be empty' }
      }
    },
    gateway: {
      type: DataTypes.STRING,
      validate: {
        notEmpty: { msg: 'Gateway name cannot be empty' }
      }
    },
    fees: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00,
      validate: {
        min: {
          args: [0],
          msg: 'Fees cannot be negative'
        }
      }
    },
    details: {
      type: DataTypes.JSON,
      validate: {
        isValidDetails(value) {
          if (value && typeof value !== 'object') {
            throw new Error('Payment details must be a valid object');
          }
        }
      }
    }
  }, {
    sequelize,
    modelName: 'Payment',
    hooks: {
      beforeCreate: (payment) => {
        if (payment.method === 'cash_on_delivery') {
          payment.status = 'paid';
        }
      }
    },
    indexes: [
      { fields: ['orderId'] },
      { fields: ['reference'], unique: true }
    ]
  });

  return Payment;
};