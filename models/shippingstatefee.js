'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ShippingStateFee extends Model {
    static associate(models) {
      // ShippingStateFee.belongsTo(models.ShippingSetting, {
      //   foreignKey: 'shippingSettingId'
      // });
    }
  }

  ShippingStateFee.init({
    state: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [[
          "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa",
          "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo",
          "Ekiti", "Rivers", "Enugu", "FCT", "Gombe", "Imo", "Jigawa",
          "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos",
          "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau",
          "Sokoto", "Taraba", "Yobe", "Zamfara"
        ]]
      }
    },
    // deliveryType: {
    //   type: DataTypes.ENUM('door', 'pickup'),
    //   allowNull: false
    // },
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
    //   references: {
    //     model: 'shipping_settings',
    //     key: 'id'
    //   }
    // }
  }, {
    sequelize,
    modelName: 'ShippingStateFee',
    tableName: 'shipping_state_fees',
    indexes: [
      { fields: ['state'] },
      // { fields: ['deliveryType'] },
      // { fields: ['shippingSettingId'] },
      // { fields: ['state', 'deliveryType'], unique: true }
    ]
  });

  return ShippingStateFee;
};