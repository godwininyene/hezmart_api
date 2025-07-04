'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PaymentOption extends Model {
    static associate(models) {
      // define association here
    }
  }
  PaymentOption.init({
    networkName:{
      type: DataTypes.STRING,
      allowNull:false,
      validate:{
        notNull:{msg: 'Please provide network name'},
        notEmpty:{msg:'Network name cannot be empty'}
      }
    },
    walletAddress:{
      type: DataTypes.STRING,
      allowNull:false,
      validate:{
        notNull:{msg:' Please provide wallet address'},
        notEmpty:{msg: 'Wallet address cannot be empty'}
      }
    },
    barcode: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'PaymentOption',
    tableName:'paymentOptions'
  });
  return PaymentOption;
};