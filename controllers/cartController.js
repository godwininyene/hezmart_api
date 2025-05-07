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
                attributes: ['id', 'name', 'price', 'coverImage', 'discountPrice']
            }]
        }
    });

    if (!cart) {
        return res.status(200).json({
            status: "success",
            data: {
                items: [],
                summary: { totalItems: 0, totalCost: 0 }
            }
        });
    }

    const items = cart.items || [];

    const summary = items.reduce((acc, item) => {
        acc.totalItems += item.quantity;
        acc.totalCost += item.quantity * item.product.price;
        return acc;
    }, { totalItems: 0, totalCost: 0 });

    res.status(200).json({
        status: "success",
        result:cart.items.length,
        data: {
            items: cart.items,
            summary
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
  
  
  
  
