const express = require('express');
const authController = require('./../controllers/authController');
const userController = require('./../controllers/userController');
const { uploadBusinessLogo } = require('../utils/multerConfig');
const {uploadUserPhoto } = require('../utils/multerConfig');
const likeRouter = require('./likeRoutes'); 
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
router.patch('/updateMyPassword',authController.protect, authController.updatePassword);

router.post('/auth/google', authController.googleAuth);
// router.post('/auth/apple', authController.appleAuth);


// router.get('/auth/google', authController.googleAuth);
// router.get('/auth/google/callback', authController.googleAuthCallback);

// // Apple OAuth routes
// router.get('/auth/apple', authController.appleAuth);
// router.post('/auth/apple/callback', authController.appleAuthCallback);

router.get('/', userController.getAllUsers)
router.route('/me').get(authController.protect,userController.getMe, userController.getUser);
router.get('/:id', userController.getUser)

router
.patch('/updateMe',
    authController.protect,
    uploadUserPhoto, 
    userController.updateMe
);

router.patch('/:id/status',authController.protect, authController.restrictTo('admin'), userController.updateStatus)

// Add likes nested route for users
router.use('/likes', likeRouter);



module.exports = router;