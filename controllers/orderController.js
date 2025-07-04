const catchAsync = require("../utils/catchAsync");
const { Cart, CartItem, Product, Order, OrderItem, PickupLocation, PaymentOption, ShippingStateFee, User, Review, Coupon } = require('../models');
const AppError = require("../utils/appError");
const axios = require('axios');
const Sequelize = require('sequelize');
const generatePaginationMeta = require('../utils/pagination');
const APIFeatures = require("../utils/apiFeatures");
const Email = require('./../utils/email')
const crypto = require('crypto');
const { prepareOrderData, processOrderCreation ,sendOrderNotifications } = require('../utils/orderHelpers');


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

// Get CheckoutSession Controller - Only prepares payment
exports.getCheckoutSession = catchAsync(async (req, res, next) => {
  try{
    const { orderData, cart } = await prepareOrderData(req, req.body);
  
    // Prepare Paystack payload
    const payload = {
      email: orderData.customer.email,
      amount: orderData.total * 100,
      reference: orderData.orderNumber,
      callback_url: req.body.redirect_url || `${process.env.FRONTEND_URL}/orders`,
      metadata: {
        orderData: JSON.stringify(orderData),
        cartId: cart.id
      }
    };

    // Call Paystack API
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

    res.status(200).json({
      status: "success",
      data: {
        checkoutUrl: response.data.data.authorization_url,
        reference: orderData.orderNumber
      }
    });
  }catch(error){
     console.log(error);
    return next(error);
  }
});

//The below is currently working
// exports.getCheckoutSession = catchAsync(async (req, res, next) => {  
//   const userId = req.user.id;
//   const { 
//     deliveryAddress, 
//     paymentMethod = 'card', 
//     deliveryOption,
//     selectedStateId,//This is the selected state fee ID
//     pickupStationId, // This is the selected station ID
//     cryptoWalletId, //This is the selected crypto wallet id
//   } = req.body;

//   // 1) Get cart and validate
//   const cart = await Cart.findOne({
//     where: { userId },
//     include: [
//       {
//         model: CartItem,
//         as: 'items',
//         include: [{
//           model: Product,
//           as: 'product',
//           attributes: ['id', 'name', 'price', 'discountPrice', 'stockQuantity', 'userId']
//         }]
//       },
//       {
//         model: Coupon,
//         as: 'coupon',
//         attributes: ['id', 'code', 'type']
//       }
//     ]
//   });

//   if (!cart || !cart.items || cart.items.length === 0) {
//     return next(new AppError('Your cart is empty', '', 400));
//   }

//   // 2) Calculate delivery fee based on delivery option
//   let deliveryFee = 0;
//   let stateFee = 0;
//   let pickupStationDetails = null;
//   let walletDetails = null;
//   let stateFeeData = null

//   if(deliveryOption === 'door' && !selectedStateId){
//     return next(new AppError('Missing field (selectedStateId) for door delivery', '', 400))
//   }

//   if(deliveryOption === 'pickup' && !pickupStationId){
//     return next(new AppError('Missing field (pickupStationId) for pickup delivery', '', 400))
//   }

//   if(paymentMethod === 'crypto' && !cryptoWalletId){
//     return next(new AppError('Missing field (cryptoWalletId) for crypto payment method', '', 400))
//   }

//   if (deliveryOption === 'door') {
//     // Fetch state fee from database
//     stateFeeData = await ShippingStateFee.findByPk(selectedStateId,{
//       attributes: ['fee', 'state']
//     });
   
    
//     if (!stateFeeData) {
//       return next(new AppError(`Delivery not available for selected state`,'', 400));
//     }
    
//     stateFee = parseFloat(stateFeeData.fee);
//     deliveryFee = stateFee;
//   } 
//   else if (deliveryOption === 'pickup') {
//     // Fetch pickup station details
//     const station = await PickupLocation.findByPk(pickupStationId, {
//       attributes: ['name','fee', 'state', 'address', 'contactPhone']
//     });
//     if (!station) {
//       return next(new AppError('Selected pickup station not found', '', 400));
//     }
    
//     pickupStationDetails = {
//       name: station.name,
//       state:station.state,
//       address: station.address,
//       fee: station.fee,
//       contactPhone:station.contactPhone
//     };
//     deliveryFee = parseFloat(station.fee);
//   }

//   if(paymentMethod === 'crypto'){
//     const wallet = await PaymentOption.findByPk(cryptoWalletId,{
//       attributes:['networkName', 'walletAddress', 'barcode']
//     })
//     if(!wallet){
//       return next(new AppError('Selected wallet not found', '', 400));
//     }
//     walletDetails = {
//       name:wallet.networkName,
//       address:wallet.walletAddress,
//       barcode:wallet.barcode
//     }
//   }

//   // 3) Calculate cart totals
//   const calculations = calculateCartTotals(cart.items);
//   const couponDiscount = cart.discountAmount || 0;
//   calculations.discount += parseFloat(couponDiscount);

//   if (calculations.unavailableItems.length > 0) {
//     return next(new AppError(
//       'Some items in your cart are not available in the requested quantities',
//       { unavailableItems: calculations.unavailableItems },
//       400
//     ));
//   }

//   // 4) Calculate final total
//   const total = calculations.subtotal - calculations.discount + deliveryFee;
//   const orderNumber = await Order.generateOrderNumber();

//   // 5) Prepare order data
//   const orderData = {
//     userId,
//     orderNumber,
//     subtotal: calculations.subtotal,
//     discount: calculations.discount,
//     couponId: cart.couponId,
//     couponCode: cart.coupon?.code,
//     deliveryFee,
//     total,
//     paymentMethod,
//     deliveryOption,
//     deliveryAddress,
//     state: deliveryOption === 'door' ? stateFeeData.state : null,
//     stateFee: deliveryOption === 'door' ? stateFee : null,
//     pickupStationDetails: deliveryOption === 'pickup' ? pickupStationDetails : null,
//     walletDetails:paymentMethod ==='crypto' ?walletDetails :null,
//     items: cart.items.map(item => ({
//       productId: item.productId,
//       name: item.product.name,
//       vendorId: item.product.userId,
//       quantity: item.quantity,
//       price: item.product.price,
//       discountPrice: item.product.discountPrice,
//       selectedOptions: item.selectedOptions || {}
//     })),
//     customer: {
//       email: req.user.email,
//       name: `${req.user.firstName} ${req.user.lastName}`,
//       phone: req.user.primaryPhone || ''
//     },
//   };

//   // 6) Prepare Paystack payload
//   const payload = {
//     email: req.user.email,
//     amount: total * 100,
//     reference: orderNumber,
//     callback_url: req.body.redirect_url || `${process.env.FRONTEND_URL}/orders`,
//     metadata: {
//       orderData: JSON.stringify(orderData),
//       cartId: cart.id
//     }
//   };

//   // 7) Call Paystack API
//   const response = await axios.post(
//     'https://api.paystack.co/transaction/initialize',
//     payload,
//     {
//       headers: {
//         Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
//         'Content-Type': 'application/json'
//       }
//     }
//   );

//   res.status(200).json({
//     status: "success",
//     data: {
//       checkoutUrl: response.data.data.authorization_url,
//       reference: orderNumber
//     }
//   });
// });

// Handle Paystack webhook - Creates and processes the order
exports.handlePaystackWebhook = catchAsync(async (req, res, next) => {
  // Verify signature
  // const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
  //   .update(JSON.stringify(req.body))
  //   .digest('hex');

   const hash = crypto.createHmac('sha512', 'sk_test_e0753309f4e282a44c1b076b5d0c5c252ced1f36')
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(401).send('Invalid signature');
  }

  const event = req.body;
  res.status(200).json({ status: 'received' });
  
  if (event.event === 'charge.success') {
    try {
      const metadata = event.data.metadata;
      const orderData = JSON.parse(metadata.orderData);
      const paymentMethod = event.data.channel || 'card';
      
      // Create and process the order
      const order = await processOrderCreation(orderData, { status: 'paid' });
      
      // Clear the cart
      await Cart.destroy({ where: { id: metadata.cartId } });
      
      // Send notifications
      await sendOrderNotifications(order, orderData);

      // Create/update Paystack customer
      try {
        await axios.post('https://api.paystack.co/customer', {
          email: orderData.customer.email,
          first_name: orderData.customer.name.split(' ')[0],
          last_name: orderData.customer.name.split(' ')[1] || '',
          phone: orderData.customer.phone || ''
        }, {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (err) {
        console.error('Failed to create Paystack customer:', err.response?.data || err.message);
      }
    } catch (error) {
      console.error('Error processing payment webhook:', error);
    }
  }
});


//Handle crypto payment checkout
exports.createCryptoOrder = catchAsync(async (req, res, next) => {
  try{
    const { orderData, cart } = await prepareOrderData(req, req.body);   
    // Create order with pending payment status
    orderData.paymentMethod = 'crypto';
    const order = await processOrderCreation(orderData, { status: 'pending' });
    
    // Clear the cart
    await Cart.destroy({ where: { id: cart.id } });
    
    // Send notifications
    await sendOrderNotifications(order, orderData);

    res.status(200).json({
      status: "success",
      data: {
        order,
        paymentDetails: {
          method: 'crypto',
          walletDetails: orderData.walletDetails,
          amount: orderData.total
        }
      }
    });
  }catch(error){
    console.log(error);
    return next(error);
  }
});

//Below is currently working
// exports.handlePaystackWebhook = catchAsync(async (req, res, next) => {
//   // 1) Verify signature first
//   const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
//     .update(JSON.stringify(req.body))
//     .digest('hex');

//   //  const hash = crypto.createHmac('sha512', 'sk_test_e0753309f4e282a44c1b076b5d0c5c252ced1f36')
//   //   .update(JSON.stringify(req.body))
//   //   .digest('hex');

//   if (hash !== req.headers['x-paystack-signature']) {
//     return res.status(401).send('Invalid signature');
//   }

//   const event = req.body;
//   // 2) Immediately respond to Paystack to acknowledge receipt
//   res.status(200).json({ status: 'received' });
  
//   // // 3) Process the webhook asynchronously
//   if (event.event === 'charge.success') {
//     try {
//       await processSuccessfulPayment(event);
//     } catch (error) {
//       console.error('Error processing payment webhook:', error);
//       // Implement your error handling/retry logic here
//     }
//   }

// });

// Async function to handle the actual order creation and processing
async function processSuccessfulPayment(event) {
  const metadata = event.data.metadata;
  const orderData = JSON.parse(metadata.orderData);
  const cartId = metadata.cartId;
  // Get the actual payment method used from Paystack
  const paymentMethod = event.data.channel || 'card'; // Default to card if not specified

  // 1) Create the order record
  const order = await Order.create({
    userId: orderData.userId,
    orderNumber: orderData.orderNumber,
    status: 'processing',
    subtotal: orderData.subtotal,
    discount: orderData.discount,
    couponId: orderData.couponId,
    couponCode: orderData.couponCode,
    deliveryFee: orderData.deliveryFee,
    tax: 0,
    total: orderData.total,
    paymentMethod: paymentMethod, // Using Paystack's channel info
    paymentStatus: 'paid',
    deliveryAddress: orderData.deliveryAddress,
  });

  // 2) Create order items
  await Promise.all(orderData.items.map(item =>
    OrderItem.create({
      orderId: order.id,
      productId: item.productId,
      vendorId: item.vendorId,
      quantity: item.quantity,
      price: item.price,
      discountPrice: item.discountPrice,
      selectedOptions: item.selectedOptions,
      fulfillmentStatus: 'pending'
    })
  ));

  // 3) Update stock quantities
  await Promise.all(orderData.items.map(item => 
    Product.decrement('stockQuantity', {
      by: item.quantity,
      where: { id: item.productId },
    })
  ));

  // 4) Clear the cart
  await Cart.destroy({ where: { id: cartId } });

  // 5) Prepare and send vendor notifications
  const vendorOrdersMap = new Map();
  orderData.items.forEach(item => {
    if (!vendorOrdersMap.has(item.vendorId)) {
      vendorOrdersMap.set(item.vendorId, {
        vendorId: item.vendorId,
        items: []
      });
    }
    vendorOrdersMap.get(item.vendorId).items.push(item);
  });

  const vendorIds = Array.from(vendorOrdersMap.keys());
  const vendors = await User.findAll({
    where: { id: vendorIds },
    attributes: ['id', 'email', 'firstName']
  });

  // Send notifications asynchronously
  vendors.forEach(async vendor => {
    const vendorItems = vendorOrdersMap.get(vendor.id).items;
    const vendorOrderTotal = vendorItems.reduce((sum, item) => {
      return sum + (item.discountPrice || item.price) * item.quantity;
    }, 0);

    vendorItems.forEach(item => {
      const unitPrice = item.discountPrice || item.price;
      item.total = unitPrice * item.quantity;
    });

    try {
      await new Email(
        vendor,
        null,
        `${process.env.FRONTEND_URL}/manage/vendor/orders/${order.id}`,
        'new_order'
      ).sendVendorOrderNotification({
        subject: `🎉 New Order Received (${order.orderNumber})`,
        orderNumber: order.orderNumber,
        orderTotal: vendorOrderTotal,
        items: vendorItems,
        customerName: orderData.customer.name,
        orderId:order.id
      });
    } catch (emailError) {
      console.error(`Failed to send email to vendor ${vendor.email}:`, emailError);
    }
  });


  // 6) Send customer order confirmation
  try {
    const customer = await User.findByPk(orderData.userId, {
      attributes: ['id', 'email', 'firstName']
    });

    if (customer) {
      const customerItems = orderData.items.map(item => {
        const unitPrice = item.discountPrice || item.price;
        return {
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          discountPrice: item.discountPrice,
          total: unitPrice * item.quantity
        };
      });
      await new Email(
        customer,
        null,
        `${process.env.FRONTEND_URL}/orders/${order.id}`,
        'order_confirmation'
      ).sendCustomerOrderConfirmation({
        subject: `✅ Order Confirmation – Order #${order.orderNumber}`,
        orderNumber: order.orderNumber,
        orderDate: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        paymentMethod: paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1),
        shippingAddress: {
          name: orderData.customer.name,
          primaryPhone: orderData.deliveryAddress.primaryPhone,
          primaryAddress: orderData.deliveryAddress.primaryAddress,
          city: orderData.deliveryAddress.city,
          country: orderData.deliveryAddress.country
        },
        items: customerItems,
        orderTotal: order.total,
        supportPhone: process.env.SUPPORT_PHONE || '+234 916 000 2490'
      });
    }
  } catch (customerEmailError) {
    console.error('Failed to send order confirmation to customer:', customerEmailError);
  }

  // 8) Send admin notification
  try {
    const admin = {
      firstName: 'Hezmart Admin',
      email: 'hezmartng@gmail.com'
      //  email: 'admin@investmentcrestcapital.com'
    };
    const adminItems = orderData.items.map(item => {
      const unitPrice = item.discountPrice || item.price;
      const vendor = vendors.find(v => v.id === item.vendorId);
      return {
        name: item.name,
        vendor: vendor?.firstName || 'Unknown Vendor',
        quantity: item.quantity,
        price: item.price,
        discountPrice: item.discountPrice,
        total: unitPrice * item.quantity
      };
    });

    const adminEmailData = {
      orderNumber: order.orderNumber,
      orderId: order.id,
      orderDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      paymentMethod: order.paymentMethod,
      customerName: orderData.customer.name,
      items: adminItems,
      orderTotal: order.total,
      // url: `${process.env.ADMIN_DASHBOARD_URL || process.env.FRONTEND_URL}/admin/orders/${order.id}`
    };

    await new Email(
      admin,
      null,
      `${process.env.FRONTEND_URL}/manage/admin/orders/${order.id}`,
      'new_order'
    ).sendAdminOrderNotification(adminEmailData);
  } catch (err) {
    console.error(`Failed to send order notification to admin:`, err);
  }

  // 8) Create/update Paystack customer (if needed)
  try {
    await axios.post('https://api.paystack.co/customer', {
      email: orderData.customer.email,
      first_name: orderData.customer.name.split(' ')[0],
      last_name: orderData.customer.name.split(' ')[1] || '',
      phone: orderData.customer.phone || ''
    }, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (err) {
    console.error('Failed to create Paystack customer:', err.response?.data || err.message);
  }
}

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

//Confirm payment
exports.confirmPayment = catchAsync(async(req, res, next)=>{
  const { id } = req.params;
  //1) Find the order with necessary field
  const order = await Order.findByPk(id, {
    include:[{model: User, as: 'user', attributes:['id', 'firstName', 'email']}]
  });
  
  if (!order) {
    return next(new AppError('Order not found', '', 404));
  }

  // Format the transaction date
  const formatTransactionDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Prepare  notification data
  const notificationData = {
    orderNumber: order.orderNumber,
    amount:order.total,
    paymentMethod: order.paymentMethod,
    transactionDate: formatTransactionDate(order.createdAt),
    orderId:order.id,
    supportPhone: process.env.SUPPORT_PHONE || '+234 916 000 2490'
  };

  try{
    const customerEmail = new Email(
      order.user,
      null,
      process.env.FRONTEND_URL || 'https://hezmart.com',
      null
    );
    await  customerEmail.sendPaymentConfirmation(notificationData)

    await order.update({ 
      paymentStatus: 'paid',
    });
  }catch(err){
    console.error('Failed to send customer notification:', err);
    return next(err)
  }
  
 

  res.status(200).json({
    status:'success',
    data:{
      order
    }
  })
})

// Update order item status
exports.updateItemStatus = catchAsync(async (req, res, next) => {
  const { itemId } = req.params;
  const { status, notes } = req.body;
  const { id: userId, role } = req.user;

  // 1) Find the order item with necessary fields
  const item = await OrderItem.findOne({
    where: { id: itemId },
    include: [
      {
        model: Order,
        as: 'order',
        attributes: ['id', 'userId', 'orderNumber'],
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'email', 'role']
        }]
      },
      {
        model: User,
        as: 'vendor',
        attributes: ['id', 'firstName', 'email', 'role']
      },
      {
        model: Product,
        as: 'product',
        attributes: ['id', 'name']
      }
    ]
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
   
    // 5) Send notifications if status is significant
    if (['processing', 'shipped', 'delivered','received', 'cancelled', 'returned'].includes(status)) {
      // Prepare common notification data
      const notificationData = {
        orderNumber: item.order.orderNumber,
        orderId:item.order.id,
        status,
        items: [{
          name: item.product.name,
          quantity: item.quantity,
          price:item.price || item.discountPrice,
          status
        }],
      };

      // Send to customer if not initiated by customer
      if (item.order.user && role !== 'customer') {
        try {
          const customerEmail = new Email(
            item.order.user,
            null,
            process.env.FRONTEND_URL || 'https://hezmart.com',
            status
          );
          await customerEmail.sendOrderStatusUpdate({
            ...notificationData,
            // estimatedDelivery: item.estimatedDelivery
          });
        } catch (emailError) {
          console.error('Failed to send customer notification:', emailError);
        }
      }

      // Send to vendor if not initiated by vendor
      if (item.vendor && role !== 'vendor') {
        try {
          const vendorEmail = new Email(
            item.vendor,
            null,
            process.env.FRONTEND_URL || 'https://hezmart.com',
            status
          );
          await vendorEmail.sendVendorOrderStatusUpdate({
            ...notificationData,
            customerName: item.order.user?.firstName || 'Customer'
          });
        } catch (emailError) {
          console.error('Failed to send vendor notification:', emailError);
        }
      }
    }

    // 6) Return updated item
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