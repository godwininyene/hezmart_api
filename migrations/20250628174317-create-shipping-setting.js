module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('shipping_settings', {

      id:{
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      doorDeliveryEnabled:{ 
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      pickupEnabled:{
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      minShippingEnabled:{
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      shippingMinAmount:{
        type: Sequelize.INTEGER,
        defaultValue: 8000
      },
      isActive:{ type:
        Sequelize.BOOLEAN,
        defaultValue: true
      },
      // updatedBy:{ 
      //   type: Sequelize.INTEGER,
      //   references: { 
      //     model: 'users',
      //     key: 'id' 
      //   } 
      // },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('shipping_settings');
  }
};