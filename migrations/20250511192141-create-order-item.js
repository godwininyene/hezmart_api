'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Verify required tables exist
    await queryInterface.sequelize.query('SELECT 1 FROM `Orders` LIMIT 1').catch(() => {
      throw new Error('Orders table must exist before creating OrderItems');
    });
    await queryInterface.sequelize.query('SELECT 1 FROM `Products` LIMIT 1').catch(() => {
      throw new Error('Products table must exist before creating OrderItems');
    });
    await queryInterface.sequelize.query('SELECT 1 FROM `Users` LIMIT 1').catch(() => {
      throw new Error('Users table must exist (for vendor reference) before creating OrderItems');
    });

    

    await queryInterface.createTable('OrderItems', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      orderId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Orders',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      productId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Products',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      vendorId: {  // NEW FIELD
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users', 
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
          min: 1
        }
      },
      price: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        validate: {
          min: 0
        }
      },
      discountPrice: {
        type: Sequelize.DECIMAL(12, 2),
        validate: {
          min: 0
        }
      },
      selectedOptions: {
        type: Sequelize.TEXT,
        defaultValue: '[]'
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

    // Composite indexes for better query performance
    await queryInterface.addIndex('OrderItems', ['orderId', 'productId']);
    await queryInterface.addIndex('OrderItems', ['vendorId']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('OrderItems');
  }
};