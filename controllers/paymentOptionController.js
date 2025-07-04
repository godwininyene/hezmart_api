const{PaymentOption} = require('./../models')
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

exports.createPaymentOption = catchAsync(async(req, res, next)=>{ 
    const host = `${req.protocol}://${req.get('host')}`;

    if (req.file) {
        req.body.barcode = `${host}/uploads/walletBarcodes/${req.file.filename}`;
    }
    const paymentOption = await PaymentOption.create(req.body);
    res.status(200).json({
        status:"success",
        data:{
            paymentOption
        }
    })
});

exports.getAllPaymentOptions = async(req, res, next)=>{
    const paymentOptions = await PaymentOption.findAll();
    res.status(200).json({
        status:"success",
        result:paymentOptions.length,
        data:{
            paymentOptions
        }
    })
}

exports.updatePayOption = catchAsync(async (req, res, next) => {
    if (req.file) req.body.barcode = req.file.filename;

    const paymentOption = await PaymentOption.findByPk(req.params.id);

    if (!paymentOption) {
        return next(new AppError("No payment option was found with that ID", '', 404));
    }

    // Update fields manually
    Object.assign(paymentOption, req.body);

    // This triggers validations & hooks
    await paymentOption.save();

    res.status(200).json({
        status: "success",
        data: {
            paymentOption
        }
    });
});


exports.deletePayOption = catchAsync(async (req, res, next) => {
    const paymentOption = await PaymentOption.findByPk(req.params.id);

    if (!paymentOption) {
        return next(new AppError("No payment option was found with that ID", '', 404));
    }

    await paymentOption.destroy();

    res.status(204).json({
        status: "success",
        data: null
    });
});
