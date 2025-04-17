'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Category extends Model {
    static associate(models) {
      // define association here
    }
  }
  Category.init({
    name:{
      type:DataTypes.STRING,
      unique:true,
      allowNull:false,
      validate:{
        notNull: { msg: 'Category must have a name' },
        notEmpty: { msg: 'Category name Cannot be empty' }
      }
    },
    icon: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Category',
  });
  return Category;
};