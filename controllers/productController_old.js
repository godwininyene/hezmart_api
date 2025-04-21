const { Product, Tag, ProductOption, OptionValue } = require("../models");
const APIFeatures = require("../utils/apiFeatures");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const path = require('path');
const {sequelize} = require('./../models')
const fsPromises = require('fs').promises;



exports.createProduct = catchAsync(async (req, res, next) => {
  // Handle file uploads
  if (req.files) {
    req.body.images = [];
    
    if (req.files.coverImage) {
      req.body.coverImage = req.files.coverImage[0].filename;
    }
    
    if (req.files.images) {
      req.files.images.forEach((file, i) => {
        const ext = path.extname(file.originalname);
        const filename = `product-${Date.now()}-${i + 1}${ext}`;
        req.body.images.push(filename);
      });
    }
  }


  // Parse JSON fields if they come as strings
  const parseField = (field) => {
    if (!req.body[field]) return undefined;
    try {
      return typeof req.body[field] === 'string' ? 
        JSON.parse(req.body[field]) : 
        req.body[field];
    } catch (e) {
      throw new Error(`Invalid JSON format for ${field}`);
    }
  };

  // Handle JSON fields
  ['shippingCountries', 'options', 'tags'].forEach(field => {
    if (req.body[field]) {
      req.body[field] = parseField(field);
    }
  });


  // Create the base product
  const product = await Product.create(req.body);

  // Handle tags
  if (req.body.tags && req.body.tags.length > 0) {
    req.body.tags.forEach(el => console.log(el))
    const tagInstances = await Promise.all(
      req.body.tags.map(tagName => 
        Tag.findOrCreate({
          where: { name: tagName.trim() }, // Fixed: direct tagName access
          defaults: { name: tagName.trim() }
        })
      )
    );
    await product.setTags(tagInstances.map(([tag]) => tag));
  }

  // Handle options
  if (req.body.options && req.body.options.length > 0) {
    await Promise.all(
      req.body.options.map(async (optionData) => {
        const [option] = await ProductOption.findOrCreate({
          where: { 
            name: optionData.name.trim(),
            productId: product.id
          },
          defaults: {
            name: optionData.name.trim(),
            productId: product.id
          }
        });

        await OptionValue.bulkCreate(
          optionData.values.map(value => ({
            value: value.trim(),
            optionId: option.id
          }))
        );
      })
    );
  }

  // Fetch the complete product with associations
  const fullProduct = await Product.findByPk(product.id, {
    include: [
      { association: 'category',  attributes:['id','name'] },
      { association: 'subCategory',  attributes:['id','name'] },
      { association: 'user', attributes:['id','firstName', 'lastName'] },
      { association: 'tags',  attributes:['id','name']},
      { 
        association: 'options',attributes:['id','name'],
        include: [{ association: 'values', attributes:['id','value'] }]
      }
    ]
  });

  res.status(201).json({
    status: "success",
    data: {
      product: fullProduct
    }
  });
});

exports.getAllProducts = catchAsync(async(req, res, next) => {
  const features = new APIFeatures(req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();
  
  // Add default includes if no specific filters are applied
  if (!req.query.tags && !req.query.options) {
    features.queryOptions.include = [
      {
        model: Tag,
        through: { attributes: [] },
        as:'tags',
        attributes:['id','name']
      },
      {
        model: ProductOption,
        as: 'options',
        attributes:['id','name'],
        include: [{
          model: OptionValue,
          as: 'values',
          attributes:['id','value']
        }]
      }
    ];
  }

  const products = await Product.findAll(features.getOptions());
  
  res.status(200).json({
    status: "success",
    result: products.length,
    data: {
      products
    }
  });
});

exports.getProduct = catchAsync(async(req, res, next)=>{
  const product = await Product.findByPk(req.params.id,
    {
      include: [
        { association: 'category',  attributes:['id','name'] },
        { association: 'subCategory',  attributes:['id','name'] },
        { association: 'user', attributes:['id','firstName', 'lastName'] },
        { association: 'tags',  attributes:['id','name']},
        { 
          association: 'options',attributes:['id','name'],
          include: [{ association: 'values', attributes:['id','value'] }]
        }
      ]
    }
  );

  if(!product){
    return next(new AppError('No product was found with that ID', '', 404));
    
  }
  res.status(200).json({
    status:"success",
    data:{
      product
    }
  })
})

exports.updateProduct = catchAsync(async (req, res, next) => {
  // 1. Find the existing product
  const product = await Product.findByPk(req.params.id, {
    include: [
      { association: 'tags' },
      { 
        association: 'options',
        include: [{ association: 'values' }]
      }
    ]
  });

  if (!product) {
    return next(new AppError('No product found with that ID', '', 404));
  }

  // 2. Handle file uploads
  if (req.files) {
    // Merge new images with existing ones (if needed)
    const existingImages = product.images;
    if (req.files.coverImage) {
      req.body.coverImage = req.files.coverImage[0].filename;
      //Write the functionality to delete the old cover image
    }
    
    if (req.files.images) {
      req.body.images = [...existingImages];
      req.files.images.forEach((file, i) => {
        const ext = path.extname(file.originalname);
        const filename = `product-${Date.now()}-${i + 1}${ext}`;
        req.body.images.push(filename);
      });
    }
  }
  
  // 3. Parse and validate input data
  const parseField = (field) => {
    if (req.body[field] === undefined) return undefined;
    
    if (Array.isArray(req.body[field])) {
      return req.body[field];
    }
    
    if (typeof req.body[field] === 'string') {
      try {
        return req.body[field] ? JSON.parse(req.body[field]) : [];
      } catch (e) {
        throw new AppError(`Invalid JSON format for ${field}`, 400);
      }
    }
    
    return req.body[field];
  };

  // Process JSON fields with proper defaults
  ['shippingCountries', 'options', 'tags'].forEach(field => {
    req.body[field] = parseField(field);
  });

  // 4. Handle tags update
  if (req.body.tags !== undefined) {
    const tagInstances = await Promise.all(
      req.body.tags.map(tagName => {
        const name = typeof tagName === 'object' ? tagName.name : tagName;
        return Tag.findOrCreate({
          where: { name: name.trim() },
          defaults: { name: name.trim() }
        });
      })
    );
    await product.setTags(tagInstances.map(([tag]) => tag));
  }

  // 5. Handle options update (more complex as we need to manage existing options)
  if (req.body.options !== undefined) {
    // First remove all existing options and values
    await ProductOption.destroy({ where: { productId: product.id } });
    
    // Then create new ones
    if (req.body.options.length > 0) {
      await Promise.all(
        req.body.options.map(async (optionData) => {
          const option = await ProductOption.findOrCreate({
            name: optionData.name.trim(),
            productId: product.id
          });

          await OptionValue.bulkCreate(
            optionData.values.map(value => ({
              value: value.trim(),
              optionId: option.id
            }))
          );
        })
      );
    }
  }

  // 6. Update product fields
  const updatableFields = [
    'name', 'description', 'price', 'discountPrice', 
    'weight', 'isDigital', 'seoTitle', 'seoDescription',
    'taxable', 'coverImage', 'status', 'stockQuantity'
  ];

  updatableFields.forEach(field => {
    if (req.body[field] !== undefined) {
      product[field] = req.body[field];
    }
  });

 
  // 7. Save the updated product
  await product.save();

  // 8. Fetch the complete updated product with associations
  const updatedProduct = await Product.findByPk(product.id, {
    attributes: { exclude: ['updatedAt'] },
    include: [
      { 
        association: 'category',
        attributes: ['id', 'name'] 
      },
      { 
        association: 'subCategory',
        attributes: ['id', 'name'] 
      },
      { 
        association: 'user',
        attributes: ['id', 'firstName', 'lastName'] 
      },
      { 
        association: 'tags',
        attributes: ['id', 'name'],
        through: { attributes: [] }
      },
      { 
        association: 'options',
        attributes: ['id', 'name'],
        include: [{ 
          association: 'values', 
          attributes: ['id', 'value'] 
        }]
      }
    ]
  });

  res.status(200).json({
    status: "success",
    data: {
      product: updatedProduct
    }
  });
});

exports.deleteProduct = catchAsync(async (req, res, next) => {
  // 1. Find the product with all necessary associations
  const product = await Product.findByPk(req.params.id, {
    include: [
      { 
        association: 'options',
        include: [{ association: 'values' }],
        
      }
    ]
  });

  if (!product) {
    return next(new AppError('No product found with that ID','', 404));
  }

  // 2. Get file paths for cleanup (if using file storage)
  const filesToDelete = [];
  if (product.coverImage) {
    filesToDelete.push(path.join('public', 'uploads', 'products', 'coverImages', product.coverImage));
  }
  
  try {
    const images = product.images;
    images.forEach(image => {
      filesToDelete.push(path.join('public', 'uploads', 'products', 'images', image));
    });
  } catch (e) {
    console.error('Error parsing product images:', e);
  }
  // 3. Perform deletion in transaction
  const transaction = await sequelize.transaction();
  
  try {
    // Delete associated option values first
    if (product.options && product.options.length > 0) {
      const optionIds = product.options.map(option => option.id);
      await OptionValue.destroy({
        where: { optionId: optionIds },
        transaction
      });
    }

    // Delete product options
    await ProductOption.destroy({
      where: { productId: product.id },
      transaction
    });

    // Remove all tag associations (from junction table)
    await product.setTags([], { transaction });

    // Finally delete the product
    await product.destroy({ transaction });

    // Commit the transaction
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('Product deletion failed:', error);
    return next(new AppError('Failed to delete product','', 500));
  }

  // Delete files AFTER commit
  for (const filePath of filesToDelete) {
    try {
      await fsPromises.unlink(filePath);
    } catch (err) {
      console.error('Failed to delete file:', filePath, err);
    }
  }

  res.status(204).json({
    status: "success",
    data: null
  });
});