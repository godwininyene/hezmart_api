const nodemailer = require('nodemailer');
const pug = require('pug');

const SUBJECTS = {
  welcome: 'Welcome to the family',
  status: 'Your Hezmart user account status',
  passwordReset: 'Your password reset token (valid for only 15 minutes)',
  emailVerification: 'Your email verification code (Valid for 15 minutes)',
  vendorOrderNotification: '🛍 New Order Received!',
  customerOrderConfirmation: '✅ Order Confirmation – Order #{orderNumber}',
  adminOrderNotification: '🚨 New Order Placed - Requires Admin Review',
  productStatus: {
    approved_product: '🎉 Congratulations! Your Product Listing is Approved',
    declined_product: '❗ Update: Your Product Listing Was Declined',
    suspended_product: '⚠️ Important: Your Product Listing Has Been Suspended',
    default: 'Your Hezmart Product Listing Status'
  },
  orderStatus: {
    pending: '🔄 Your Order is Being Processed',
    processing: '🛠 Your Order is Being Prepared',
    shipped: '🚚 Your Order Has Shipped!',
    delivered: '🎉 Your Order Has Been Delivered!',
    cancelled: '❌ Your Order Has Been Cancelled',
    default: 'Your Order Status Update'
  },
  vendorOrderStatus: {
    pending: '🔄 New Order Item Requires Attention',
    processing: '⏳ Order Item is Being Processed',
    shipped: '📦 Order Item Shipped Successfully',
    delivered: '✅ Order Item Delivered to Customer',
    cancelled: '❌ Order Item Cancelled',
    default: 'Order Item Status Update'
  }
};

module.exports = class Email {
  constructor(user, emailVerificationCode, url, type) {
    this.email = user.email;
    this.userType = user.role;
    this.firstName = user.firstName;
    this.emailVerificationCode = emailVerificationCode;
    this.url = url;
    this.type = type;
    this.from = `Hezmart <${process.env.EMAIL_FROM}>`;
  }

  newTransport() {
    // if (process.env.NODE_ENV === 'production') {
    //   return nodemailer.createTransport({
    //     host: process.env.EMAIL_HOST,
    //     // port: process.env.EMAIL_PORT,
    //     // secure: true,
    //      port: 465,              
    //      secure: false,          // false means STARTTLS will be us
    //     auth: {
    //       user: process.env.EMAIL_USER,
    //       pass: process.env.EMAIL_PASSWORD
    //     }
    //   });
    // }
   
    if (process.env.NODE_ENV === 'production') {
      return nodemailer.createTransport({
        service: 'Gmail',
        auth: {
          user: process.env.GMAIL_USERNAME,
          pass: process.env.GMAIL_PASS
        }
      });
    }
   
    // return nodemailer.createTransport({
    //   host: process.env.EMAIL_HOST,
    //   port: process.env.EMAIL_PORT,
    //   auth: {
    //     user: process.env.EMAIL_USERNAME,
    //     pass: process.env.EMAIL_PASSWORD
    //   }
    // });
  }

  async renderAndSend(template, subject, templateData = {}) {
    const html = pug.renderFile(`${__dirname}/../views/email/${template}.pug`, {
      firstName: this.firstName,
      userType: this.userType,
      emailVerificationCode: this.emailVerificationCode,
      url: this.url,
      type: this.type,
      subject,
      ...templateData
    });

    const mailOptions = {
      from: this.from,
      to: this.email,
      subject,
      html,
    };

    await this.newTransport().sendMail(mailOptions);
  }

  async sendTemplate(templateName, templateData = {}) {
    let subject;

    if (templateData.subject) {
      subject = templateData.subject;
    } else if (templateName === 'productStatus') {
      subject = SUBJECTS.productStatus[this.type] || SUBJECTS.productStatus.default;
    } else if (templateName === 'orderConfirmation') {
      subject = SUBJECTS.customerOrderConfirmation.replace('#{orderNumber}', templateData.orderNumber);
    } else {
      subject = SUBJECTS[templateName];
    }

    await this.renderAndSend(templateName, subject, templateData);
  }

  async sendOnBoard() {
    await this.sendTemplate('welcome');
  }

  async sendStatus() {
    await this.sendTemplate('status');
  }

  async sendPasswordReset() {
    await this.sendTemplate('passwordReset');
  }

  async sendVerificationEmail() {
    await this.sendTemplate('emailVerification');
  }

  async sendProductStatus() {
    await this.sendTemplate('productStatus');
  }

  async sendOrderStatusUpdate(orderData) {
    await this.sendTemplate('orderStatus', {
      subject: SUBJECTS.orderStatus[this.type] || SUBJECTS.orderStatus.default,
      ...orderData
    });
  }

  async sendVendorOrderStatusUpdate(orderData) {
    await this.sendTemplate('vendorOrderStatus', {
      subject: SUBJECTS.vendorOrderStatus[this.type] || SUBJECTS.vendorOrderStatus.default,
      ...orderData
    });
  }

  async sendVendorOrderNotification(templateData) {
    await this.sendTemplate('vendorOrderNotification', templateData);
  }

  async sendCustomerOrderConfirmation(orderData) {
    await this.sendTemplate('customerOderNotification', orderData);
  }

  async sendAdminOrderNotification(orderData) {
    await this.sendTemplate('adminOrderNotification', orderData);
  }
};