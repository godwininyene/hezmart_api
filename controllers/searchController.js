const { Category, SubCategory, Product } = require('../models');
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const { Op } = require('sequelize');

/**
 * @desc    Search across products, categories, and subcategories
 * @route   GET /api/v1/search
 * @access  Public
 */
exports.search = catchAsync(async (req, res, next) => {
    const { q: query } = req.query;

    if (!query || query.trim() === '') {
        return next(new AppError('Search query is required', 400));
    }

    // Search in parallel for better performance
    const [products, categories, subCategories] = await Promise.all([
        searchProducts(query),
        searchCategories(query),
        searchSubCategories(query)
    ]);

    // Format results with type identifiers
    const results = [
        ...products.map(p => ({ 
            ...p.toJSON(), 
            type: 'product' 
        })),
        ...categories.map(c => ({ 
            ...c.toJSON(), 
            type: 'category' 
        })),
        ...subCategories.map(sc => ({ 
            ...sc.toJSON(), 
            type: 'subcategory' 
        }))
    ];

    res.status(200).json({
        status: 'success',
        results: results.length,
        data: {
            results
        }
    });
});

// Helper function to search products
async function searchProducts(query) {
    return await Product.findAll({
        where: {
            [Op.or]: [
                { name: { [Op.like]: `%${query}%` } },
                { description: { [Op.like]: `%${query}%` } }
            ],
            status: 'active'
        },
        order:[['createdAt', 'DESC']],
        attributes: ['id', 'name', 'slug', 'coverImage', 'price', 'discountPrice'],
        include: [
            {
                model: Category,
                attributes: ['id', 'name'],
                as: 'category'
            },
            {
                model: SubCategory,
                attributes: ['id', 'name'],
                as: 'subCategory'
            }
        ],
    });
}

// Helper function to search categories
async function searchCategories(query) {
    return await Category.findAll({
        where: {
            name: { [Op.like]: `%${query}%` }
        },
        attributes: ['id', 'name', 'icon'],
    });
}

// Helper function to search subcategories
async function searchSubCategories(query) {
    return await SubCategory.findAll({
        where: {
            name: { [Op.like]: `%${query}%` }
        },
        attributes: ['id', 'name'],
        include: [{
            model: Category,
            attributes: ['id', 'name'],
            as: 'category'
        }],
    });
}