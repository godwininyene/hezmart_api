const catchAsync = require("../utils/catchAsync");
const { Cart, CartItem, Product, Order, OrderItem, sequelize, User } = require('../models');
const AppError = require("../utils/appError");
const axios = require('axios');
const Sequelize = require('sequelize');
const generatePaginationMeta = require('../utils/pagination');
const APIFeatures = require("../utils/apiFeatures");

// Helper function to calculate cart totals
const calculateCartTotals = (items) => {
  return items.reduce((acc, item) => {
    const price = parseFloat(item.product.price);
    const discountPrice = item.product.discountPrice ? parseFloat(item.product.discountPrice) : null;
    
    acc.totalItems += item.quantity;
    acc.subtotal += item.quantity * price;
    
    if (discountPrice) {
      acc.discount += item.quantity * (price - discountPrice);
    }

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
};

// Get all orders for current user
exports.getUserOrders = catchAsync(async (req, res, next) => {
  const { role, id: userId } = req.user;

  const features = new APIFeatures(req.query, 'Order')
    .filter()
    .sort()
    .limitFields()
    .paginate();

  // Base include structure
  features.queryOptions.include = [
    {
      model: OrderItem,
      as: 'items',
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'coverImage']
        },
        {
          model: User,
          as: 'vendor',
          attributes: ['businessName', 'businessLogo']
        }
      ]
    },
    {
      model: User,
      as: 'user',
      attributes: ['firstName', 'lastName', 'photo']
    }
  ];
 
  // Determine WHERE condition based on user role
  if (role === 'admin') {
    // No filtering for admin — all orders
    features.queryOptions.where = features.queryOptions.where;
  } else if (role === 'vendor') {
    // Filter orders where any item has vendorId === current user
    features.queryOptions.include[0].where = { vendorId: userId };
  } else {
    // Regular user - fetch only their own orders
    features.queryOptions.where = { userId };
  }

  // Execute the query with count
  const { count, rows: orders } = await Order.findAndCountAll(features.getOptions());
  
  const { page, limit } = features.getPaginationInfo();
  const pagination = generatePaginationMeta({ count, page, limit, req });

  res.status(200).json({
    status: 'success',
    pagination,
    data: {
      orders
    }
  });
});


// Get single order details
exports.getOrder = catchAsync(async (req, res, next) => {
  const { id: orderId } = req.params;
  const { id: userId, role } = req.user;

  // Build base query options
  const queryOptions = {
    where: { id: orderId },
    include: [
      {
        model: OrderItem,
        as: 'items',
        include: [
          {
            model: Product,
            as: 'product',
            attributes: ['id', 'name', 'coverImage']
          },
          {
            model: User,
            as: 'vendor',
            attributes: ['businessName', 'businessLogo']
          }
        ]
      },
      {
        model: User,
        as: 'user',
        attributes: ['firstName', 'lastName', 'photo']
      }
    ]
  };

  // Apply access control logic
  if (role === 'customer') {
    queryOptions.where.userId = userId;
  }

  const order = await Order.findOne(queryOptions);

  // Additional check if user is a vendor
  if (role === 'vendor' && order) {
    const isVendorInOrder = order.items.some(item => item.vendorId === userId);
    if (!isVendorInOrder) {
      return next(new AppError('You do not have access to this order', '', 403));
    }
  }

  if (!order) {
    return next(new AppError('No order found with that ID', '', 404));
  }

  res.status(200).json({
    status: 'success',
    data: order
  });
});

// Cancel an order
exports.cancelOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findOne({
    where: { 
      id: req.params.id,
      userId: req.user.id 
    }
  });

  if (!order) {
    return next(new AppError('No order found with that ID','', 404));
  }

  if (order.status !== 'pending') {
    return next(new AppError('Order can only be cancelled if status is pending','', 400));
  }

  await order.update({ status: 'cancelled' });

  res.status(200).json({
    status: 'success',
    message: 'Order cancelled successfully',
    data: order
  });
});

// Get Paystack checkout session
exports.getCheckoutSession = catchAsync(async (req, res, next) => {  
  const userId = req.user.id;
  const { deliveryAddress, paymentMethod = 'card', shippingOptionId } = req.body;

  // 1) Get cart from database
  const cart = await Cart.findOne({
    where: { userId },
    include: {
      model: CartItem,
      as: 'items',
      include: [{
        model: Product,
        as: 'product',
        attributes: ['id', 'name', 'price', 'discountPrice', 'stockQuantity', 'userId']
      }]
    }
  });

  if (!cart || !cart.items || cart.items.length === 0) {
    return next(new AppError('Your cart is empty','', 400));
  }

  // 2) Calculate totals
  const calculations = calculateCartTotals(cart.items);

  // 3) Validate stock availability
  if (calculations.unavailableItems.length > 0) {
    return next(new AppError(
      'Some items in your cart are not available in the requested quantities',
      { unavailableItems: calculations.unavailableItems },
      400
    ));
  }

  // 4) Get shipping cost
  const shippingOptions = {
    standard: 1500,
    express: 3000,
    pickup: 0
  };
  const deliveryFee = shippingOptions[shippingOptionId] || 1500;

  // 5) Calculate final total
  const total = calculations.subtotal - calculations.discount + deliveryFee;
  const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // 6) Create pending order record
  const order = await Order.create({
    userId,
    orderNumber,
    status: 'pending',
    subtotal: calculations.subtotal,
    discount: calculations.discount,
    deliveryFee,
    tax: 0,
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
      vendorId: item.product.userId,
      quantity: item.quantity,
      price: item.product.price,
      discountPrice: item.product.discountPrice,
      selectedOptions: item.selectedOptions || []
    })
  ));

  // ✅ 7) Create or update Paystack customer
  const customerPayload = {
    email: req.user.email,
    first_name: req.user.firstName,
    last_name: req.user.lastName,
    phone: req.user.primaryPhone || ''  // optional
  };

  try {
    await axios.post('https://api.paystack.co/customer', customerPayload, {
      headers: {
        Authorization: `Bearer sk_test_e0753309f4e282a44c1b076b5d0c5c252ced1f36`,
        'Content-Type': 'application/json'
      }
    });
  } catch (err) {
    console.error('Failed to create Paystack customer:', err.response?.data || err.message);
    // Throw or proceed depending on how critical this is
  }

  // 8) Prepare Paystack payload
  const payload = {
    email: req.user.email,
    amount: total * 100,
    reference: orderNumber,
    callback_url: req.body.redirect_url || `${process.env.FRONTEND_URL}/orders`,
    metadata: {
      custom_fields: [
        {
          display_name: "Customer Name",
          variable_name: "customer_name",
          value: `${req.user.firstName} ${req.user.lastName}`
        },
        {
          display_name: "Order ID",
          variable_name: "order_id",
          value: order.id
        }
      ],
      userId: req.user.id,
      cartId: cart.id,
      deliveryAddress: JSON.stringify(deliveryAddress),
      paymentMethod
    }
  };

  // 9) Call Paystack API
  try {
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      payload,
      {
        headers: {
          Authorization: `Bearer sk_test_e0753309f4e282a44c1b076b5d0c5c252ced1f36`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Clear the cart if transaction was initialized successfully
    if (response.data.status) {
      await Cart.destroy({ where: { userId: order.userId } });
    }

    res.status(200).json({
      status: "success",
      data: {
        checkoutUrl: response.data.data.authorization_url,
        orderId: order.id,
        reference: orderNumber
      }
    });
  } catch (error) {
    //If paystack failed, mark order as failed
    await order.update({ status: 'failed' });
    throw error;
  }
});

// Handle Paystack webhook
exports.handlePaystackWebhook = catchAsync(async (req, res, next) => {
  const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(401).send('Invalid signature');
  }

  const event = req.body;
  const reference = event.data.reference;

  if (event.event === 'charge.success') {
    // Find order by reference number
    const order = await Order.findOne({ where: { orderNumber: reference } });
    
    if (!order) {
      return res.status(404).json({ status: 'error', message: 'Order not found' });
    }

    // Update order status
    await order.update({
      paymentStatus: 'paid',
      status: 'processing'
    });

    // Update product stock quantities
    const orderItems = await OrderItem.findAll({ where: { orderId: order.id } });
    await Promise.all(orderItems.map(async item => {
      const product = await Product.findByPk(item.productId);
      if (product) {
        product.stockQuantity -= item.quantity;
        await product.save();
      }
    }));
    // Clear the cart
    await Cart.destroy({ where: { userId: order.userId } });
  }

  res.status(200).json({ status: 'success' });
});

// Verify Paystack payment
exports.verifyPayment = catchAsync(async (req, res, next) => {
  const { reference } = req.params;

  const response = await axios.get(
    `https://api.paystack.co/transaction/verify/${reference}`,
    {
      headers: {
        
        // Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
         Authorization: `Bearer sk_test_e0753309f4e282a44c1b076b5d0c5c252ced1f36`
      }
    }
  );

  const paymentData = response.data.data;

  // Find and update order
  const order = await Order.findOne({ where: { orderNumber: reference } });
  if (!order) {
    return next(new AppError('Order not found','', 404));
  }

  if (paymentData.status) {
    await order.update({
      paymentStatus: 'paid',
      status: 'processing'
    });

    // Clear cart
    await Cart.destroy({ where: { userId: order.userId } });
  }
  //Get user's orders 
  const orders = await Order.findAll({
    where: { userId: req.user.id },
    include: [{
      model: OrderItem,
      as: 'items',
      include: [{
        model: Product,
        as: 'product',
        attributes: ['id', 'name', 'coverImage']
      }]
    }],
    order: [['createdAt', 'DESC']]
  });

  res.status(200).json({
    status: 'success',
    data: {
      orders,
      paymentStatus: paymentData.status,
      orderStatus: order.status
    }
  });
});