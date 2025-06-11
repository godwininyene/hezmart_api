const catchAsync = require("../utils/catchAsync");
const { Cart, CartItem, Product, Order, OrderItem } = require('../models');
const AppError = require("../utils/appError");

//Previous one
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

//Last working one;
// Get Paystack checkout session
exports.getCheckoutSession = catchAsync(async (req, res, next) => {
  // 1) Get cart from database
  const userId = req.user.id;
  const { deliveryAddress, paymentMethod='card', shippingOptionId } = req.body;

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
      quantity: item.quantity,
      price: item.product.price,
      discountPrice: item.product.discountPrice,
      selectedOptions: item.selectedOptions || []
    })
  ));

  // 7) Prepare Paystack payload
  const payload = {
    email: req.user.email,
    amount: total * 100, // Paystack uses kobo (multiply by 100)
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

  // 8) Call Paystack API
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
     // Clear the cart
    if(response.data.status){
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
    // If Paystack fails, mark order as failed
    await order.update({ status: 'failed' });
    throw error;
  }
});

// Get Paystack checkout session (Not working)
exports.getCheckoutSession = catchAsync(async (req, res, next) => {
  // 1) Get cart from database
  const userId = req.user.id;
  const { deliveryAddress, paymentMethod = 'card', shippingOptionId } = req.body;

  // Retrieve cart with items and products
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
    return next(new AppError('Your cart is empty', '', 400));
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
  
  let order;
  const transaction = await sequelize.transaction({
    isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED,
    autocommit: false
  });

  try {
    // 6) Create pending order record
    order = await Order.create({
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
    }, { transaction });

    // Optimized: Create all order items in bulk
    const orderItemsData = cart.items.map(item => ({
      orderId: order.id,
      productId: item.productId,
      vendorId: item.product.userId,
      quantity: item.quantity,
      price: item.product.price,
      discountPrice: item.product.discountPrice,
      selectedOptions: item.selectedOptions || []
    }));

    await OrderItem.bulkCreate(orderItemsData, { transaction });

    // Process stock updates in batches
    const BATCH_SIZE = 5;
    for (let i = 0; i < cart.items.length; i += BATCH_SIZE) {
      const batch = cart.items.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(item => 
        Product.decrement('stockQuantity', {
          by: item.quantity,
          where: { id: item.productId },
          transaction
        })
      ));
    }

    // Commit transaction before external calls
    await transaction.commit();

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
      vendorOrdersMap.get(vendorId).items.push(item);
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
            items: vendorItems.map(item => ({
              name: item.product.name,
              quantity: item.quantity,
              price: item.product.discountPrice || item.product.price,
              total: (item.product.discountPrice || item.product.price) * item.quantity
            })),
            customerName: `${req.user.firstName} ${req.user.lastName}`
          });
        } catch (emailError) {
          console.error(`Failed to send email to vendor ${vendor.email}:`, emailError);
        }
      })
    );

    // 7) Prepare Paystack payload
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

    // 8) Call Paystack API
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
          timeout: 10000 // 10 second timeout
        }
      }
    );

    // Create payment record in separate short transaction
    await sequelize.transaction(async (paymentTransaction) => {
      await Payment.create({
        orderId: order.id,
        amount: total,
        status: 'initiated',
        method: paymentMethod,
        reference: orderNumber,
        fees: 0
      }, { transaction: paymentTransaction });
    });

    // Clear cart if successful
    if (response.data.status) {
      await Cart.destroy({ where: { userId } });
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
    // Rollback transaction if it wasn't committed
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    // Update order status if order was created
    if (order) {
      await order.update({ status: 'failed' });
    }

    next(error);
  }
});

// Separate function for vendor notifications
async function processVendorNotifications(vendorOrdersMap, orderNumber, user, orderTotal) {
  // Get vendor details in single query
  const vendorIds = Array.from(vendorOrdersMap.keys());
  const vendors = await User.findAll({
    where: { id: vendorIds },
    attributes: ['id', 'email', 'firstName']
  });

  const vendorMap = new Map(vendors.map(v => [v.id, v]));

  await Promise.all(
    Array.from(vendorOrdersMap.entries()).map(async ([vendorId, { items }]) => {
      const vendor = vendorMap.get(vendorId);
      if (!vendor) return;

      try {
        const vendorOrderTotal = items.reduce((sum, item) => {
          return sum + (item.product.discountPrice || item.product.price) * item.quantity;
        }, 0);

        await new Email(
          vendor,
          null,
          `${process.env.FRONTEND_URL}/vendor/orders`,
          'new_order'
        ).sendVendorOrderNotification({
          subject: `🎉 New Order Received (${orderNumber})`,
          orderNumber,
          orderTotal: vendorOrderTotal,
          items: items.map(item => ({
            name: item.product.name,
            quantity: item.quantity,
            price: item.product.discountPrice || item.product.price,
            total: (item.product.discountPrice || item.product.price) * item.quantity
          })),
          customerName: `${user.firstName} ${user.lastName}`
        });
      } catch (emailError) {
        console.error(`Failed to send email to vendor ${vendor.email}:`, emailError);
      }
    })
  );
}



exports.handleFlutterwaveWebhook = catchAsync(async(req, res, next)=>{
    
})



//Below are working;
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
    return next(new AppError('Your cart is empty', '', 400));
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
  const orderNumber = await Order.generateOrderNumber();

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
      deliveryAddress,
    });

    //7 Create order items
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

    //8) Process stock updates in batches
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

        // Calculate total for each item
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
          Authorization: `Bearer sk_test_e0753309f4e282a44c1b076b5d0c5c252ced1f36`,
          'Content-Type': 'application/json'
        }
      });
    } catch (err) {
      console.error('Failed to create Paystack customer:', err.response?.data || err.message);
    }

    // 10) Prepare Paystack payload
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

    // 11) Call Paystack API
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

      // 12) Clear the cart if transaction was initialized successfully
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

I have the above in my orderController,considering the new fields that got added to the cart model, will I have to make any changes here?