const catchAsync = require("../utils/catchAsync");
const { ShippingSetting, ShippingStateFee, PickupLocation } = require('../models');
const AppError = require('../utils/appError');

// Get active shipping settings
exports.getActiveSettings = catchAsync(async (req, res, next) => {
  const settings = await ShippingSetting.getActiveSettings();

  if (!settings) {
    return next(new AppError('No active shipping settings found','', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      settings
    }
  });
});

// Create or update shipping settings
exports.updateSettings = catchAsync(async (req, res, next) => {
  // Find existing active settings
  const currentSettings = await ShippingSetting.findOne({
    where: { isActive: true }
  });

  let settings;
  
  if (currentSettings) {
    // Deactivate current settings
    await currentSettings.update({ isActive: false });
    
    // Create new settings
    settings = await ShippingSetting.create({
      ...req.body,
      updatedBy: req.user.id,
      isActive: true
    });
  } else {
    // Create first settings
    settings = await ShippingSetting.create({
      ...req.body,
      updatedBy: req.user.id,
      isActive: true
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      settings
    }
  });
});

// Manage state fees
exports.createStateFees = catchAsync(async (req, res, next) => {
  const stateFee = await ShippingStateFee.create(req.body)
  res.status(200).json({
    status: 'success',
    data: {
      stateFee
    }
  });
});

exports.getStateFees = catchAsync(async(req, res, next)=>{
  const stateFees = await ShippingStateFee.findAll()
  res.status(200).json({
    status: 'success',
    data: {
      stateFees
    }
  });
})

exports.deleteStateFee = catchAsync(async(req, res, next)=>{
  const stateFee = await ShippingStateFee.findByPk(req.params.id);
  if (!stateFee) {
    return next(new AppError("No state fee found with that ID", "", 404));
  }

  await stateFee.destroy();

  res.status(204).json({
    data: null
  });
})

// Manage pickup locations
exports.createPickupStation = catchAsync(async (req, res, next) => {
  const pickupStation = await PickupLocation.create(req.body)
  res.status(200).json({
    status: 'success',
    data: {
      pickupStation
    }
  });
});
exports.getPickupLocations = catchAsync(async (req, res, next) => {
  let filter = {};
  if (req.query.state) {
    filter.where = {
      state: req.query.state
    };
  }
  const pickupLocations = await PickupLocation.findAll(filter);
  res.status(200).json({
    status: 'success',
    data: {
      pickupLocations
    }
  });
});

exports.deletePickupLocation = catchAsync(async(req, res, next)=>{
  const pickupLocation = await PickupLocation.findByPk(req.params.id);
  if (!pickupLocation) {
    return next(new AppError("No pickup location found with that ID", "", 404));
  }

  await pickupLocation.destroy();
  res.status(204).json({
    data: null
  });
})

// Get all shipping settings (admin only)
exports.getAllSettings = catchAsync(async (req, res, next) => {
  const settings = await ShippingSetting.findAll();
  res.status(200).json({
    status: 'success',
    results: settings.length,
    data: {
      settings
    }
  });
});