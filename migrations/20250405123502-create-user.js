'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Users', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING
      },
      email: {
        type: Sequelize.STRING,
        unique:true
      },
      password: {
        type: Sequelize.STRING
      },
      role: {
        type: Sequelize.ENUM('admin', 'vendor', 'customer')
      },
      status: {
        type: Sequelize.ENUM('active', 'pending', 'blocked')
      },
      phone1: {
        type: Sequelize.STRING
      },
      phone2: {
        type: Sequelize.STRING
      },
      ninNumber: {
        type: Sequelize.STRING
      },
      address: {
        type: Sequelize.STRING
      },
      businessName: {
        type: Sequelize.STRING
      },
      businessCategoryId: {
        type: Sequelize.INTEGER
      },
      businessLogo: {
        type: Sequelize.STRING
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
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Users');
  }
};