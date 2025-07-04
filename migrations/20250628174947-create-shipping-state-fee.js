module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('shipping_state_fees', {
      id:{
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      state:{
        type: Sequelize.STRING,
        allowNull: false
      },
      // deliveryType:{
      //   type: Sequelize.ENUM('door', 'pickup'),
      //   allowNull: false
      // },
      fee:{
        type: Sequelize.INTEGER,
        allowNull: false
      },
      // shippingSettingId: { 
      //   type: Sequelize.INTEGER,
      //   references: { model: 'shipping_settings', key: 'id' }
      // },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.addIndex('shipping_state_fees', ['state']);
    // await queryInterface.addIndex('shipping_state_fees', ['deliveryType']);
    // await queryInterface.addIndex('shipping_state_fees', ['shippingSettingId']);
    // await queryInterface.addIndex('shipping_state_fees', 
    //   ['state', 'deliveryType'], 
    //   { unique: true }
    // );
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('shipping_state_fees');
  }
};