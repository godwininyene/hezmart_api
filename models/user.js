'use strict';
const { Model } = require('sequelize');
const bcrypt = require('bcryptjs')
const crypto = require('crypto');
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      // associations goes here
      User.belongsTo(models.Category, {foreignKey: 'businessCategoryId', as:'category'})
    }

    async correctPassword(candidatePassword, userPassword){
      return await bcrypt.compare(candidatePassword, userPassword)
    }

    createEmailVerificationCode(){
      const code = crypto.randomInt(1000, 9999).toString();//4 Digit Code
      this.emailVerificationCode = code;
      this.emailVerificationExpires =  new Date(Date.now() + 15 * 60 * 1000) // Code valid for 15 minutes
      return code;
    }

    createPasswordResetToken = function(){
      const resetToken = crypto.randomBytes(32).toString('hex');
      this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      this.passwordResetExpires = Date.now() + 15 * 60 * 1000;// Code valid for 15 minutes
      return resetToken;
    }

    changedPasswordAfter(JWTtime){
      //User has change password
      if (this.passwordChangedAt) {
        const changeTimeStamp = new Date(this.passwordChangedAt).getTime() / 1000;
        return changeTimeStamp > JWTtime;
      }
      return false; // User has not changed password
    }
  }
  User.init({
    // Common fields for user  and vendor
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: 'Please provide your firstname' },
        notEmpty: { msg: 'firstname Cannot be empty' }
      }
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: 'Please provide your lastname' },
        notEmpty: { msg: 'lastname Cannot be empty' }
      }
    },
    email: {
      type:DataTypes.STRING,
      allowNull:false,
      validate: {
        notNull: { msg: 'Please provide your email address' },
        isEmail: { msg: 'Please provide a valid email address' }
      },
      unique:true
    },
    primaryPhone: {
      type: DataTypes.STRING,
      allowNull: true,
      unique:true,
      validate: {
        is: {
          args: /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/im,
          msg: 'Please provide a valid phone number'
        },
        notEmpty: { msg: 'Primary phone number cannot be empty' },
        localAuthRequired(value) {
          if (this.authProvider === 'local' && !value) {
            throw new Error('Please provide primary phone number');
          }
        }
      }
    },
    primaryAddress: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: 'Please provide primary address' },
        notEmpty: { msg: 'Primary address cannot be empty' }
      }
    },
    state: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: 'Please provide your state' },
        notEmpty: { msg: 'State cannot be empty' }
      }
    },
    photo:{
      type:DataTypes.STRING,
      defaultValue:`${process.env.APP_URL}/uploads/users/default.jpg`
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: 'Please provide your password' },
        notEmpty: { msg: 'Password Cannot be empty' },
        len: {
          args: [8, 100],
          msg: 'Password must be at least 8 characters long'
        }
      }
    },
    passwordConfirm: {
      type: DataTypes.VIRTUAL,
      allowNull: false, 
      validate: {
        notNull: { msg: 'Please confirm your password' },
        isMatch(value) {
          if (value !== this.password) {
            throw new Error('The password confirmation does not match');
          }
        }
      }
    },

    passwordChangedAt: {
      type: DataTypes.DATE
    },
    passwordResetToken:DataTypes.STRING,
    passwordResetExpires: {
      type: DataTypes.DATE
    },
    role: {
      type: DataTypes.ENUM('admin', 'vendor', 'customer'),
      allowNull: false,
      defaultValue: 'customer',
      validate: {
        isIn: {
          args: [['admin', 'vendor', 'customer']],
          msg: 'Invalid user role'
        },
        notAdminOnCreate() {
          if (this.isNewRecord && this.role === 'admin') {
            throw new Error('Cannot create admin users through signup');
          }
        }
      }
    },
    status: {
      type: DataTypes.ENUM('active', 'pending', 'denied', 'deactivated'),
      allowNull: false,
      defaultValue: this.role === 'admin' || this.role ==='customer' ? 'active' : 'pending',
      validate: {
        isIn: {
          args: [['active', 'pending', 'denied', 'deactivated']],
          msg: 'Invalid user status'
        }
      }
    },
    active:{
      type:DataTypes.BOOLEAN,
      defaultValue:true
    },
    emailVerificationCode: {
      type: DataTypes.STRING,
      allowNull: true
    },
    emailVerificationExpires: {
      type: DataTypes.DATE,
      allowNull: true
    },
    isEmailVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue:false
    },
    // Fields specific to vendor
    ninNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      unique:true,
      validate: {
        len: {
          args: [11, 11],
          msg: 'NIN number must be 11 digits'
        },
        vendorRequired(value) {
          if (this.role === 'vendor' && !value) {
            throw new Error('NIN number is required for vendors');
          }
        }
      }
    },
   
    businessName: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        vendorRequired(value) {
          if (this.role === 'vendor' && !value) {
            throw new Error('Please provide your business name');
          }
        }
      }
    },
    businessCategoryId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references:{
        model:"Categories",
        key:'id'
      },
      validate: {
        vendorRequired(value) {
          if (this.role === 'vendor' && !value) {
            throw new Error('Please provide business category.');
          }
        }
      }
    },
    businessLogo: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        vendorRequired(value) {
          if (this.role === 'vendor' && !value) {
            throw new Error('Business logo is required for vendors');
          }
        }
      }
    },
    // //For social auth
    authProvider: {
      type: DataTypes.ENUM('local', 'google', 'apple'),
      defaultValue: 'local'
    },
    // providerId: {
    //   type: DataTypes.STRING
    // }
  }, {
    sequelize,
    modelName: 'User',
    hooks:{
      beforeCreate: (user) => {
        // Set status to pending if user is a vendor
        if (user.role === 'vendor') {
          user.status = 'pending';
        }
        if (user.secondaryPhone === '') {
          user.secondaryPhone = null;
        }
      },
      beforeSave: async (user) => {
        // 1. Hash password if it's new or changed
        if (user.changed('password')) {
          user.password = await bcrypt.hash(user.password, 12);
          // // 2. Set passwordChangedAt only when updating existing users
          if (!user.isNewRecord) {
            user.passwordChangedAt = Date.now() - 1000;
          }
        }
        if (user.secondaryPhone === '') {
          user.secondaryPhone = null;
        }
      },
      afterCreate: async (user, options) => {
        const { Wallet } = sequelize.models;
        await Wallet.create({
          userId: user.id,
          balance: 0.00,
          currency: user.currency ? user.currency : 'NGN' // Default currency
        });
      }
    },
    // Exclude the following fields by default in queries
    defaultScope: {
      where: { active: true },
      attributes: { exclude: ['password', 'active'] }
    },
    // Custom scopes (e.g.,To include password in specific queries)
    scopes: {
      withPassword: {
        attributes: { include: ['password'] }
      }
    },
    });
  return User;
};