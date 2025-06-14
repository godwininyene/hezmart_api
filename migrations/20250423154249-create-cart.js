'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Carts', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: true, 
        references: {
          model: 'Users',
          key: 'id'
        }
      },
      sessionId: {
        type: Sequelize.STRING, 
        allowNull: true,
        unique: true
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      couponId:{
      type:Sequelize.INTEGER
      },
      discountAmount:{
        type:Sequelize.DECIMAL(10, 2)
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
    await queryInterface.dropTable('Carts');
  }
};