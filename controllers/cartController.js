const { Cart, CartItem, Product, sequelize } = require('../models');
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const { getCartByUserOrSession, calculateCartSummary, getShippingOptions } = require('../utils/cartHelpers');

// Add item to cart
exports.addToCart = catchAsync(async (req, res, next) => {
  const userId = req.user?.id || null; // Determine if user is logged in
  const sessionId = req.sessionId;     // Get session ID for guest users
  const { productId, quantity = 1, options = {} } = req.body;

  // Check if product exists
  const product = await Product.findByPk(productId);
  if (!product) return next(new AppError('No product was found with that id', '', 404));

  // Find or create a cart based on user or session
  const [cart] = await Cart.findOrCreate({
    where: userId ? { userId } : { sessionId },
    defaults: {
      userId,
      sessionId,
      expiresAt: userId ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Expires in 7 days
    }
  });

  const optionsString = JSON.stringify(options); // Ensure consistent comparison

  // Check if item with same options already exists in the cart
  const existingItem = await CartItem.findOne({
    where: {
      cartId: cart.id,
      productId,
      selectedOptions: optionsString
    }
  });

  let item;

  if (existingItem) {
    // If item exists, increase quantity
    existingItem.quantity += parseInt(quantity);
    await existingItem.save();
    item = existingItem;
  } else {
    // Else create a new item
    item = await CartItem.create({
      cartId: cart.id,
      productId,
      quantity,
      selectedOptions: options
    });
  }

  // Fetch updated cart and summary
  const updatedCart = await getCartByUserOrSession(userId, sessionId, true);
  const summary = calculateCartSummary(updatedCart.items);

  res.status(200).json({
    status: "success",
    data: {
      item,
      summary
    }
  });
});

// Get user's or guest's cart
exports.getCart = catchAsync(async (req, res, next) => {

  const userId = req.user?.id || null;
  const sessionId = req.sessionId;

 // Get full cart with enriched items
  const cart = await getCartByUserOrSession(userId, sessionId, true);
  if (!cart) {
    return res.status(200).json({ 
      status: "success", 
      data: { 
        items: [], 
        summary: {
          totalItems: 0,
          subtotal: 0,
          discount: 0,
          deliveryFee: 0,
          tax: 0,
          total: 0
        },
        shippingOptions: getShippingOptions()
      } 
    });
  }

  // Calculate summary including any cart-level discount
  const summary = calculateCartSummary(cart.items, cart.discountAmount);

  res.status(200).json({
    status: "success",
    data: {
      items: cart.items,
      summary,
       // Include available shipping options
       shippingOptions: getShippingOptions(),
       appliedCoupon: cart.coupon 
        ? { 
            code: cart.coupon.code,
            name: cart.coupon.name,
            type: cart.coupon.type
          } 
        : null
    
    }
  });
});

// Update quantity or options for a cart item
exports.updateQuantity = catchAsync(async (req, res, next) => {
  const userId = req.user?.id || null;
  const sessionId = req.sessionId;
  const { productId } = req.params;
  const { quantity } = req.body;
  
  if (quantity < 1) {
    return next(new AppError('Quantity must be at least 1', '', 400))
  }

  const cart = await Cart.findOne({
    where: userId ? { userId } : { sessionId },
    include: {
      model: CartItem,
      as: 'items',
      include: [{
        model: Product,
        as: 'product'
      }]
    }
  });

  if (!cart) return next(new AppError('No cart was found with that id', '', 404))
  
  const item = cart.items.find(i => i.productId === parseFloat(productId));
  if (!item) return next(new AppError('Item not found in cart', '', 404))
    
  item.quantity = parseFloat(quantity);
  await item.save();


  // Get updated cart and summary
  const updatedCart = await getCartByUserOrSession(userId, sessionId, true);
  const summary = calculateCartSummary(updatedCart.items);

  res.status(200).json({
    status: "success",
    data: {
      item,
      summary
    }
  });
});

// Remove item from cart
exports.removeCartItem = catchAsync(async (req, res, next) => {
  const { productId } = req.params;
  const userId = req.user?.id || null;
  const sessionId = req.sessionId;

  const cart = await Cart.findOne({
    where: userId ? { userId } : { sessionId },
    include: {
      model: CartItem,
      as: 'items',
      include: [{
        model: Product,
        as: 'product'
      }]
    }
  });

  if (!cart) return next(new AppError('No cart was found with that id', '', 404))

  const item = cart.items.find(i => i.productId === parseFloat(productId));
  if (!item) return next(new AppError('Item not found in cart', '', 404));

  await CartItem.destroy({
      where: { cartId: cart.id, productId }
  });


  // Get updated cart and summary (or return empty summary if cart is empty)
  const updatedCart = await getCartByUserOrSession(userId, sessionId, true);
  const summary = updatedCart ? calculateCartSummary(updatedCart.items) : {};

  res.status(200).json({
    status: "success",
    data: {
      message: "Item removed from cart successfully",
      summary
    }
  });
});

// Merge guest cart with user's cart on login
exports.mergeGuestCart = catchAsync(async (req, res, next) => {

  const userId = req.user?.id;
  const sessionId = req.sessionId;

  if (!userId || !sessionId) {
    return next(new AppError("Missing user or session info for merging carts", "", 400));
  }

  const guestCart = await Cart.findOne({
    where: { sessionId },
    include: {
      model: CartItem,
      as: 'items',
      include: [{
        model: Product,
        as: 'product',
        attributes: ['id', 'name', 'price', 'discountPrice', 'stockQuantity']
      }]
    },
  });

    
  if (!guestCart) {
    return res.status(200).json({ status: "success", message: "No guest cart found to merge" });
  }

  
  // Assign guest cart to user
  guestCart.userId = userId;
  guestCart.sessionId = null;
  guestCart.expiresAt = null;
  await guestCart.save();
   
  res.status(200).json({
    status: "success",
    message:"Guest cart assigned to user",
  });

});

// Clear all items from a cart (user or session)
exports.clearCart = catchAsync(async (req, res, next) => {
    const userId = req.user?.id || null;
    const sessionId = req.sessionId;
  
    const cart = await getCartByUserOrSession(userId, sessionId, true);
  
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(200).json({ status: "success", message: "Cart is already empty" });
    }

    await CartItem.destroy({ where: { cartId: cart.id } });
  
    res.status(200).json({
      status: "success",
      message: "Cart cleared successfully",
      data: {
        items: [],
        summary: {
          totalItems: 0,
          subtotal: 0,
          discount: 0,
          deliveryFee: 0,
          tax: 0,
          total: 0
        }
      }
    });
});
