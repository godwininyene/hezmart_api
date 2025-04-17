'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class SubCategory extends Model {
    static associate(models) {
      // define association here
      SubCategory.belongsTo(models.Category, { foreignKey: 'categoryId', as: 'category' })// One-to-Many (Category can have many subcategories;
    }
  }
  SubCategory.init({
    name:{
      type:DataTypes.STRING,
      allowNull:false,
      unique:true,
      validate:{
        notNull: { msg: 'Subcategory must have a name' },
        notEmpty: { msg: 'subcategory name Cannot be empty' }
      }
    },
    description: DataTypes.STRING,
    categoryId:{
      type:DataTypes.INTEGER,
      allowNull:false,
      validate:{
        notNull:{msg: 'A subcategory must belong to a category'}
      },
      references: {
          model: 'Categories', 
          key: 'id'
      },
    },
  }, {
    sequelize,
    modelName: 'SubCategory',
  });
  return SubCategory;
};