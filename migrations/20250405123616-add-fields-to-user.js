'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Get a transaction
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      await queryInterface.addColumn(
        'Users',
        'isEmailVerified',
        {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        },
        { transaction }
      );

      await queryInterface.addColumn(
        'Users',
        'emailVerificationCode',
        {
          type: Sequelize.STRING,
        },
        { transaction }
      );

      await queryInterface.addColumn(
        'Users',
        'emailVerificationExpires',
        {
          type: Sequelize.DATE,
        },
        { transaction }
      );

      await queryInterface.addColumn(
        'Users',
        'passwordChangedAt',
        {
          type: Sequelize.DATE,
        },
        { transaction }
      );

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try { 
      await queryInterface.removeColumn('Users', 'isEmailVerified', { transaction });
      await queryInterface.removeColumn('Users', 'emailVerificationCode', { transaction });
      await queryInterface.removeColumn('Users', 'emailVerificationExpires', { transaction });
      await queryInterface.removeColumn('Users', 'passwordChangedAt', { transaction });
      
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};