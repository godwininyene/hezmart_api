const path = require('path');

exports.parseField = (field, value) => {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      return value ? JSON.parse(value) : [];
    } catch (e) {
      throw new Error(`Invalid JSON format for ${field}`);
    }
  }
  return value;
};

exports.handleFileUploads = (req, existingImages = []) => {
  if (!req.files) return;

  const host = `${req.protocol}://${req.get('host')}`;

  req.body.images = [...existingImages];

  if (req.files.coverImage) {
    const file = req.files.coverImage[0];
    req.body.coverImage = `${host}/uploads/products/coverImages/${file.filename}`;
  }

  if (req.files.images) {
    req.files.images.forEach(file => {
      req.body.images.push(`${host}/uploads/products/images/${file.filename}`);
    });
  }
};


exports.getProductIncludes = () => [
  { association: 'category', attributes: ['id', 'name'] },
  { association: 'subCategory', attributes: ['id', 'name'] },
  { association: 'user', attributes: ['id', 'firstName', 'lastName', 'businessName', 'businessLogo'] },
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
];