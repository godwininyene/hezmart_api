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