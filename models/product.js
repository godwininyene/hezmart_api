'use strict';
const slugify = require('slugify')
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Product extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Associations
      Product.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
        onDelete: 'CASCADE', // If user is deleted, delete their products
        onUpdate: 'CASCADE'
      });
    
      Product.belongsTo(models.Category, {
        foreignKey: 'categoryId',
        as: 'category',
        onDelete: 'RESTRICT', // Prevent deletion if products exist in this category
        onUpdate: 'CASCADE'
      });
    
      Product.belongsTo(models.SubCategory, {
        foreignKey: 'subCategoryId',
        as: 'subCategory',
        onDelete: 'RESTRICT', // Prevent deletion if products exist in this subcategory
        onUpdate: 'CASCADE'
      });
    
      Product.hasMany(models.Review, {
        foreignKey: 'productId',
        as: 'reviews',
        onDelete: 'CASCADE', // If product is deleted, remove its reviews
        onUpdate: 'CASCADE'
      });
    
      Product.belongsToMany(models.Tag, {
        through: 'ProductTags',
        foreignKey: 'productId',
        otherKey: 'tagId',
        as: 'tags',
        onDelete: 'CASCADE', // If product is deleted, remove its tag associations
        onUpdate: 'CASCADE'
      });
    
      Product.hasMany(models.ProductOption, {
        foreignKey: 'productId',
        as: 'options',
        onDelete: 'CASCADE', // If product is deleted, delete its options
        onUpdate: 'CASCADE'
      });

      Product.belongsToMany(models.Coupon, {
        through: 'CouponProducts',
        foreignKey: 'productId',
        otherKey: 'couponId',
        as: 'coupons'
      });
      
    }
  }
  Product.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique:true,
      validate: {
        notNull: { msg: 'Product name is required' },
        notEmpty: { msg: 'Product name cannot be empty' }
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notNull: { msg: 'Description is required' },
        notEmpty: { msg: 'Description cannot be empty' }
      }
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        notNull: { msg: 'Price is required' },
        min: { args: [0], msg: 'Price cannot be negative' },
       
      }
    },
    discountPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null,  
      validate: {
        min: { 
          args: [0], 
          msg: 'Discount price cannot be negative' 
        },
        isLessThanPrice(value) {
          if (value !== null && parseFloat(value) >= parseFloat(this.price)) {
            throw new Error('Discount price must be less than regular price');
          }
        }
      }
    },
    weight: {
      type: DataTypes.DECIMAL(10, 2),
      validate: {
        min: { args: [0], msg: 'Weight cannot be negative' }
      }
    },
    ratingsAverage: {
      type: DataTypes.FLOAT,
      defaultValue: 1.1,
      validate: {
        min: {
          args: [1],
          msg: 'Rating must be above 1.0'
        },
        max: {
          args: [5],
          msg: 'Rating must be below 5.0'
        }
      }
    },
    ratingsQuantity: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    isDigital: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    seoTitle: DataTypes.STRING,
    seoDescription: DataTypes.TEXT,
    taxable: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    coverImage: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: 'Cover image is required' },
        notEmpty: { msg: 'Cover image cannot be empty' }
      }
    },
    images: {
      type: DataTypes.TEXT,
      defaultValue: '[]',
      allowNull: false
    },
    shippingCountries: {
      type: DataTypes.TEXT,
      defaultValue: '[]'
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate:{
        notNull:{msg:'A product must belong to a category'}
      },
      references: {
        model: 'Categories',
        key: 'id'
      }
    },
    subCategoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate:{
        notNull:{msg:'A product must belong to a subcategory'}
      },
      references: {
        model: 'SubCategories',
        key: 'id'
      }
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate:{
        notNull:{msg:'A product must belong to a vendor'}
      },
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM('pending', 'active', 'denied', 'suspended'),
      defaultValue: 'pending',
      validate: {
        isIn: {
          args: [['pending', 'active', 'denied', 'suspended']],
          msg: 'Invalid status'
        }
      }
    },
    slug: {
      type: DataTypes.STRING,
      unique: true
    },
    stockQuantity:{
      type: DataTypes.INTEGER,
      defaultValue:1
    },
  }, {
    sequelize,
    modelName: 'Product',
    hooks: {
      beforeValidate: (product) => {
        if (product.name) {
          product.slug = slugify(product.name, { lower: true, strict: true });
        }
      }
    },
    getterMethods: {
      images() {
        try {
          return this.getDataValue('images') 
            ? JSON.parse(this.getDataValue('images'))
            : [];
        } catch {
          return [];
        }
      },
      shippingCountries() {
        try {
          return this.getDataValue('shippingCountries')
            ? JSON.parse(this.getDataValue('shippingCountries'))
            : [];
        } catch {
          return [];
        }
      },
      itemsLeftMessage() {
        if (this.stockQuantity === 0) return 'Out of stock';
        if (this.stockQuantity <= 5) return `Only ${this.stockQuantity} left in stock!`;
        return 'In stock';
      }
    },
    setterMethods: {
      set(value) {
        this.setDataValue('ratingsAverage', Math.round(value * 10) / 10);
      },
      images(value) {
        this.setDataValue('images', 
          Array.isArray(value) ? JSON.stringify(value) : value || '[]'
        );
      },
      shippingCountries(value) {
        this.setDataValue('shippingCountries',
          Array.isArray(value) ? JSON.stringify(value) : value || '[]'
        );
      }
    }
  });
  return Product;
};