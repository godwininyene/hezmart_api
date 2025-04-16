'use strict';
const bcrypt = require('bcryptjs');

module.exports = {
  async up(queryInterface, Sequelize) {
    const hashedPassword = await bcrypt.hash('Admin@1234', 12);

    await queryInterface.bulkInsert('Users', [{
      firstName: 'Super',
      lastName: 'Admin',
      email: 'admin@hezmart.com',
      primaryPhone: '+12345678901',
      secondaryPhone: null,
      primaryAddress: 'Admin Street 1',
      secondaryAddress: null,
      country: 'Nigeria',
      city: 'Adminville',
      region: 'Central',
      password: hashedPassword,
      role: 'admin',
      status: 'active',
      emailVerificationCode: null,
      emailVerificationExpires: null,
      isEmailVerified: true,
      ninNumber: null,
      businessName: null,
      businessCategoryId: null,
      businessLogo: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Users', { email: 'admin@hezmart.com' }, {});
  }
};
