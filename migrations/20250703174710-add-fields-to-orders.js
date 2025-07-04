module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Orders', 'deliveryOption', {
      type: Sequelize.ENUM('door', 'pickup'),
      allowNull: false
    });
    await queryInterface.addColumn('Orders', 'stateFeeDetails', {
      type: Sequelize.TEXT,
      allowNull: true
    });
   
    await queryInterface.addColumn('Orders', 'pickupStationDetails', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('Orders', 'walletDetails', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Orders', 'deliveryOption');
    await queryInterface.removeColumn('Orders', 'stateFeeDetails');
    await queryInterface.removeColumn('Orders', 'pickupStationDetails');
    await queryInterface.removeColumn('Orders', 'walletDetails');
  }
};