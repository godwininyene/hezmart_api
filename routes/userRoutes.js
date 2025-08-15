const express = require('express');
const authController = require('./../controllers/authController');
const userController = require('./../controllers/userController');
const { uploadBusinessLogo } = require('../utils/multerConfig');
const { uploadUserPhoto } = require('../utils/multerConfig');
const likeRouter = require('./likeRoutes'); 
const router = express.Router();

// Authentication routes
router.post('/signup', uploadBusinessLogo, authController.signup);
router.post('/login', authController.login);
router.get('/logout', authController.logout);
router.post('/forgotPassword', authController.forgotPassword);
router.patch('/resetPassword/:token', authController.resetPassword);
router.post('/auth/google', authController.googleAuth);

// Email verification
router.route('/verify_email').post(authController.verifyEmail);
router.route('/resend_verification').post(authController.resendVerificationEmail);

//Non protected routes;sss
router.get('/', userController.getAllUsers);


// Protected routes (require authentication)
router.use(authController.protect);

router.patch('/updateMyPassword', authController.updatePassword);
router.get('/me', userController.getMe, userController.getUser);
router.patch('/updateMe', uploadUserPhoto, userController.updateMe);
router.delete('/deleteMe', userController.deleteMe);
router.get('/:id', userController.getUser);

// Admin restricted routes
router.patch('/:id/status', authController.restrictTo('admin'), userController.updateStatus);

// Add likes nested route for users
router.use('/likes', likeRouter);

module.exports = router;