const { Order, OrderItem, Product, Cart, User, CartItem, Coupon, ShippingStateFee, ShippingSetting, PickupLocation,PaymentOption } = require('../models');
const Email = require('./email');
const AppError = require('./appError');

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

exports.prepareOrderData = async (req, body) => {
    
    
  const userId = req.user.id
  const { 
    deliveryAddress, 
    paymentMethod = 'card', 
    deliveryOption,
    selectedStateId,
    pickupStationId,
    cryptoWalletId
  } = body;

  // Get cart and validate
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
    throw new AppError('Your cart is empty', 400);
  }

  // Calculate delivery fee based on delivery option
  let deliveryFee = 0;
  let stateFee = 0;
  let pickupStationDetails = null;
  let stateFeeDetails = null;
  let walletDetails = null;
  let stateFeeData = null;

  if(deliveryOption === 'door' && !selectedStateId){
    throw new AppError('Missing field (selectedStateId) for door delivery','', 400);
  }

  if(deliveryOption === 'pickup' && !pickupStationId){
    throw new AppError('Missing field (pickupStationId) for pickup delivery', '', 400);
  }

  if(paymentMethod === 'crypto' && !cryptoWalletId){
    throw new AppError('Missing field (cryptoWalletId) for crypto payment method', '', 400);
  }

  if (deliveryOption === 'door') {
    stateFeeData = await ShippingStateFee.findByPk(selectedStateId, {
      attributes: ['fee', 'state']
    });
    
    if (!stateFeeData) {
      throw new AppError('Delivery not available for selected state', '', 400);
    }
     stateFeeDetails = {
      state: stateFeeData.state,
      fee: stateFeeData.fee,
    };
    
    stateFee = parseFloat(stateFeeData.fee);
    deliveryFee = stateFee;
  } 
  else if (deliveryOption === 'pickup') {
    const station = await PickupLocation.findByPk(pickupStationId, {
      attributes: ['name','fee', 'state', 'address', 'contactPhone']
    });
    if (!station) {
      throw new AppError('Selected pickup station not found','', 400);
    }
    
    pickupStationDetails = {
      name: station.name,
      state: station.state,
      address: station.address,
      fee: station.fee,
      contactPhone: station.contactPhone
    };
    deliveryFee = parseFloat(station.fee);
  }

  if(paymentMethod === 'crypto'){
    const wallet = await PaymentOption.findByPk(cryptoWalletId, {
      attributes: ['networkName', 'walletAddress', 'barcode']
    });
    if(!wallet){
      throw new AppError('Selected wallet not found','', 400);
    }
    walletDetails = {
      name: wallet.networkName,
      address: wallet.walletAddress,
      barcode: wallet.barcode
    };
  }

  // Calculate cart totals
  const calculations = calculateCartTotals(cart.items);
  const couponDiscount = cart.discountAmount || 0;
  calculations.discount += parseFloat(couponDiscount);

  if (calculations.unavailableItems.length > 0) {
    throw new AppError(
      'Some items in your cart are not available in the requested quantities',
      400,
      { unavailableItems: calculations.unavailableItems }
    );
  }

  const shippingSetting = await ShippingSetting.findOne({where: { isActive: true },});
  const {minShippingEnabled, shippingMinAmount} = shippingSetting;

  const orderTotal = parseFloat(calculations.subtotal - calculations.discount);

  if (minShippingEnabled && orderTotal < shippingMinAmount) {
    
    throw new AppError(`Orders with a total under ₦${shippingMinAmount.toLocaleString()} will not be shipped`, '', 400);
  }

  // Calculate final total
  const total = calculations.subtotal - calculations.discount + deliveryFee;
  const orderNumber = await Order.generateOrderNumber();

  return {
    cart,
    orderData: {
      userId,
      orderNumber,
      subtotal: calculations.subtotal,
      discount: calculations.discount,
      couponId: cart.couponId,
      couponCode: cart.coupon?.code,
      deliveryFee,
      total,
      paymentMethod,
      deliveryOption,
      deliveryAddress,
      state: deliveryOption === 'door' ? stateFeeData.state : null,
      stateFeeDetails: deliveryOption === 'door' ? stateFeeDetails : null,
      pickupStationDetails: deliveryOption === 'pickup' ? pickupStationDetails : null,
      walletDetails: paymentMethod === 'crypto' ? walletDetails : null,
      items: cart.items.map(item => ({
        productId: item.productId,
        name: item.product.name,
        vendorId: item.product.userId,
        quantity: item.quantity,
        price: item.product.price,
        discountPrice: item.product.discountPrice,
        selectedOptions: item.selectedOptions || {}
      })),
      customer: {
        email: req.user.email,
        name: `${req.user.firstName} ${req.user.lastName}`,
        phone: req.user.primaryPhone || ''
      }
    }
  };
};

exports.processOrderCreation = async (orderData, paymentDetails = {}) => {
  // Create the order record
  const order = await Order.create({
    userId: orderData.userId,
    orderNumber: orderData.orderNumber,
    status: 'processing',
    subtotal: orderData.subtotal,
    discount: orderData.discount,
    couponId: orderData.couponId,
    couponCode: orderData.couponCode,
    deliveryFee: orderData.deliveryFee,
    deliveryOption:orderData.deliveryOption,
    tax: 0,
    total: orderData.total,
    paymentMethod: orderData.paymentMethod,
    paymentStatus: paymentDetails.status || 'pending',
    deliveryAddress: orderData.deliveryAddress,
    stateFeeDetails: orderData.stateFeeDetails,
    pickupStationDetails: orderData.pickupStationDetails,
    walletDetails: orderData.walletDetails
  });

  // Create order items
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

  // Update stock quantities
  await Promise.all(orderData.items.map(item => 
    Product.decrement('stockQuantity', {
      by: item.quantity,
      where: { id: item.productId },
    })
  ));

  return order;
};

exports.sendOrderNotifications = async (order, orderData) => {
  // Prepare and send vendor notifications
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

  // Send vendor notifications
  await Promise.all(vendors.map(async vendor => {
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
        orderId: order.id
      });
    } catch (emailError) {
      console.error(`Failed to send email to vendor ${vendor.email}:`, emailError);
    }
  }));

  // Send customer order confirmation
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
        paymentMethod: orderData.paymentMethod.charAt(0).toUpperCase() + orderData.paymentMethod.slice(1),
        shippingAddress: {
          name: orderData.customer.name,
          primaryPhone: orderData.deliveryAddress.primaryPhone,
          primaryAddress: orderData.deliveryAddress.primaryAddress,
          state: orderData.deliveryAddress.state,
          email:orderData.deliveryAddress.email
        },
        items: customerItems,
        orderTotal: order.total,
        subtotal:order.subtotal,
        discount:orderData.discount,
        supportPhone: process.env.SUPPORT_PHONE || '+234 916 000 2490',
        deliveryOption: orderData.deliveryOption,
        stateFeeDetails: orderData.stateFeeDetails,
        pickupStationDetails: orderData.pickupStationDetails
      });
    }
  } catch (customerEmailError) {
    console.error('Failed to send order confirmation to customer:', customerEmailError);
  }

  // Send admin notification
  try {
    const admin = {
      firstName: 'Hezmart Admin',
      email: 'hezmartng@gmail.com'
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
};