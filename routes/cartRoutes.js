const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { maybeProtect, protect } = require('../controllers/authController'); 

router.use(maybeProtect);
//  Merge guest cart after login (can be used in auth route)
router.post('/merge', protect, cartController.mergeGuestCart);

router.route('/')
    .post(cartController.addToCart)
    .get(cartController.getCart)

router.route('/item/:productId')
    .delete(cartController.removeCartItem)
    .patch(cartController.updateQuantity);

//Clear all items from cart
router.delete('/clear', cartController.clearCart);

module.exports = router;
