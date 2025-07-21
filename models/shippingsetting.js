'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ShippingSetting extends Model {
    static associate(models) {
    }

    static async getActiveSettings() {
      return await ShippingSetting.findOne({
        where: { isActive: true },
      });
    }
  }

  ShippingSetting.init({
    doorDeliveryEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    pickupEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    minShippingEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    shippingMinAmount: {
      type: DataTypes.INTEGER,
      defaultValue: 8000
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    updatedBy: {
      type: DataTypes.INTEGER,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    sequelize,
    modelName: 'ShippingSetting',
    tableName: 'shipping_settings',
    hooks: {
      beforeSave: async (setting) => {
        if (setting.isActive && setting.changed('isActive')) {
          await ShippingSetting.update({ isActive: false }, {
            where: { isActive: true }
          });
        }
      }
    }
  });

  return ShippingSetting;
};