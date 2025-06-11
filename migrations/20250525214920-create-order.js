'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Orders', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      orderNumber: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      status: {
        type: Sequelize.ENUM(
          'pending',
          'processing',
          'partially_shipped',
          'shipped',
          'partially_delivered',
          'delivered',
          'partially_received',
          'completed',
          'partially_cancelled',
          'cancelled',
          'closed',
          'refunded'
        ),
        defaultValue: 'pending'
      },
      subtotal: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false
      },
      discount: {
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0.00
      },
      deliveryFee: {
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0.00
      },
      tax: {
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0.00
      },
      total: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false
      },
      paymentMethod: {
        type: Sequelize.ENUM('card', 'bank_transfer', 'wallet', 'cash_on_delivery'),
        allowNull: false
      },
      paymentStatus: {
        type: Sequelize.ENUM('pending', 'paid', 'failed', 'refunded'),
        defaultValue: 'pending'
      },
      // Add these fields to your Order model
      couponId: Sequelize.INTEGER,
      couponCode: Sequelize.STRING,
      deliveryAddress: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      trackingNumber: {
        type: Sequelize.STRING,
        allowNull:true
      },
      customerNotes: {
        type: Sequelize.TEXT,
        allowNull:true
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

    await queryInterface.addIndex('Orders', ['userId']);
    await queryInterface.addIndex('Orders', ['orderNumber']);
    await queryInterface.addIndex('Orders', ['status']);
    await queryInterface.addIndex('Orders', ['paymentStatus']);
    await queryInterface.addIndex('Orders', ['createdAt']);
    await queryInterface.addIndex('Orders', ['updatedAt']);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Orders');
  }
};