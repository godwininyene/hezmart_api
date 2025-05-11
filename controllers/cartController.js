const { Cart, CartItem, Product } = require('../models');
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

exports.addToCart = catchAsync(async (req, res, next) => {
    const userId = req.user?.id || null;
    const sessionId = req.sessionId;
    const { productId, quantity = 1, options = {} } = req.body;

    // Validate product
    const product = await Product.findByPk(productId);
    if (!product) return next(new AppError('No product was found with that id', '', 404));

    // Find or create cart
    const [cart] = await Cart.findOrCreate({
        where: userId ? { userId } : { sessionId },
        defaults: {
            userId,
            sessionId,
            expiresAt: userId ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
    });

    // Stringify options to compare properly
    const optionsString = JSON.stringify(options);

    // Check if item with same product and options exists
    const existingItem = await CartItem.findOne({
        where: {
            cartId: cart.id,
            productId,
            selectedOptions: optionsString
        }
    });

    if (existingItem) {
        existingItem.quantity += parseInt(quantity);
        await existingItem.save();
        return res.status(200).json({
            status: "success",
            data: { item: existingItem }
        });
    }

    // Else, create a new cart item
    const item = await CartItem.create({
        cartId: cart.id,
        productId,
        quantity,
        selectedOptions: options
    });

    res.status(200).json({
        status: "success",
        data: { item }
    });
});


exports.getCart = catchAsync(async (req, res, next) => {
    const userId = req.user?.id || null;
    const sessionId = req.sessionId;
   
    const cart = await Cart.findOne({
        where: userId ? { userId } : { sessionId },
        include: {
            model: CartItem,
            as: 'items',
            include: [{
                model: Product,
                as: 'product', 
                attributes: ['id', 'name', 'price', 'coverImage', 'discountPrice', 'stockQuantity']
            }]
        }
    });

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
                }
            }
        });
    }

    const items = cart.items || [];

    // Calculate all financial values
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
        deliveryFee: 1500, // Default delivery fee
        tax: 0 // Can be calculated based on location
    });

    // Calculate final totals
    summary.total = summary.subtotal - summary.discount + summary.deliveryFee + summary.tax;

    // Add product availability information
    const itemsWithAvailability = items.map(item => ({
        ...item.get({ plain: true }),
        available: item.product.stockQuantity >= item.quantity
    }));

    res.status(200).json({
        status: "success",
        result: items.length,
        data: {
            items: itemsWithAvailability,
            summary,
            // Include available shipping options
            shippingOptions: [
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
            ]
        }
    });
});

exports.removeCartItem = async (req, res, next) => {
    const userId = req.user?.id || null;
    const sessionId = req.sessionId;
    const { productId } = req.params;
  
    const cart = await Cart.findOne({
        where: userId ? { userId } : { sessionId }
    });

    if (!cart) return next(new AppError('No cart was found with that id', '', 404))

    const deleted = await CartItem.destroy({
        where: { cartId: cart.id, productId }
    });

    if (deleted === 0) {
        return next(new AppError('Item not found in cart', '', 404));
    }

    res.status(204).json({
        data:null
    })
};

exports.clearCart = catchAsync(async (req, res, next) => {
    const userId = req.user?.id || null;
    const sessionId = req.sessionId;
  
   
    const cart = await Cart.findOne({
        where: userId ? { userId } : { sessionId }
    });
  
    if (!cart) return next(new AppError('No cart was found with that id', '', 404))
  
    await CartItem.destroy({ where: { cartId: cart.id } });
  
    res.status(204).json({
        data:null
    })   
});
  

exports.updateQuantity = catchAsync(async (req, res, next) => {
    const userId = req.user?.id || null;
    const sessionId = req.sessionId;
    const { productId } = req.params;
    const { quantity } = req.body;
  
    if (quantity < 1) {
      return next(new AppError('Quantity must be at least 1', '', 404))
    }
   
    const cart = await Cart.findOne({
        where: userId ? { userId } : { sessionId }
    });
  
    if (!cart) return next(new AppError('No cart was found with that id', '', 404))
  
    const item = await CartItem.findOne({
        where: { cartId: cart.id, productId }
    });
  
     
    if (!item) return next(new AppError('Item not found in cart', '', 404))
  
    item.quantity+= quantity;
    await item.save();
    res.status(200).json({
        status:"success",
        data:{
            item
        }
    });
});


exports.mergeGuestCart = catchAsync(async (req, res, next) => {
    const sessionId = req.sessionID;
    const userId = req.user.id;
    const guestCart = await Cart.findOne({
        where: { sessionId },
        include: [CartItem]
    });
    if (!guestCart) return next();

    const [userCart] = await Cart.findOrCreate({
        where: { userId },
        defaults: { userId }
    });

    for (const guestItem of guestCart.CartItems) {
        const [item, created] = await CartItem.findOrCreate({
          where: { cartId: userCart.id, productId: guestItem.productId },
          defaults: { quantity: guestItem.quantity }
        });
  
        if (!created) {
          item.quantity += guestItem.quantity;
          await item.save();
        }
    }
  
    // Clean up guest cart
    await CartItem.destroy({ where: { cartId: guestCart.id } });
    await guestCart.destroy();
});
  
  
  
  
