'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
    */
    const timestamp = new Date();
    await queryInterface.bulkInsert('Categories', 
    [
      { name: 'Electronics', createdAt: timestamp, updatedAt: timestamp },
      { name: 'Computers', createdAt: timestamp, updatedAt: timestamp },
      { name: 'Clothings', createdAt: timestamp, updatedAt: timestamp },
      { name: 'Drugs', createdAt: timestamp, updatedAt: timestamp }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
  }
};
