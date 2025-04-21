'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Tag extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Tag.belongsToMany(models.Product, {
        through: 'ProductTags',
        foreignKey: 'tagId',
        otherKey: 'productId',
        as: 'products'
      });
    }
  }
  Tag.init({
    name:{
      type: DataTypes.STRING,
      unique: true,
      allowNull:false,
      validate:{
        notNull:{message: "Please provide tag name"},
        notEmpty:{message: "Tag name cannot be empty"}
      }
    }
  }, {
    sequelize,
    modelName: 'Tag',
  });
  return Tag;
};