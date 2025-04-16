const { Op, sequelize } = require('sequelize');
// const sequelize = require('./../utils/sequelize')
class APIFeatures {
    constructor(queryString) {
        this.queryString = queryString;
        this.queryOptions = {}; // Initialize query options
    }

    filter() {
        const queryObj = { ...this.queryString };
        const excludedFields = ['page', 'sort', 'limit', 'fields'];
        excludedFields.forEach((el) => delete queryObj[el]); 
        // Build `where` clause for advanced filtering
        const where = {}; // Sequelize WHERE clause

        Object.keys(queryObj).forEach((key) => {
            const value = queryObj[key];
           
            if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
              
                // Handle operators like { viewCount: { gt: '2', lt: '10' } }
                where[key] = {}; // Create a nested object for the field
                Object.entries(value).forEach(([operator, val]) => {
                    const sequelizeOperator = Op[operator]; // e.g., Op.gt, Op.lt
                    if (sequelizeOperator) {
                        where[key][sequelizeOperator] = isNaN(val) ? val : Number(val);
                    }
                });
            } else {
                // Handle simple filtering (e.g., ?authorId=4)
                where[key] = isNaN(value) ? value : Number(value);
            }
        });

        this.queryOptions.where = where;
        return this;
    }

    sort() {
        if (this.queryString.sort) {
            const sortBy = this.queryString.sort.split(',').join(' ');
            this.queryOptions.order = sequelize.literal(sortBy);
        } else {
            this.queryOptions.order = [['createdAt', 'DESC']]; // Default sorting
        }
        return this;
    }

    limitFields() {
        if (this.queryString.fields) {
            const fields = this.queryString.fields.split(',').map(field => field.trim());
            this.queryOptions.attributes = fields;
        }
        return this;
    }

    paginate() {
        const page = this.queryString.page * 1 || 1;
        const limit = this.queryString.limit * 1 || 100;
        const offset = (page - 1) * limit;

        this.queryOptions.limit = limit;
        this.queryOptions.offset = offset;
        return this;
    }
    getOptions() {
        return this.queryOptions;
    }
}

module.exports = APIFeatures;


