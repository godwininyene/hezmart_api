

// exports.deleteProduct = (productId)=> {
//   const product = await Product.findByPk(productId, {
//     include: [
//       { 
//         association: 'options',
//         include: [{ association: 'values' }]
//       }
//     ]
//   });

//   if (!product) {
//     throw new Error('Product not found');
//   }

//   // Get file paths for cleanup
//   const filesToDelete = this._getProductFiles(product);

//   const transaction = await sequelize.transaction();
  
//   try {
//     // Delete associated option values
//     if (product.options?.length) {
//       const optionIds = product.options.map(option => option.id);
//       await OptionValue.destroy({
//         where: { optionId: optionIds },
//         transaction
//       });
//     }

//     // Delete product options
//     await ProductOption.destroy({
//       where: { productId },
//       transaction
//     });

//     // Remove all tag associations
//     await product.setTags([], { transaction });

//     // Delete the product
//     await product.destroy({ transaction });

//     await transaction.commit();

//   } catch (error) {
//     await transaction.rollback();
//     console.error('Product deletion failed:', error);
//     throw error;
//   }

//   // Only attempt file deletion after successful commit
//   try {
//     await this._cleanupProductFiles(filesToDelete);
//   } catch (fileError) {
//     console.error('File cleanup failed:', fileError);
//     // Don't rethrow - database operation was successful
 

// }