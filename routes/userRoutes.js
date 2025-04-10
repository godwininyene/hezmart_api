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


module.exports = router;