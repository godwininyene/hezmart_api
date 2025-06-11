'use strict';
const {
  Model
} = require('sequelize');
function determineStatus(coupon) {
  const now = new Date();

  if (coupon.duration === 'set' && coupon.durationDays && coupon.createdAt) {
    const expiry = new Date(coupon.createdAt);
    expiry.setDate(expiry.getDate() + coupon.durationDays);
    if (now >= expiry) return 'expired';
  }

  if (coupon.usageLimit === 'limited') {
    return coupon.remainingUses > 0 ? 'active' : 'expired';
  }

  return 'active';
}

module.exports = (sequelize, DataTypes) => {
  class Coupon extends Model {
    static associate(models) {
      // Many-to-many relationship with Products (when appliesTo is 'products')
      Coupon.belongsToMany(models.Product, {
        through: 'CouponProducts',
        foreignKey: 'couponId',
        otherKey: 'productId',
        as: 'products',
        constraints: false
      });

      // Many-to-many relationship with Categories (when appliesTo is 'categories')
      Coupon.belongsToMany(models.Category, {
        through: 'CouponCategories',
        foreignKey: 'couponId',
        otherKey: 'categoryId',
        as: 'categories',
        constraints: false
      });
    }
    async decrementUsage(transaction){
      if (this.usageLimit === 'limited') {
        if (this.remainingUses <= 0) {
          throw new Error('Coupon usage limit has been reached');
        }

        this.remainingUses -= 1;
        await this.save({ transaction });
      }
    }
  }

  Coupon.init({
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notNull: { msg: 'Coupon must have a code' },
        notEmpty: { msg: 'Coupon code cannot be empty' },
        len: {
          args: [3, 50],
          msg: 'Coupon code must be between 3 and 50 characters'
        }
      }
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: 'Coupon must have a name' },
        notEmpty: { msg: 'Coupon name cannot be empty' },
        len: {
          args: [3, 100],
          msg: 'Coupon name must be between 3 and 100 characters'
        }
      }
    },
    type: {
      type: DataTypes.ENUM('fixed', 'percentage', 'priceDiscount', 'freeShipping'),
      allowNull: false,
      validate: {
        notNull: { msg: 'Coupon must have a type' },
        isIn: {
          args: [['fixed', 'percentage', 'priceDiscount', 'freeShipping']],
          msg: 'Invalid coupon type'
        }
      }
    },
    value: {
      type: DataTypes.FLOAT,
      allowNull: false,
      validate: {
        notNull: { msg: 'Coupon must have a value' },
        min: {
          args: [0],
          msg: 'Coupon value cannot be negative'
        },
        customValidator(value) {
          if (this.type === 'percentage' && value > 100) {
            throw new Error('Percentage discount cannot be greater than 100%');
          }
        }
      }
    },
    duration: {
      type: DataTypes.ENUM('set', 'none'),
      allowNull: false,
      defaultValue: 'none',
      validate: {
        notNull: { msg: 'Duration must be specified' },
        isIn: {
          args: [['set', 'none']],
          msg: 'Invalid duration type'
        }
      }
    },
    durationDays: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: {
          args: [1],
          msg: 'Duration days must be at least 1'
        },
        requiredIfSet(value) {
          if (this.duration === 'set' && !value) {
            throw new Error('Duration days is required when duration is set');
          }
        }
      }
    },
    appliesTo: {
      type: DataTypes.ENUM('all', 'categories', 'products'),
      allowNull: false,
      defaultValue: 'all',
      validate: {
        notNull: { msg: 'AppliesTo must be specified' },
        isIn: {
          args: [['all', 'categories', 'products']],
          msg: 'Invalid appliesTo value'
        }
      }
    },
    usageLimit: {
      type: DataTypes.ENUM('limited', 'none'),
      allowNull: false,
      defaultValue: 'none',
      validate: {
        notNull: { msg: 'Usage limit must be specified' },
        isIn: {
          args: [['limited', 'none']],
          msg: 'Invalid usage limit value'
        }
      }
    },
    limitAmount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: {
          args: [1],
          msg: 'Limit amount must be at least 1'
        },
        requiredIfLimited(value) {
          if (this.usageLimit === 'limited' && !value) {
            throw new Error('Limit amount is required when usage is limited');
          }
        }
      }
    },
    remainingUses: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      validate: {
        min: {
          args: [0],
          msg: 'Remaining uses cannot be negative'
        }
      }
    },
    status: {
      type: DataTypes.ENUM('active', 'expired'),
      allowNull: false,
      defaultValue: 'active'
    },
  }, {
    sequelize,
    modelName: 'Coupon',
    hooks:{
      beforeCreate:(coupon)=>{
        coupon.status = determineStatus(coupon);
      },
      beforeUpdate:(coupon)=>{
        coupon.status = determineStatus(coupon);
      },
    }
  });

  return Coupon;
};
