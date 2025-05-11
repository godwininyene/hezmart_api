const multer = require('multer');
const path = require('path');
const AppError = require('./appError');

// Set up storage for uploaded files
const storage = multer.diskStorage({

    destination: (req, file, cb) => {
       
        if (file.fieldname === 'businessLogo') {
            cb(null, 'public/uploads/businesses/logos');
        } else if(file.fieldname === 'coverImage'){
            cb(null, 'public/uploads/products/coverImages');
        }else if(file.fieldname === 'images'){
            cb(null, 'public/uploads/products/images');
        }else if(file.fieldname === 'catIcon'){
            cb(null, 'public/uploads/categoryIcons')
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    }
});

// File filter with detailed error messages
const fileFilter = (req, file, cb) => {
    const fieldname = file.fieldname;
    if(file.mimetype.startsWith('image')){
        cb(null, true);  
    }else{
        cb(
            new AppError(
                'Invalid file type',
                { [fieldname]: `${fieldname} must be an image (JPEG, PNG, GIF)` },
                400
            ),
            false
        );
    }
};



// Configure multer upload
const upload = multer({
    storage,
    fileFilter
});

// Middleware for handling business logo uploads
exports.uploadBusinessLogo = upload.single('businessLogo')
exports.uploadProductImages = upload.fields([
    {name:'coverImage', maxCount: 1},
    {name: 'images', maxCount: 3}
]);

exports.uploadCategoryIcon = upload.single('catIcon');