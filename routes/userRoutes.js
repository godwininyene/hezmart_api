const express = require('express');
const authController = require('./../controllers/authController');
const { uploadBusinessLogo } = require('../utils/multerConfig');
const router = express.Router();

router.post(
    '/signup',
    uploadBusinessLogo,
    authController.signup
);
router.route('/verify_email').post(authController.verifyEmail);
router.post('/login', authController.login)
router.get('/logout', authController.logout)
router.post('/forgotPassword', authController.forgotPassword)
router.route('/resetPassword/:token').patch(authController.resetPassword);


module.exports = router;