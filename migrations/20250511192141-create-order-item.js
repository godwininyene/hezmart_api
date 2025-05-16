'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
     // First check if the referenced tables exist
    //  const tables = await queryInterface.showAllTables();
    
    //  if (!tables.includes('Orders') || !tables.includes('Products')) {
    //    throw new Error('Referenced tables (Orders, Products) must exist before creating OrderItems');
    //  }
    await queryInterface.sequelize.query('SELECT 1 FROM `Orders` LIMIT 1').catch(() => {
      throw new Error('Orders table must exist before creating OrderItems');
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
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      price: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false
      },
      discountPrice: {
        type: Sequelize.DECIMAL(12, 2)
      },
      selectedOptions: {
        type: Sequelize.TEXT
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

    // Add composite index for better performance
    await queryInterface.addIndex('OrderItems', ['orderId', 'productId']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('OrderItems');
  }
};