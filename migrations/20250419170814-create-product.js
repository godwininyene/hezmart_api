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
        unique: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      discountPrice: {
        type: Sequelize.DECIMAL(10, 2),
        comment: 'Must be less than price when set',
        allowNull:true
      },
      weight: {
        type: Sequelize.DECIMAL(10, 2)
      },
      ratingsAverage: {
        type: Sequelize.FLOAT,
        defaultValue: 4.5
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
        allowNull: false
      },
      images: {
        type: Sequelize.TEXT,
        defaultValue: '[]'
      },
      stockQuantity: {
        type: Sequelize.INTEGER,
        defaultValue: 1
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
        },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE'
      },
      subCategoryId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'SubCategories',
          key: 'id'
        },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE'
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      status: {
        type: Sequelize.ENUM('pending', 'active', 'denied', 'suspended'),
        defaultValue: 'pending'
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

    // Add indexes
    await queryInterface.addIndex('Products', ['userId']);
    await queryInterface.addIndex('Products', ['categoryId']);
    await queryInterface.addIndex('Products', ['subCategoryId']);
    await queryInterface.addIndex('Products', ['slug']);
    
    // Add composite unique index for ProductTags
    await queryInterface.addIndex('ProductTags', {
      fields: ['productId', 'tagId'],
      unique: true,
      name: 'product_tag_unique'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('ProductTags', 'product_tag_unique');
    await queryInterface.removeIndex('Products', ['slug']);
    await queryInterface.removeIndex('Products', ['subCategoryId']);
    await queryInterface.removeIndex('Products', ['categoryId']);
    await queryInterface.removeIndex('Products', ['userId']);
    
    await queryInterface.dropTable('ProductTags');
    await queryInterface.dropTable('Products');
  }
};