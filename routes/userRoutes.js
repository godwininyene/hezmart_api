const express = require('express');
const authController = require('./../controllers/authController');
const userController = require('./../controllers/userController');
const { uploadBusinessLogo } = require('../utils/multerConfig');
const router = express.Router();

router.post(
    '/signup',
    uploadBusinessLogo,
    authController.signup
);
router.route('/verify_email').post(authController.verifyEmail);
router.route('/resend_verification').post(authController.resendVerificationEmail);
router.post('/login', authController.login)
router.get('/logout', authController.logout)
router.post('/forgotPassword', authController.forgotPassword)
router.route('/resetPassword/:token').patch(authController.resetPassword);

router.get('/', userController.getAllUsers)
router.get('/:id', userController.getUser)
//Protect all the routes below
router.use(authController.protect)

router.patch('/:id/status', authController.restrictTo('admin'), userController.updateStatus)



module.exports = router;