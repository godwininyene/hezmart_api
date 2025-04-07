const AppError = require('./../utils/appError')

const handleJWTError = () =>new AppError('Invalid token. Please log in again!', '', 401)
const handleJWTExpireError = ()=> new AppError('Your token has expired! Please log in again.', '', 401)

//Sequelize Errors Function
const handleSequelizeValidationError = err =>{
    const errors = err.errors.reduce((acc, el)=>{
        acc[el.path] = el.message
        return acc;
    }, {})
    return new AppError('Invalid data supplied', errors, 400)
}

const handleSequelizeDuplicateError = err =>{
    const errors = err.errors.reduce((acc, el)=>{
        acc[el.path] = `${el.path} is already in use. Please use another value`
        return acc;
    }, {});
    return new AppError('Invalid data supplied', errors, 400)
}


const sendErrorProd = (err, req, res)=>{
    // A) API
    if(req.originalUrl.startsWith('/api')){
        // A) Operational, trusted error: Send error and message to client
        if(err.isOperational){
            return  res.status(err.statusCode).json({
                status:err.status,
                message:err.message,
                errors:err.errors
            })
        
        }
        // B) Programming or unknown error: Don't leak error details
        // 1) Log the error
        console.error('ERROR', err)
        // 2) Send generic response
        return res.status(500).json({
            status:'error',
            message:'Some went very wrong!',
            err
        });
    }
}
const sendErrorDev = (err, req, res)=>{
    // A) API
    if(req.originalUrl.startsWith('/api')){
        return res.status(err.statusCode).json({
            status:err.status,
            message:err.message,
            error:err
        });
    }
}


module.exports =(err, req, res, next)=>{
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if(process.env.NODE_ENV === 'development'){

        sendErrorDev(err, req, res)

    }else if(process.env.NODE_ENV == 'production'){
      
        let error = err;        
        //Handle JWT Errors
        if(error.name === 'JsonWebTokenError') error = handleJWTError();
        if(error.name === 'TokenExpiredError') error = handleJWTExpireError();
        
        //Handle sequelize Errors
        if(error.name === 'SequelizeValidationError')error = handleSequelizeValidationError(err)
        if(error.name === 'SequelizeUniqueConstraintError') error = handleSequelizeDuplicateError(err)

        sendErrorProd(error,  req, res)
    }
   
};


