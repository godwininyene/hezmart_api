'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'authProvider', {
      type: Sequelize.ENUM('local', 'google', 'apple'),
      defaultValue: 'local',
      allowNull: false
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Users', 'authProvider');
    // Also drop the enum type
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Users_authProvider";');
  }
};