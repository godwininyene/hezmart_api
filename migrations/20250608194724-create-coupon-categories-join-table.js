'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('CouponCategories', {
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
      categoryId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Categories',
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
    await queryInterface.addConstraint('CouponCategories', {
      fields: ['couponId', 'categoryId'],
      type: 'unique',
      name: 'unique_coupon_category'
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('CouponCategories');
  }
};