'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class OptionValue extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      OptionValue.belongsTo(models.ProductOption, {
        foreignKey: 'optionId',
        as: 'option',
        onDelete: 'CASCADE', // Delete value when parent option is deleted
        onUpdate: 'CASCADE'  // Update optionId if parent option's id changes
      });
    }
  }
  OptionValue.init({
    value: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: 'Value is required' },
        notEmpty: { msg: 'Value cannot be empty' }
      }
    },
    optionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'ProductOptions',
        key: 'id'
      }
    }
  }, {
    sequelize,
    modelName: 'OptionValue',
  });
  return OptionValue;
};