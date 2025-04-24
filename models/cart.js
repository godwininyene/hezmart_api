'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Cart extends Model {
    static associate(models) {
      // define association here
      Cart.belongsTo(models.User, { foreignKey: 'userId' ,  onDelete: 'CASCADE'});
      Cart.hasMany(models.CartItem, { foreignKey: 'cartId', as: 'items' });
    }
  }
  Cart.init({
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true, // null for guests
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    sessionId: {
      type: DataTypes.STRING,
      allowNull: true, // non-null for guests
      unique: true
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Cart',
    validate: {
      userOrSession() {
        if (!this.userId && !this.sessionId) {
          throw new Error('Cart must be associated with either a userId or a sessionId.');
        }
      }
    }
  });
  return Cart;
};