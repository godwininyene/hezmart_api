const catchAsync = require("../utils/catchAsync");
const { Cart, CartItem, Product, Order, OrderItem } = require('../models');

exports.getCheckoutSession = catchAsync(async (req, res, next) => {
    // 1) Get cart from database
    const userId = req.user.id;
    const { deliveryAddress, paymentMethod, shippingOptionId } = req.body;

    // Retrieve cart with items and products
    const cart = await Cart.findOne({
        where: { userId },
        include: {
            model: CartItem,
            as: 'items',
            include: [{
                model: Product,
                as: 'product',
                attributes: ['id', 'name', 'price', 'discountPrice', 'stockQuantity']
            }]
        }
    });

    if (!cart || !cart.items || cart.items.length === 0) {
        return next(new AppError('Your cart is empty', 400));
    }

    // 2) Calculate totals
    const calculations = cart.items.reduce((acc, item) => {
        const price = parseFloat(item.product.price);
        const discountPrice = item.product.discountPrice ? parseFloat(item.product.discountPrice) : null;
        
        acc.totalItems += item.quantity;
        acc.subtotal += item.quantity * price;
        
        if (discountPrice) {
            acc.discount += item.quantity * (price - discountPrice);
        }

        // Check stock availability
        if (item.product.stockQuantity < item.quantity) {
            acc.unavailableItems.push({
                productId: item.product.id,
                name: item.product.name,
                requested: item.quantity,
                available: item.product.stockQuantity
            });
        }

        return acc;
    }, {
        totalItems: 0,
        subtotal: 0,
        discount: 0,
        unavailableItems: []
    });

    // 3) Validate stock availability
    if (calculations.unavailableItems.length > 0) {
        return next(new AppError(
            'Some items in your cart are not available in the requested quantities',
            { unavailableItems: calculations.unavailableItems },
            400
        ));
    }

    // 4) Get shipping cost (in a real app, this would come from a ShippingOption model)
    const shippingOptions = {
        standard: 1500,
        express: 3000,
        pickup: 0
    };
    const deliveryFee = shippingOptions[shippingOptionId] || 1500;

    // 5) Calculate final total (add tax calculation if needed)
    const total = calculations.subtotal - calculations.discount + deliveryFee;

    // 6) Generate transaction reference
    const tx_ref = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // 7) Prepare Flutterwave payload
    const payload = {
        tx_ref,
        amount: total.toString(),
        currency: "NGN",
        redirect_url: req.body.redirect_url || `${process.env.FRONTEND_URL}/checkout/success`,
        customer: {
            email: req.user.email,
            name: `${req.user.firstName} ${req.user.lastName}`,
            phonenumber: req.user.primaryPhone
        },
        customizations: {
            title: `${process.env.APP_NAME} Payment`,
            logo: `${process.env.APP_URL}/logo.png`
        },
        meta: {
            userId: req.user.id,
            cartId: cart.id,
            deliveryAddress: JSON.stringify(deliveryAddress),
            paymentMethod
        }
    };

    // 8) Create pending order record (important for reconciliation)
    const order = await Order.create({
        userId,
        orderNumber: tx_ref,
        status: 'pending',
        subtotal: calculations.subtotal,
        discount: calculations.discount,
        deliveryFee,
        tax: 0, // Add if applicable
        total,
        paymentMethod,
        paymentStatus: 'pending',
        deliveryAddress
    });

    // Create order items
    await Promise.all(cart.items.map(item => 
        OrderItem.create({
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.product.price,
            discountPrice: item.product.discountPrice
        })
    ));

    // 9) Call Flutterwave API
    const response = await axios.post(
        'https://api.flutterwave.com/v3/payments',
        payload,
        {
            headers: {
                Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        }
    );

    // 10) Respond with checkout URL
    res.status(200).json({
        status: "success",
        data: {
            checkoutUrl: response.data.data.link,
            orderId: order.id
        }
    });
});


exports.handleFlutterwaveWebhook = catchAsync(async(req, res, next)=>{
    
})
