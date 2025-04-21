'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Products', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique:true,
        validate: {
          notNull: true,
          notEmpty: true
        }
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
        validate: {
          notNull: true,
          notEmpty: true
        }
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          notNull: true,
          min: 0
        }
      },
      discountPrice: {
        type: Sequelize.DECIMAL(10, 2),
        validate: {
          min: 0
        }
      },
      weight: {
        type: Sequelize.DECIMAL(10, 2),
        validate: {
          min: 0
        }
      },

      ratingsAverage: {
        type: Sequelize.FLOAT,
        defaultValue: 4.5,
        validate: {
          min: 1,
          max: 5,
        }
      },

      ratingsQuantity: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      isDigital: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      seoTitle: {
        type: Sequelize.STRING
      },
      seoDescription: {
        type: Sequelize.TEXT
      },
      taxable: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      coverImage: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
          notNull: true,
          notEmpty: true
        }
      },
      images: {
        type: Sequelize.TEXT,
        defaultValue: '[]',
        allowNull: true
      },
      stockQuantity:{
        type: Sequelize.INTEGER,
        defaultValue:1
      },
      shippingCountries: {
        type: Sequelize.TEXT,
        defaultValue: '[]'
      },
      categoryId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Categories',
          key: 'id'
        }
      },
      subCategoryId: {
        type: Sequelize.INTEGER,
        allowNull:false,
        references: {
          model: 'SubCategories',
          key: 'id'
        }
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        }
      },
      status: {
        type: Sequelize.ENUM('pending', 'active', 'denied', 'suspended'),
        defaultValue: 'active'
      },
      slug: {
        type: Sequelize.STRING,
        unique: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Create junction table for Product-Tag many-to-many relationship
    await queryInterface.createTable('ProductTags', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      productId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Products',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      tagId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Tags',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Add composite unique index to prevent duplicate tag assignments
    await queryInterface.addIndex('ProductTags', {
      fields: ['productId', 'tagId'],
      unique: true,
      name: 'product_tag_unique'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('ProductTags');
    await queryInterface.dropTable('Products');
  }
};