const multer = require('multer');
const path = require('path');
const AppError = require('./appError');

// Set up storage for uploaded files
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'businessLogo') {
            cb(null, 'public/uploads/businesses/logos');
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
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif'];
    const allowedDocumentTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    
    if (file.fieldname === 'businessLogo') {
        if (!allowedImageTypes.includes(file.mimetype)) {
            return cb(new AppError(
                'Invalid file type', 
                { businessLogo: 'Logo must be an image (JPEG, PNG, GIF)' }, 
                400
            ), false);
        }
    } 
    cb(null, true);
};

// Configure multer upload
const upload = multer({
    storage,
    fileFilter
});

// Middleware for handling business logo uploads
exports.uploadBusinessLogo = upload.single('businessLogo')