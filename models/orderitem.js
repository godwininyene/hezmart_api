'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class OrderItem extends Model {
    static associate(models) {
      // define association here
      OrderItem.belongsTo(models.Order, {
        foreignKey: 'orderId',
        as: 'order'
      });
      
      OrderItem.belongsTo(models.Product, {
        foreignKey: 'productId',
        as: 'product'
      });

      OrderItem.belongsTo(models.User, {
        foreignKey: 'vendorId',
        as: 'vendor'
      });
    }

    getTotalPrice() {
      return (this.discountPrice || this.price) * this.quantity;
    }
    isValidStatusTransition(newStatus) {
      const validTransitions = {
        pending: ['processing'],
        processing: ['shipped', 'cancelled'],
        shipped: ['delivered', 'cancelled'],
        delivered: ['received', 'returned'],
        received: ['returned'], // Allow returns after receiving
        cancelled: [], // Once cancelled, no further changes
        returned: [] // Once returned, no further changes
      };
      // Special case: admin should be able to cancel/return even after delivery/receipt
      if (['cancelled', 'returned'].includes(newStatus)) {
        return true;
      }
      return validTransitions[this.fulfillmentStatus]?.includes(newStatus);
    }
    async updateStatus(newStatus, options = {}) {
      if (!this.isValidStatusTransition(newStatus)) {
        throw new Error(`Invalid status transition from ${this.fulfillmentStatus} to ${newStatus}`);
      }

      const updateData = { fulfillmentStatus: newStatus };

      if (newStatus === 'shipped' && !this.shippedAt) {
        updateData.shippedAt = new Date();
      } else if (newStatus === 'delivered' && !this.deliveredAt) {
        updateData.deliveredAt = new Date();
      } else if (newStatus === 'received' && !this.receivedAt) {
        console.log('Running here');
        updateData.receivedAt = new Date();
      }

      // Merge extra fields from caller (e.g., vendorNotes or customerNotes)
      Object.assign(updateData, options);

      return this.update(updateData);
    }

  
  }
  OrderItem.init({
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: { msg: 'Order ID is required' },
        isInt: { msg: 'Order ID must be an integer' }
      },
      references: {
        model: 'Orders',
        key: 'id'
      }
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: { msg: 'Product ID is required' },
        isInt: { msg: 'Product ID must be an integer' }
      },
      references: {
        model: 'Products',
        key: 'id'
      }
    },
    vendorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: { msg: 'Vendor ID is required' },
        isInt: { msg: 'Vendor ID must be an integer' }
      },
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: { msg: 'Quantity is required' },
        isInt: { msg: 'Quantity must be an integer' },
        min: {
          args: [1],
          msg: 'Quantity must be at least 1'
        }
      }
    },
    price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        notNull: { msg: 'Price is required' },
        min: {
          args: [0],
          msg: 'Price cannot be negative'
        }
      }
    },
    discountPrice: {
      type: DataTypes.DECIMAL(12, 2),
      validate: {
        min: {
          args: [0],
          msg: 'Discount price cannot be negative'
        },
        lessThanPrice(value) {
          if (value && parseFloat(value) >= parseFloat(this.price)) {
            throw new Error('Discount price must be less than regular price');
          }
        }
      }
    },
    selectedOptions: {
      type: DataTypes.TEXT,
      defaultValue: '{}',
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('selectedOptions');
        return rawValue ? JSON.parse(rawValue) : {};
      },
      set(value) {
        this.setDataValue('selectedOptions', JSON.stringify(value || {}));
      }
    },
   
    fulfillmentStatus: {
      type: DataTypes.ENUM('pending', 'processing', 'shipped', 'delivered', 'received', 'cancelled', 'returned'),
      defaultValue: 'pending',
      validate: {
        isIn: {
          args: [['pending', 'processing', 'shipped', 'delivered', 'received', 'cancelled', 'returned']],
          msg: 'Invalid fulfillment status'
        }
      }
    },
    shippedAt: {
      type: DataTypes.DATE,
      validate: {
        isDate: { msg: 'Shipped date must be a valid date' }
      }
    },
    deliveredAt: {
      type: DataTypes.DATE,
      validate: {
        isDate: { msg: 'Delivered date must be a valid date' }
      }
    },
    receivedAt: {
      type: DataTypes.DATE,
      validate: {
        isDate: { msg: 'Received date must be a valid date' }
      }
    },
    trackingNumber: {
      type: DataTypes.STRING,
      validate: {
        len: {
          args: [0, 50],
          msg: 'Tracking number cannot exceed 50 characters'
        }
      }
    },
    vendorNotes: {
      type: DataTypes.TEXT,
      validate: {
        len: {
          args: [0, 500],
          msg: 'Vendor notes cannot exceed 500 characters'
        }
      }
    },
    customerNotes: {
      type: DataTypes.TEXT,
      validate: {
        len: {
          args: [0, 500],
          msg: 'Customer notes cannot exceed 500 characters'
        }
      }
    },
    cancellationReason: {
      type: DataTypes.TEXT,
      validate: {
        len: {
          args: [0, 500],
          msg: 'Cancellation reason cannot exceed 500 characters'
        }
      }
    },
    returnReason: {
      type: DataTypes.TEXT,
      validate: {
        len: {
          args: [0, 500],
          msg: 'Return reason cannot exceed 500 characters'
        }
      }
    }
  }, {
    sequelize,
    modelName: 'OrderItem',
    hooks:{
      beforeCreate: async (orderItem) => {
        if (orderItem.discountPrice === undefined || orderItem.discountPrice === 0) {
          orderItem.discountPrice = null;
        }
      },
      afterUpdate: async (orderItem) => {
        if (orderItem.changed('fulfillmentStatus')) {
          const order = await orderItem.getOrder();
          const newOrderStatus = await order.calculateOrderStatus();
          await order.update({ status: newOrderStatus });
        }
      }
    }
  });
  return OrderItem;
};