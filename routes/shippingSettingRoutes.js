const express = require('express');
const shippingController = require('../controllers/shippingController');
const authController = require('../controllers/authController'); 

const router = express.Router()

router.get('/active', shippingController.getActiveSettings);
router.get('/all',authController.protect, authController.restrictTo('admin'), shippingController.getAllSettings);
router.post('/', authController.protect,authController.restrictTo('admin'), shippingController.updateSettings);
router.route('/state-fees')
    .post(authController.protect,
        authController.restrictTo('admin'),
        shippingController.createStateFees
    )
    .get(shippingController.getStateFees)
router.delete('/state-fees/:id', 
    authController.protect,
    authController.restrictTo('admin'),
    shippingController.deleteStateFee
)


router.delete('/pickup-locations/:id', 
    authController.protect,
    authController.restrictTo('admin'),
    shippingController.deletePickupLocation
)
   
router.route('/pickup-locations')
    .post(authController.protect, authController.restrictTo('admin'), shippingController.createPickupStation)
    .get(shippingController.getPickupLocations)

module.exports=router;