'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Shipments', {
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
        onDelete: 'RESTRICT'
      },
      carrier: {
        type: Sequelize.ENUM('dhl', 'fedex', 'ups', 'local'),
        allowNull: false
      },
      trackingNumber: {
        type: Sequelize.STRING
      },
      cost: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('pending', 'processing', 'shipped', 'delivered', 'failed'),
        defaultValue: 'pending'
      },
      estimatedDelivery: {
        type: Sequelize.DATE
      },
      address: {
        type: Sequelize.JSON,
        allowNull: false
      },
      notes: {
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

    await queryInterface.addIndex('Shipments', ['orderId']);
    await queryInterface.addIndex('Shipments', ['trackingNumber']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Shipments');
  }
};