const { Op, sequelize } = require('sequelize');

const{Tag, ProductOption, OptionValue} = require('./../models')

class APIFeatures {
    constructor(queryString) {
        this.queryString = queryString;
        this.queryOptions = {
            where: {},
            include: []
        };
    }

    filter() {
        const queryObj = { ...this.queryString };
        const excludedFields = ['page', 'sort', 'limit', 'fields', 'tags', 'options'];
        excludedFields.forEach((el) => delete queryObj[el]);

        // Regular field filtering
        Object.keys(queryObj).forEach((key) => {
            const value = queryObj[key];
           
            if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
                this.queryOptions.where[key] = {};
                Object.entries(value).forEach(([operator, val]) => {
                    const sequelizeOperator = Op[operator];
                    if (sequelizeOperator) {
                        this.queryOptions.where[key][sequelizeOperator] = isNaN(val) ? val : Number(val);
                    }
                });
            } else {
                this.queryOptions.where[key] = isNaN(value) ? value : Number(value);
            }
        });

        // Handle tag filtering
        if (this.queryString.tags) {
            const tags = Array.isArray(this.queryString.tags) 
                ? this.queryString.tags 
                : [this.queryString.tags];
            
            this.queryOptions.include.push({
                model: Tag,
                as:'tags',
                attributes:['id','name'],
                where: {
                    name: {
                        [Op.in]: tags
                    }
                },
                through: { attributes: [] } // Exclude junction table attributes
            });
        }

        // Handle option filtering
        if (this.queryString.options) {
            let optionsFilter;
            try {
                optionsFilter = typeof this.queryString.options === 'string'
                    ? JSON.parse(this.queryString.options)
                    : this.queryString.options;
            } catch (e) {
                console.error('Invalid options filter format');
                return this;
            }

            optionsFilter.forEach(option => {
                this.queryOptions.include.push({
                    model: ProductOption,
                    as: 'options',
                    attributes:['id','name'],
                    include: [{
                        model: OptionValue,
                        as: 'values',
                        attributes:['id','value'],
                        where: {
                            value: Array.isArray(option.values) 
                                ? { [Op.in]: option.values }
                                : option.values
                        }
                    }],
                    where: {
                        name: option.name
                    }
                });
            });
        }

        return this;
    }

    sort() {
        if (this.queryString.sort) {
            const sortBy = this.queryString.sort.split(',');
            this.queryOptions.order = sortBy.map(field => {
                if (field.startsWith('-')) {
                    return [field.slice(1), 'DESC'];
                }
                return [field, 'ASC'];
            });
        } else {
            this.queryOptions.order = [['createdAt', 'DESC']];
        }
        return this;
    }

    limitFields() {
        if (this.queryString.fields) {
            const fields = this.queryString.fields.split(',');
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


