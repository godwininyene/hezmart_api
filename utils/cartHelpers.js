const { Cart, CartItem, Product } = require('../models');
exports.getShippingOptions =()=> {
    return [
      { 
        id: 'standard', 
        name: 'Standard Delivery', 
        cost: 1500, 
        estimatedDays: '3-5 business days' 
      },
      { 
        id: 'express', 
        name: 'Express Delivery', 
        cost: 3000, 
        estimatedDays: '1-2 business days' 
      },
      { 
        id: 'pickup', 
        name: 'Store Pickup', 
        cost: 0, 
        estimatedDays: 'Ready in 1 hour' 
      }
    ];
  }
exports.enrichCartItems = (items) => {
    return items.map(item => ({
      ...item.get({ plain: true }),
      available: item.product.stockQuantity >= item.quantity
    }));
};
// Utility to get cart by user or session, optionally including items
exports.getCartByUserOrSession = async (userId, sessionId, withItems = false) => {
    const cart = await Cart.findOne({
      where: userId ? { userId } : { sessionId },
      include: withItems ? {
        model: CartItem,
        as: 'items',
        include: [{
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'price', 'coverImage', 'discountPrice', 'stockQuantity']
        }]
      } : undefined
    });
  
    if (cart && withItems) {
      cart.items = exports.enrichCartItems(cart.items);
    }
  
    return cart;
  };

// Utility to calculate summary details (totals, discounts, delivery)
exports.calculateCartSummary = (items) => {
  const summary = items.reduce((acc, item) => {
    const itemPrice = parseFloat(item.product.price);
    const itemDiscountPrice = item.product.discountPrice ? parseFloat(item.product.discountPrice) : null;

    acc.totalItems += item.quantity;
    acc.subtotal += item.quantity * itemPrice;

    if (itemDiscountPrice) {
      acc.discount += item.quantity * (itemPrice - itemDiscountPrice);
    }

    return acc;
  }, {
    totalItems: 0,
    subtotal: 0,
    discount: 0,
    deliveryFee: 1500, // static delivery fee
    tax: 0 // could add tax logic here
  });

  // Final total = subtotal - discount + delivery + tax
  summary.total = summary.subtotal - summary.discount + summary.deliveryFee + summary.tax;

  return summary;
};
