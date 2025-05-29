const express = require('express');
const authController = require('./../controllers/authController')
const dashboardController = require('./../controllers/dashboardController')


const router = express.Router();
//Protect all routes below
router.use(authController.protect, authController.restrictTo('admin', 'vendor'));
router.get('/stats', dashboardController.getDashboardStats);
module.exports = router;