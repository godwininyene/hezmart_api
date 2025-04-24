const cron = require('node-cron');
const { Cart, CartItem } = require('../models');
const { Op } = require('sequelize');

const cleanExpiredGuestCarts = async () => {
  try {
    const expiredCarts = await Cart.findAll({
      where: {
        userId: null,
        expiresAt: { [Op.lt]: new Date() }
      },
      include: [CartItem]
    });

    for (const cart of expiredCarts) {
      await CartItem.destroy({ where: { cartId: cart.id } });
      await cart.destroy();
    }

    console.log(`[${new Date().toISOString()}] ✅ Expired guest carts cleaned: ${expiredCarts.length}`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ❌ Failed to clean expired carts:`, err);
  }
};

// Schedule to run once a day at 2:30am
cron.schedule('30 2 * * *', cleanExpiredGuestCarts);

module.exports = cleanExpiredGuestCarts;
