const { Product, Tag, ProductOption, OptionValue, sequelize } = require('../models');
const { getProductIncludes } = require('../utils/productHelpers');
const path = require('path');
const fsPromises = require('fs').promises;
class ProductService {
  static async createWithAssociations(productData) {
    return sequelize.transaction(async (transaction) => {
      const product = await Product.create(productData, { transaction });
      
      if (productData.tags?.length) {
        await this._handleTags(product, productData.tags, transaction);
      }
      
      if (productData.options?.length) {
        await this._handleOptions(product, productData.options, transaction);
      }
      
      return this._getFullProduct(product.id, transaction);
    });
  }

  static async updateWithAssociations(productId, productData) {
    return sequelize.transaction(async (transaction) => {
      // 1. Find existing product
      const product = await Product.findByPk(productId, { transaction });
      if (!product) throw new Error('Product not found');
  
      // 2. Update basic fields
      const updatableFields = [
        'name', 'description', 'price', 'discountPrice', 
        'weight', 'isDigital', 'seoTitle', 'seoDescription',
        'taxable', 'coverImage',  'stockQuantity',
        'images', 'shippingCountries'
      ];
  
      updatableFields.forEach(field => {
        if (productData[field] !== undefined) {
          product[field] = field === 'images' || field === 'shippingCountries'
            ? JSON.stringify(productData[field])
            : productData[field];
        }
      });
  
      await product.save({ transaction });
  
      // 3. Handle associations
      if (productData.tags !== undefined) {
        await this._handleTags(product, productData.tags, transaction);
      }
  
      if (productData.options !== undefined) {
        await this._handleOptions(product, productData.options, transaction, true); // true = replace existing
      }
  
      // 4. Return full updated product
      return this._getFullProduct(product.id, transaction);
    });
  }

  static async _handleTags(product, tags, transaction) {
    if (!tags || !tags.length) return;false
  
    const tagInstances = await Promise.all(
      tags.map(tagName => 
        Tag.findOrCreate({
          where: { name: tagName.trim() },
          defaults: { name: tagName.trim() },
          transaction
        })
      )
    );
    
    try {
      await product.addTags(
        tagInstances.map(([tag]) => tag), 
        { transaction }
      );
    } catch (error) {
      // Handle case where some associations already exist
      if (error.name !== 'SequelizeUniqueConstraintError') {
        // Handle duplicate gracefully
        console.log('Some tags were already associated');
        throw error;
      }
    }
  }

  static async _handleOptions(product, options, transaction, replaceExisting = false) {
    if (replaceExisting) {
      // Remove existing options and values
      await ProductOption.destroy({ 
        where: { productId: product.id },
        transaction 
      });
    }
  
    if (options?.length > 0) {
      await Promise.all(
        options.map(async (optionData) => {
          const [option] = await ProductOption.findOrCreate({
            where: { 
              name: optionData.name.trim(),
              productId: product.id
            },
            defaults: {
              name: optionData.name.trim(),
              productId: product.id
            },
            transaction
          });
  
          if (replaceExisting) {
            await OptionValue.destroy({
              where: { optionId: option.id },
              transaction
            });
          }
  
          await OptionValue.bulkCreate(
            optionData.values.map(value => ({
              value: value.trim(),
              optionId: option.id
            })),
            { transaction }
          );
        })
      );
    }
  }

  static async _getFullProduct(productId, transaction) {
    return Product.findByPk(productId, {
      attributes: { exclude: ['updatedAt'] },
      include: getProductIncludes(),
      transaction
    });
  }

  static async deleteProduct(productId) {
    const product = await Product.findByPk(productId, {
      include: [
        { 
          association: 'options',
          include: [{ association: 'values' }]
        }
      ]
    });
  
    if (!product) {
      throw new Error('Product not found');
    }
  
    // Get file paths for cleanup
    const filesToDelete = this._getProductFiles(product);
  
    const transaction = await sequelize.transaction();
    
    try {
      await product.destroy({ transaction });
      await transaction.commit();
  
    } catch (error) {
      await transaction.rollback();
      console.error('Product deletion failed:', error);
      throw error;
    }
  
    // File cleanup remains the same
    try {
      await this._cleanupProductFiles(filesToDelete);
    } catch (fileError) {
      console.error('File cleanup failed:', fileError);
      // Don't rethrow - database operation was successful
    }
  }
  static _getProductFiles(product) {
    const filesToDelete = [];
    // Helper to extract filename from full URL
    const extractFilename = (url) => {
      if (!url) return null;
      return path.basename(url); // gets the filename.ext from URL
    };

    if (product.coverImage) {
      const coverImageFilename = extractFilename(product.coverImage);
      filesToDelete.push(
        path.join('public', 'uploads', 'products', 'coverImages', coverImageFilename)
      );
    }
    
    try {
      const images = product.images || [];
      images.forEach(imageUrl  => {
        const imageFilename = extractFilename(imageUrl);
        filesToDelete.push(
          path.join('public', 'uploads', 'products', 'images', imageFilename)
        );
      });
    } catch (e) {
      console.error('Error parsing product images:', e);
    }
    
    return filesToDelete;
  }

  static async _cleanupProductFiles(filePaths) {
    await Promise.all(
      filePaths.map(filePath => 
        fsPromises.unlink(filePath).catch(err => {
          console.error('Failed to delete file:', filePath, err);
        })
      )
    );
  }
}

module.exports = ProductService;