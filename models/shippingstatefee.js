'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ShippingStateFee extends Model {
    static associate(models) {
    }
  }

  ShippingStateFee.init({
    state: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull:{msg: 'Please provide state'}
      }
    },
    fee: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0,
        notNull:{msg:'Please provide fee'}
      }
    },
  }, {
    sequelize,
    modelName: 'ShippingStateFee',
    tableName: 'shipping_state_fees',
    indexes: [
      { fields: ['state'] },
    ]
  });

  return ShippingStateFee;
};