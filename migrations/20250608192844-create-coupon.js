'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Coupons', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      code: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      type: {
        type: Sequelize.ENUM('fixed', 'percentage', 'priceDiscount', 'freeShipping'),
        allowNull: false
      },
      value: {
        type: Sequelize.FLOAT,
        allowNull: false,
        validate: {
          min: 0
        }
      },
      duration: {
        type: Sequelize.ENUM('set', 'none'),
        allowNull: false,
        defaultValue: 'none'
      },
      durationDays: {
        type: Sequelize.INTEGER,
        allowNull: true,
        validate: {
          min: 1
        }
      },
      appliesTo: {
        type: Sequelize.ENUM('all', 'categories', 'products'),
        allowNull: false,
        defaultValue: 'all'
      },
      usageLimit: {
        type: Sequelize.ENUM('limited', 'none'),
        allowNull: false,
        defaultValue: 'none'
      },
      limitAmount: {
        type: Sequelize.INTEGER,
        allowNull: true,
        validate: {
          min: 1
        }
      },
      remainingUses:{
        type:Sequelize.INTEGER,
        defaultValue:1
      },
      status: {
        type: Sequelize.ENUM('active', 'expired'),
        allowNull: false,
        defaultValue: 'active'
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
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Coupons');
  }
};