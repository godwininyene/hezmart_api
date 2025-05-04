'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Category extends Model {
    static associate(models) {
      Category.hasMany(models.SubCategory, {as: 'subcategories'});
      Category.hasMany(models.Product, {foreignKey: 'categoryId',as: 'products'});
      Category.hasMany(models.User, { foreignKey: 'businessCategoryId', as: 'users' })
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