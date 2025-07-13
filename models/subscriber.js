'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Subscriber extends Model {
    static associate(models) {
      // define association here
    }
  }
  Subscriber.init({
    name:{
      type:DataTypes.STRING,
      allowNull:false,
      validate:{
        notNull:{msg:"Please provide your name!"},
        notEmpty:{msg:"Name cannot be empty"}
      }
    },
    email:{
      type:DataTypes.STRING,
      allowNull:false,
      unique:true,
      validate:{
        notNull:{msg:"Please provide your email"},
        isEmail:{msg:"Please provide a valid email."}
      }
    }
  }, {
    sequelize,
    modelName: 'Subscriber',
    tableName:'subscribers'
  });
  return Subscriber;
};