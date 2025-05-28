'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
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
      vendorId: {
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
        defaultValue: '{}'
      },
      fulfillmentStatus: {
        type: Sequelize.ENUM('pending', 'processing', 'shipped', 'delivered', 'received', 'cancelled', 'returned'),
        defaultValue: 'pending'
      },
      shippedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      deliveredAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      receivedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      trackingNumber: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      vendorNotes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      customerNotes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      cancellationReason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      returnReason: {
        type: Sequelize.TEXT,
        allowNull: true
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
    await queryInterface.addIndex('OrderItems', ['fulfillmentStatus']);
    await queryInterface.addIndex('OrderItems', ['shippedAt']);
    await queryInterface.addIndex('OrderItems', ['deliveredAt']);
    await queryInterface.addIndex('OrderItems', ['receivedAt']);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('OrderItems');
  }
};