'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Reviews', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      review: {
        type: Sequelize.STRING,
        allowNull: false
      },
      rating: {
        type: Sequelize.INTEGER
      },
      productId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Products',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
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

    // 🟡 Add composite unique constraint on productId + userId
    await queryInterface.addConstraint('Reviews', {
      fields: ['productId', 'userId'],
      type: 'unique',
      name: 'unique_review_per_user_per_product'
    });
  },

  async down(queryInterface, Sequelize) {
    // Drop the constraint first
    await queryInterface.removeConstraint('Reviews', 'unique_review_per_user_per_product');
    // Then drop the table
    await queryInterface.dropTable('Reviews');
  }
};
