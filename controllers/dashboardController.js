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
      // Top Products by units sold
      OrderItem.findAll({
        attributes: [
          'productId',
          [fn('SUM', col('quantity')), 'unitsSold'],
          [fn('SUM', literal('(COALESCE("discountPrice", "price") * "quantity")')), 'revenue']
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
          unitsSold: item.unitsSold,
          revenue: item.revenue,
          coverImage: item.product.coverImage
        })),
        hourlySales: hourlySales.map(hour => ({
          hour: hour.hour,
          amount: hour.amount,
          orders: hour.orders
        })),
        dailySales: dailySales.map(day => ({
          date: day.date,
          amount: day.amount,
          orders: day.orders
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
      OrderItem.findOne({
        attributes: [
          [
            sequelize.fn(
              'COALESCE',
              sequelize.fn('SUM', sequelize.literal('COALESCE(discountPrice, price) * quantity')),
              0
            ),
            'totalRevenue'
          ]
        ],
        where: { vendorId: user.id },
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
      // Top Products for vendor
      OrderItem.findAll({
        attributes: [
          'productId',
          [fn('SUM', col('quantity')), 'unitsSold'],
          [fn('SUM', literal('(COALESCE("discountPrice", "price") * "quantity")')), 'revenue']
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
      // Hourly sales for vendor (last 12 hours)
      Order.findAll({
        attributes: [
          [fn('HOUR', col('Order.createdAt')), 'hour'],
          [fn('COUNT', col('Order.id')), 'orders'],
          [
            fn(
              'SUM',
              literal('IFNULL(`items`.`discountPrice`, `items`.`price`) * `items`.`quantity`')
            ),
            'amount'
          ]
        ],
        include: [
          {
            model: OrderItem,
            as: 'items',
            attributes: [],
            where: { vendorId: user.id }
          }
        ],
        where: {
          createdAt: {
            [Op.gte]: new Date(Date.now() - 12 * 60 * 60 * 1000)
          }
        },
        group: [fn('HOUR', col('Order.createdAt'))],
        order: [[fn('HOUR', col('Order.createdAt')), 'ASC']],
        raw: true
      }),
      // Daily sales for vendor (last 7 days)
      Order.findAll({
        attributes: [
          [fn('DATE', col('Order.createdAt')), 'date'],
          [
            fn('SUM',
              literal('IFNULL(`items`.`discountPrice`, `items`.`price`) * `items`.`quantity`')
            ),
            'amount'
          ],
          [fn('COUNT', col('Order.id')), 'orders']
        ],
        include: [{
          model: OrderItem,
          attributes: [],
          as: 'items',
          where: {
            vendorId: user.id
          }
        }],
        where: {
          createdAt: { [Op.gte]: startOfWeek }
        },
        group: [fn('DATE', col('Order.createdAt'))],
        order: [[fn('DATE', col('Order.createdAt')), 'ASC']],
        raw: true
      })
    ]);

    const totalRevenue = totalRevenueObj ? totalRevenueObj.totalRevenue : 0;

    return res.json({
      success: true,
      data: {
        totalRevenue: parseFloat(totalRevenue || 0).toFixed(2),
        totalOrders,
        recentOrders: recentOrders.map(order => ({
          id: order.id,
          name: `${order.user?.firstName} ${order.user?.lastName}`.trim() || 'Guest',
          date: order.createdAt.toISOString().split('T')[0],
          amount: order.items.reduce((sum, item) => sum + (item.discountPrice || item.price) * item.quantity, 0),
          status: order.status
        })),
        topProducts: topProducts.map(item => ({
          id: item.productId,
          name: item.product?.name,
          price: item.product?.price,
          unitsSold: item.unitsSold,
          revenue: item.revenue,
          coverImage: item.product.coverImage
        })),
        hourlySales: hourlySales.map(hour => ({
          hour: hour.hour,
          amount: hour.amount,
          orders: hour.orders
        })),
        dailySales: dailySales.map(day => ({
          date: day.date,
          amount: day.amount,
          orders: day.orders
        }))
      }
    });
  }
});
