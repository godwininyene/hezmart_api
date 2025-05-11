'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Shipment extends Model {
    static associate(models) {
      Shipment.belongsTo(models.Order, {
        foreignKey: 'orderId',
        as: 'order'
      });
    }

    static getCarriers() {
      return ['dhl', 'fedex', 'ups', 'local'];
    }

    getTrackingUrl() {
      const carriers = {
        dhl: `https://www.dhl.com/track?id=${this.trackingNumber}`,
        fedex: `https://www.fedex.com/fedextrack/?trknbr=${this.trackingNumber}`,
        ups: `https://www.ups.com/track?tracknum=${this.trackingNumber}`,
        local: null
      };
      return carriers[this.carrier] || null;
    }
  }

  Shipment.init({
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: { msg: 'Order ID is required' },
        isInt: { msg: 'Order ID must be an integer' }
      }
    },
    carrier: {
      type: DataTypes.ENUM('dhl', 'fedex', 'ups', 'local'),
      allowNull: false,
      validate: {
        notNull: { msg: 'Carrier is required' },
        isIn: {
          args: [['dhl', 'fedex', 'ups', 'local']],
          msg: 'Invalid carrier'
        }
      }
    },
    trackingNumber: {
      type: DataTypes.STRING,
      validate: {
        notEmpty: { msg: 'Tracking number cannot be empty' }
      }
    },
    cost: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        notNull: { msg: 'Shipping cost is required' },
        min: {
          args: [0],
          msg: 'Shipping cost cannot be negative'
        }
      }
    },
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'shipped', 'delivered', 'failed'),
      defaultValue: 'pending',
      validate: {
        isIn: {
          args: [['pending', 'processing', 'shipped', 'delivered', 'failed']],
          msg: 'Invalid shipment status'
        }
      }
    },
    estimatedDelivery: {
      type: DataTypes.DATE,
      validate: {
        isDate: { msg: 'Invalid delivery date' },
        isAfterNow(value) {
          if (value && new Date(value) <= new Date()) {
            throw new Error('Delivery date must be in the future');
          }
        }
      }
    },
    address: {
      type: DataTypes.JSON,
      allowNull: false,
      validate: {
        notNull: { msg: 'Shipping address is required' },
        isValidAddress(value) {
          if (!value || !value.street || !value.city || !value.country) {
            throw new Error('Address must include street, city, and country');
          }
        }
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
    modelName: 'Shipment',
    hooks: {
      beforeCreate: (shipment) => {
        if (shipment.carrier === 'local' && !shipment.trackingNumber) {
          shipment.trackingNumber = `LOCAL-${Date.now()}`;
        }
      }
    },
    indexes: [
      { fields: ['orderId'] },
      { fields: ['trackingNumber'] }
    ]
  });

  return Shipment;
};