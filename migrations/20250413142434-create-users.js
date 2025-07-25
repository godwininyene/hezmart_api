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
      firstName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      lastName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      primaryPhone: {
        type: Sequelize.STRING,
        allowNull: false,
        unique:true,
      },
      // secondaryPhone: {
      //   type: Sequelize.STRING,
      //   allowNull: true,
      //   unique:true,
      // },
      primaryAddress: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      // secondaryAddress: {
      //   type: Sequelize.STRING,
      //   allowNull: true,
      // },
      // country: {
      //   type: Sequelize.STRING,
      //   allowNull: false,
      // },
      // region: {
      //   type: Sequelize.STRING,
      //   allowNull: false,
      // },
      state: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      photo:{
        type:Sequelize.STRING,
        defaultValue:`${process.env.APP_URL}/uploads/users/default.jpg`
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      passwordChangedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      passwordResetToken:{
        type: Sequelize.STRING,
        allowNull: true
      },
      passwordResetExpires:{
        type: Sequelize.DATE,
        allowNull: true
      },
      role: {
        type: Sequelize.ENUM('admin', 'vendor', 'customer'),
        allowNull: false,
        defaultValue: 'customer'
      },
      status: {
        type: Sequelize.ENUM('active', 'pending', 'denied', 'deactivated'),
        allowNull: false,
        defaultValue: 'active'
      },
      emailVerificationCode: {
        type: Sequelize.STRING,
        allowNull: true
      },
      emailVerificationExpires: {
        type: Sequelize.DATE,
        allowNull: true
      },
      isEmailVerified: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: false
      },
      ninNumber: {
        type: Sequelize.STRING,
        allowNull: true,
        unique:true,
      },
      businessName: {
        type: Sequelize.STRING,
        allowNull: true
      },
      businessCategoryId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Categories',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      businessLogo: {
        type: Sequelize.STRING,
        allowNull: true
      },
      //FOr social auth
      authProvider: {
        type: Sequelize.ENUM('local', 'google', 'apple'),
        defaultValue: 'local'
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
