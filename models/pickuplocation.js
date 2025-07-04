// models/pickupLocation.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PickupLocation extends Model {
    static associate(models) {
      // PickupLocation.belongsTo(models.ShippingSetting, {
      //   foreignKey: 'shippingSettingId'
      // });
    }
  }

  PickupLocation.init({
    state: {
      type: DataTypes.STRING,
      allowNull: false,
        validate: {
        notNull: { msg: "Please provide state" }
      }
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
        validate: {
        notNull: { msg: "Please provide pickup station name" }
      }
    },
    address: {
      type: DataTypes.STRING,
      allowNull: false,
        validate: {
        notNull: { msg: "Please provide address" }
      }
    },
    contactPhone: {
      type: DataTypes.STRING,
      allowNull: false,
        validate: {
        notNull: { msg: "Provide contact phone number" }
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
    // shippingSettingId: {
    //   type: DataTypes.INTEGER,
    //   allowNull: false,
    //   validate:{
    //     notNull:{msg:'Shipping setting id is required'}
    //   },
    //   references: {
    //     model: 'shipping_settings',
    //     key: 'id'
    //   }
    // }
  }, {
    sequelize,
    modelName: 'PickupLocation',
    tableName: 'pickup_locations'
  });

  return PickupLocation;
};