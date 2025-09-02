const catchAsync = require("../utils/catchAsync");

const {SubCategory } = require('../models')

exports.createSubcategory = catchAsync(async(req, res, next)=>{
    //Allow Nested Routes
    if (!req.body.categoryId) req.body.categoryId = req.params.categoryId;
    const subcategory = await SubCategory.create(req.body)
    res.status(200).json({
        status:"success",
        data:{
            subcategory
        }
    });
});

exports.getAllSubcategories = catchAsync(async(req, res, next)=>{
    // To allow for nested GET subcategories on category (hack)
    let filter = {};
    if (req.params.categoryId) filter = {where:{ categoryId: req.params.categoryId} }
   
    const subcategories = await SubCategory.findAll(filter);
    res.status(200).json({
        status:"success",
        result:subcategories.length,
        data:{
            subcategories
        }
    });
});

exports.getSubcategory = catchAsync(async(req, res, next)=>{
    const subcategory = await SubCategory.findByPK(req.params.id)
    if(!subcategory){
        return next(new AppError('No subcategory was found with that ID', '', 404));
    }
    res.status(200).json({
        status:"success",
        data:{
            subcategory
        }
    });
});

// Update category
exports.updateSubCategory = catchAsync(async (req, res, next) => {
  // Update the subcategory
  const [affectedRows] = await SubCategory.update(req.body, {
    where: { id: req.params.id }
  });

  // Check if any rows were affected
  if (affectedRows === 0) {
    return next(new AppError('No subcategory was found with that ID','', 404));
  }

  // Fetch the updated subcategory
  const updatedSubCategory = await SubCategory.findByPk(req.params.id);

  res.status(200).json({
    status: "success",
    data: {
      subcategory: updatedSubCategory
    }
  });
});

exports.deleteSubCategory = catchAsync(async(req, res, next)=>{
    const deletedCount = await SubCategory.destroy({
        where: { id: req.params.id }
      });
    
      if (deletedCount === 0) {
        return next(new AppError('No subcategory was found with that ID', '', 404));
      }
  
    res.status(204).json({
        status:"success",
        data:null
    });
});