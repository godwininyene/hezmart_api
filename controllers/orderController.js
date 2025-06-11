const catchAsync = require("../utils/catchAsync");
const { Cart, CartItem, Product, Order, OrderItem, sequelize, User, Review, Coupon } = require('../models');
const AppError = require("../utils/appError");
const axios = require('axios');
const Sequelize = require('sequelize');
const generatePaginationMeta = require('../utils/pagination');
const APIFeatures = require("../utils/apiFeatures");
const Email = require('./../utils/email')
const crypto = require('crypto');

// Helper function to calculate cart totals
const calculateCartTotals = (items) => {
  return items.reduce((acc, item) => {
    const price = parseFloat(item.product.price);
    const discountPrice = item.product.discountPrice 
      ? parseFloat(item.product.discountPrice) 
      : null;
    
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
    discount: 0, // This will be combined with coupon discount
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

  // Base include structure with enhanced OrderItem fields
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
          attributes: ['id', 'businessName', 'businessLogo']
        }
      ]
    },
    {
      model: User,
      as: 'user',
      attributes: ['id', 'firstName', 'lastName', 'photo']
    }
  ];

  // Role-based filtering
  if (role === 'admin') {
    // Admin sees all orders with all items
    features.queryOptions.where = features.queryOptions.where || {};
  } else if (role === 'vendor') {
    // Vendor sees only their items with parent order info
    features.queryOptions.include[0].where = { vendorId: userId };
    features.queryOptions.include[0].required = true; // Inner join to filter orders
    
    // For vendor view, we want to see the order even if some items are from other vendors
    features.queryOptions.distinct = true;
  } else {
    // Customer sees only their own orders
    features.queryOptions.where = { userId };
  }

  // Add status-based filtering if requested
  if (req.query.status) {
    const statusMap = {
      'pending': ['pending'],
      'processing': ['processing'],
      'shipped': ['partially_shipped', 'shipped'],
      'delivered': ['partially_delivered', 'delivered'],
      'received': ['partially_received', 'completed'],
      'cancelled': ['partially_cancelled', 'cancelled']
    };
    
    const statuses = statusMap[req.query.status] || [req.query.status];
    features.queryOptions.where = {
      ...features.queryOptions.where,
      status: { [Sequelize.Op.in]: statuses }
    };
  }

  // Execute the query with count
  const { count, rows: orders } = await Order.findAndCountAll(features.getOptions());

  // For vendor view, group items by vendor (though they'll only see their own)
  if (role === 'vendor') {
    orders.forEach(order => {
      order.dataValues.vendorItems = {};
      order.items.forEach(item => {
        if (!order.dataValues.vendorItems[item.vendorId]) {
          order.dataValues.vendorItems[item.vendorId] = {
            vendor: item.vendor,
            items: []
          };
        }
        order.dataValues.vendorItems[item.vendorId].items.push(item);
      });
    });
  }

  const { page, limit } = features.getPaginationInfo();
  const pagination = generatePaginationMeta({ count, page, limit, req });

  res.status(200).json({
    status: 'success',
    pagination,
    data: {
      orders,
      // Include role-specific metadata
      meta: role === 'vendor' ? { 
        isVendorView: true,
        totalItems: count 
      } : null
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
            attributes: ['id', 'name', 'coverImage'],
            include:{
              model:Review,
              as:'reviews',
              attributes:['id', 'rating', 'review', 'userId']
            }
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
    data:{
      order
    }
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

  // 1) Get cart from database (including coupon info)
  const cart = await Cart.findOne({
    where: { userId },
    include: [
      {
        model: CartItem,
        as: 'items',
        include: [{
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'price', 'discountPrice', 'stockQuantity', 'userId']
        }]
      },
      {
        model: Coupon,
        as: 'coupon',
        attributes: ['id', 'code', 'type']
      }
    ]
  });

  if (!cart || !cart.items || cart.items.length === 0) {
    return next(new AppError('Your cart is empty', '', 400));
  }

  // 2) Calculate totals (consider cart discount)
  const calculations = calculateCartTotals(cart.items);
  
  // Apply coupon discount if exists
  const couponDiscount = cart.discountAmount || 0;
  calculations.discount += parseFloat(couponDiscount);

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

  // 5) Calculate final total (including coupon discount)
  const total = calculations.subtotal - calculations.discount + deliveryFee;
  
  const orderNumber = await Order.generateOrderNumber();

  // 6) Create pending order record with coupon info
  const order = await Order.create({
    userId,
    orderNumber,
    status: 'pending',
    subtotal: calculations.subtotal,
    discount: calculations.discount,
    couponId: cart.couponId, // Store coupon reference
    couponCode: cart.coupon?.code, // Store coupon code for reference
    deliveryFee,
    tax: 0,
    total,
    paymentMethod,
    paymentStatus: 'pending',
    deliveryAddress,
  });

  // 7) Create order items
  await Promise.all(cart.items.map(item =>
    OrderItem.create({
      orderId: order.id,
      productId: item.productId,
      vendorId: item.product.userId,
      quantity: item.quantity,
      price: item.product.price,
      discountPrice: item.product.discountPrice,
      selectedOptions: item.selectedOptions || {},
      fulfillmentStatus: 'pending'
    })
  ));

  // 8) Process stock updates in batches
  await Promise.all(cart.items.map(item => 
      Product.decrement('stockQuantity', {
      by: item.quantity,
      where: { id: item.productId },
    })
  ));

  // Prepare vendor notifications data
  const vendorOrdersMap = new Map();
  cart.items.forEach(item => {
    const vendorId = item.product.userId;
    if (!vendorOrdersMap.has(vendorId)) {
      vendorOrdersMap.set(vendorId, {
        vendorId,
        items: []
      });
    }
    vendorOrdersMap.get(vendorId).items.push(item.get({ plain: true }));
  });

  // Get all vendors in one query
  const vendorIds = Array.from(vendorOrdersMap.keys());
  const vendors = await User.findAll({
    where: { id: vendorIds },
    attributes: ['id', 'email', 'firstName']
  });

  // Send notifications to each vendor
  await Promise.all(
    vendors.map(async vendor => {
      const vendorItems = vendorOrdersMap.get(vendor.id).items;
      const vendorOrderTotal = vendorItems.reduce((sum, item) => {
        return sum + (item.product.discountPrice || item.product.price) * item.quantity;
      }, 0);

      vendorItems.forEach(item => {
        const unitPrice = item.product.discountPrice || item.product.price;
        item.total = unitPrice * item.quantity;
      });

      try {
        await new Email(
          vendor,
          null,
          `${process.env.FRONTEND_URL}/vendor/orders`,
          'new_order'
        ).sendVendorOrderNotification({
          subject: `🎉 New Order Received (${orderNumber})`,
          orderNumber,
          orderTotal: vendorOrderTotal,
          items: vendorItems,
          customerName: `${req.user.firstName} ${req.user.lastName}`
        });
      } catch (emailError) {
        console.error(`Failed to send email to vendor ${vendor.email}:`, emailError);
      }
    })
  );
  
  // 9) Create or update Paystack customer
  const customerPayload = {
    email: req.user.email,
    first_name: req.user.firstName,
    last_name: req.user.lastName,
    phone: req.user.primaryPhone || ''
  };

  try {
    await axios.post('https://api.paystack.co/customer', customerPayload, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (err) {
    console.error('Failed to create Paystack customer:', err.response?.data || err.message);
  }

  // 10) Prepare Paystack payload (include coupon info in metadata)
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
        },
        {
          display_name: "Coupon Code",
          variable_name: "coupon_code",
          value: cart.coupon?.code || 'none'
        }
      ],
      userId: req.user.id,
      cartId: cart.id,
      couponId: cart.couponId,
      deliveryAddress: JSON.stringify(deliveryAddress),
      paymentMethod
    }
  };

  // 11) Call Paystack API
  try {
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      payload,
      {
        headers: {
          // Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
           Authorization: `Bearer sk_test_e0753309f4e282a44c1b076b5d0c5c252ced1f36`,
          'Content-Type': 'application/json'
        }
      }
    );

    // 12) Clear the cart if transaction was initialized successfully
    if (response.data.status) {
      await Cart.destroy({ where: { userId: order.userId } });
    }

    res.status(200).json({
      status: "success",
      data: {
        checkoutUrl: response.data.data.authorization_url,
        orderId: order.id,
        reference: orderNumber,
        couponApplied: !!cart.couponId
      }
    });
  } catch (error) {
    // If paystack failed, mark order as failed
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



// Update order item status
exports.updateItemStatus = catchAsync(async (req, res, next) => {
  const { itemId } = req.params;
  const { status, notes } = req.body;
  const { id: userId, role } = req.user;


  // 1) Find the order item with necessary fields
  const item = await OrderItem.findOne({
    where: { id: itemId },
    include: [{
      model: Order,
      as: 'order',
      attributes: ['id', 'userId']
    }]
  });
  

  if (!item) {
    return next(new AppError('Order item not found', '', 404));
  }

  // 2) Authorization check
  if (role === 'customer') {
    if (status !== 'received') {
      return next(new AppError('You can only mark items as received', '', 403));
    }
    if (item.order.userId !== userId) {
      return next(new AppError('Not authorized to update this item', '', 403));
    }
  } else if (role === 'vendor') {
    if (item.vendorId !== userId) {
      return next(new AppError('Not authorized to update this item', '', 403));
    }
    if (status === 'received') {
      return next(new AppError('Vendors cannot mark items as received', '', 403));
    }
  }

  // 3) Prepare update data
  const updateData = {};
  if (notes) {
    if (role === 'vendor') {
      updateData.vendorNotes = notes;
    } else if (role === 'customer') {
      updateData.customerNotes = notes;
    }
  }

  try {
    // 4) Use the model's updateStatus method
    await item.updateStatus(status, updateData);
   
    // 5) Return updated item
    const updatedItem = await OrderItem.findByPk(itemId, {
      include: [
        { 
          model: Order, 
          as: 'order', 
          attributes: ['id', 'status', 'orderNumber'] 
        },
        { 
          model: Product, 
          as: 'product', 
          attributes: ['id', 'name'] 
        }
      ]
    });

    res.status(200).json({
      status: 'success',
      data: {
        item: updatedItem,
        orderStatus: updatedItem.order.status 
      }
    });
  } catch (error) {
    if (error.message.includes('Invalid status transition')) {
      return next(new AppError(error.message, '', 400));
    }
    throw error;
  }
});
