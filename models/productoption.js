'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ProductOption extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      ProductOption.belongsTo(models.Product, {
        foreignKey: 'productId',
        as: 'product'
      });

      ProductOption.hasMany(models.OptionValue, {
        foreignKey: 'optionId',
        as: 'values'
      });
    }
  }
  ProductOption.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: 'Option name is required' },
        notEmpty: { msg: 'Option name cannot be empty' }
      }
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Products',
        key: 'id'
      }
    }
  }, {
    sequelize,
    modelName: 'ProductOption',
  });
  return ProductOption;
};