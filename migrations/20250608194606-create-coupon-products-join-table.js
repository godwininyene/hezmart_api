'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('CouponProducts', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      couponId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Coupons',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Add compound unique constraint
    await queryInterface.addConstraint('CouponProducts', {
      fields: ['couponId', 'productId'],
      type: 'unique',
      name: 'unique_coupon_product'
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('CouponProducts');
  }
};