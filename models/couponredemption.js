'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class CouponRedemption extends Model {
    static associate(models) {
     
      CouponRedemption.belongsTo(models.Coupon, {
        foreignKey: 'couponId',
        as: 'coupon',
        onDelete: 'CASCADE'
      });
      CouponRedemption.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
        onDelete: 'CASCADE'
      });
    }
  }
  CouponRedemption.init({
    couponId: DataTypes.INTEGER,
    userId: DataTypes.INTEGER,
    redeemedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    modelName: 'CouponRedemption',
  });
  return CouponRedemption;
};