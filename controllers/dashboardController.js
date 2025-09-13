const catchAsync = require("../utils/catchAsync");
const { Order, OrderItem, User, Product, sequelize } = require('../models');
const { Op, fn, col, literal } = require('sequelize');

exports.getDashboardStats = catchAsync(async (req, res) => {
  const user = req.user;
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const startOfWeek = new Date(today.setDate(today.getDate() - 7));
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Admin view
  if (user.role === 'admin') {
    const [
      totalRevenue,
      totalOrders,
      newUsers,
      activeUsers,
      recentOrders,
      topProducts,
      topCustomers,
      hourlySales,
      dailySales
    ] = await Promise.all([
      Order.sum('total'),
      Order.count(),
      User.count({
        where: {
          createdAt: {
            [Op.gte]: startOfMonth // past month
          },
          role: 'customer'
        }
      }),
      User.count({
        where: {
          status: 'active',
          role: 'customer'
        }
      }),
      // Recent Orders (last 5)
      Order.findAll({
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName']
        }],
        order: [['createdAt', 'DESC']],
        limit: 5
      }),
      // Top Products by units sold - FIXED
      OrderItem.findAll({
        attributes: [
          'productId',
          [fn('SUM', col('quantity')), 'unitsSold'],
          [
            fn('SUM', 
              literal('(COALESCE(NULLIF("discountPrice", 0), "price") * "quantity")')
            ), 
            'revenue'
          ]
        ],
        include: [{
          model: Product,
          as: 'product',
          attributes: ['name', 'price', 'coverImage']
        }],
        group: ['productId'],
        order: [[literal('"unitsSold"'), 'DESC']],
        limit: 5,
        raw: true,
        nest: true
      }),
      // Top Customers by total spending - FIXED
      Order.findAll({
        attributes: [
          'userId',
          [fn('SUM', col('Order.total')), 'totalSpent'],
          [fn('COUNT', col('Order.id')), 'ordersCount']
        ],
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email', 'photo']
        }],
        where: {
          userId: { [Op.ne]: null } // Exclude orders without users
        },
        group: ['userId'],
        order: [[literal('totalSpent'), 'DESC']],
        limit: 5,
        raw: true,
        nest: true
      }),
      // Hourly sales (last 12 hours)
      Order.findAll({
        attributes: [
          [fn('HOUR', col('createdAt')), 'hour'],
          [fn('SUM', col('total')), 'amount'],
          [fn('COUNT', col('id')), 'orders']
        ],
        where: {
          createdAt: {
            [Op.gte]: new Date(Date.now() - 12 * 60 * 60 * 1000)
          }
        },
        group: ['hour'],
        order: [[col('hour'), 'ASC']],
        raw: true
      }),
      // Daily sales (last 7 days)
      Order.findAll({
        attributes: [
          [fn('DATE', col('createdAt')), 'date'],
          [fn('SUM', col('total')), 'amount'],
          [fn('COUNT', col('id')), 'orders']
        ],
        where: {
          createdAt: { [Op.gte]: startOfWeek }
        },
        group: ['date'],
        order: [[col('date'), 'ASC']],
        raw: true
      })
    ]);

    return res.json({
      success: true,
      data: {
        totalRevenue: parseFloat(totalRevenue || 0).toFixed(2),
        totalOrders,
        newUsers,
        activeUsers,
        recentOrders: recentOrders.map(order => ({
          id: order.id,
          name: `${order.user?.firstName} ${order.user?.lastName}`.trim() || 'Guest',
          date: order.createdAt.toISOString().split('T')[0],
          amount: order.total,
          status: order.status
        })),
        topProducts: topProducts.map(item => ({
          id: item.productId,
          name: item.product?.name,
          price: item.product?.price,
          unitsSold: parseInt(item.unitsSold) || 0,
          revenue: parseFloat(item.revenue) || 0,
          coverImage: item.product?.coverImage
        })),
        topCustomers: topCustomers.map(customer => ({
          id: customer.user?.id,
          name: `${customer.user?.firstName} ${customer.user?.lastName}`.trim() || 'Unknown Customer',
          email: customer.user?.email,
          photo: customer.user?.photo,
          totalSpent: parseFloat(customer.totalSpent) || 0,
          ordersCount: parseInt(customer.ordersCount) || 0
        })),
        hourlySales: hourlySales.map(hour => ({
          hour: hour.hour,
          amount: parseFloat(hour.amount) || 0,
          orders: parseInt(hour.orders) || 0
        })),
        dailySales: dailySales.map(day => ({
          date: day.date,
          amount: parseFloat(day.amount) || 0,
          orders: parseInt(day.orders) || 0
        }))
      }
    });
  }

  // Vendor view
  if (user.role === 'vendor') {
    const [
      totalRevenueObj,
      totalOrders,
      recentOrders,
      topProducts,
      hourlySales,
      dailySales
    ] = await Promise.all([
      // Fixed total revenue calculation
      OrderItem.findOne({
        attributes: [
          [
            sequelize.fn(
              'SUM',
              sequelize.literal('(COALESCE(NULLIF(discountPrice, 0), price) * quantity)')
            ),
            'totalRevenue'
          ]
        ],
        where: { 
          vendorId: user.id,
          [Op.or]: [
            { discountPrice: { [Op.gt]: 0 } },
            { price: { [Op.gt]: 0 } }
          ]
        },
        raw: true
      }),
      
      OrderItem.count({
        where: { vendorId: user.id }
      }),
      
      // Recent Orders for vendor (last 5)
      Order.findAll({
        include: [{
          model: OrderItem,
          as: 'items',
          where: { vendorId: user.id },
          include: [{
            model: Product,
            as: 'product',
            attributes: ['name']
          }]
        }, {
          model: User,
          as: 'user',
          attributes: ['firstName', 'lastName']
        }],
        order: [['createdAt', 'DESC']],
        limit: 5
      }),
      
      // Top Products for vendor - FIXED
      OrderItem.findAll({
        attributes: [
          'productId',
          [fn('SUM', col('quantity')), 'unitsSold'],
          [
            fn('SUM', 
              literal('(COALESCE(NULLIF("discountPrice", 0), "price") * "quantity")')
            ), 
            'revenue'
          ]
        ],
        where: { vendorId: user.id },
        include: [{
          model: Product,
          as: 'product',
          attributes: ['name', 'price', 'coverImage']
        }],
        group: ['productId'],
        order: [[literal('"unitsSold"'), 'DESC']],
        limit: 5,
        raw: true,
        nest: true
      }),
      
      // Hourly sales for vendor (last 12 hours) - FIXED
      OrderItem.findAll({
        attributes: [
          [fn('HOUR', col('createdAt')), 'hour'],
          [fn('COUNT', col('id')), 'orders'],
          [
            fn('SUM',
              literal('(COALESCE(NULLIF(discountPrice, 0), price) * quantity)')
            ),
            'amount'
          ]
        ],
        where: { 
          vendorId: user.id,
          createdAt: {
            [Op.gte]: new Date(Date.now() - 12 * 60 * 60 * 1000)
          }
        },
        group: [fn('HOUR', col('createdAt'))],
        order: [[fn('HOUR', col('createdAt')), 'ASC']],
        raw: true
      }),
      
      // Daily sales for vendor (last 7 days) - FIXED
      OrderItem.findAll({
        attributes: [
          [fn('DATE', col('createdAt')), 'date'],
          [
            fn('SUM',
              literal('(COALESCE(NULLIF(discountPrice, 0), price) * quantity)')
            ),
            'amount'
          ],
          [fn('COUNT', col('id')), 'orders']
        ],
        where: {
          vendorId: user.id,
          createdAt: { [Op.gte]: startOfWeek }
        },
        group: [fn('DATE', col('createdAt'))],
        order: [[fn('DATE', col('createdAt')), 'ASC']],
        raw: true
      })
    ]);

    const totalRevenue = totalRevenueObj ? parseFloat(totalRevenueObj.totalRevenue || 0) : 0;

    return res.json({
      success: true,
      data: {
        totalRevenue: totalRevenue.toFixed(2),
        totalOrders,
        recentOrders: recentOrders.map(order => ({
          id: order.id,
          name: `${order.user?.firstName} ${order.user?.lastName}`.trim() || 'Guest',
          date: order.createdAt.toISOString().split('T')[0],
          amount: order.items.reduce((sum, item) => sum + (item.discountPrice && parseFloat(item.discountPrice) > 0 ? parseFloat(item.discountPrice) : parseFloat(item.price)) * item.quantity, 0),
          status: order.status
        })),
        topProducts: topProducts.map(item => ({
          id: item.productId,
          name: item.product?.name,
          price: item.product?.price,
          unitsSold: parseInt(item.unitsSold) || 0,
          revenue: parseFloat(item.revenue) || 0,
          coverImage: item.product?.coverImage
        })),
        hourlySales: hourlySales.map(hour => ({
          hour: hour.hour,
          amount: parseFloat(hour.amount) || 0,
          orders: parseInt(hour.orders) || 0
        })),
        dailySales: dailySales.map(day => ({
          date: day.date,
          amount: parseFloat(day.amount) || 0,
          orders: parseInt(day.orders) || 0
        }))
      }
    });
  }
});