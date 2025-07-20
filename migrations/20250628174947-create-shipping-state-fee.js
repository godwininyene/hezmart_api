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
      fee:{
        type: Sequelize.INTEGER,
        allowNull: false
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.addIndex('shipping_state_fees', ['state']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('shipping_state_fees');
  }
};