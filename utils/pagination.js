
function generatePaginationMeta({ count, page, limit, req }) {
    const totalPages = Math.ceil(count / limit);

    const getFullUrl = (pageNum) => {
        const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;
        const query = new URLSearchParams({ ...req.query, page: pageNum }).toString();
        return `${baseUrl}?${query}`;
    };

    return {
        totalItems: count,
        currentPage: page,
        totalPages,
        perPage: limit,
        nextPage: page < totalPages ? getFullUrl(page + 1) : null,
        prevPage: page > 1 ? getFullUrl(page - 1) : null
    };
}

module.exports = generatePaginationMeta;
