const express = require('express');
const likeController = require('../controllers/likeController');
const authController = require('../controllers/authController');
const router = express.Router({mergeParams: true});

router.use(authController.protect);

// For Product Likes:

  // POST /api/v1/products/:productId/likes - Toggle like

  // GET /api/v1/products/:productId/likes/status - Get like status

  // GET /api/v1/products/:productId/likes - Get all likes for product

  // DELETE /api/v1/products/:productId/likes - Remove like

// For User Likes:

  // GET /api/v1/users/:userId/likes - Get user's liked products

//   General:

  // GET /api/v1/likes/popular - Get popular products (keep at root)

// Toggle like for current product (when nested under products)
router.post('/toggle', likeController.toggleLike);

// Get like status for current product (when nested under products)
router.get('/like-status', likeController.getLikeStatus);

// Get likes for current product (when nested under products)
router.get('/', likeController.getProductLikes);

// Delete like for current product (when nested under products)
router.delete('/', likeController.deleteLike);

// For user's liked products (when nested under users)
router.get('/my-likes', likeController.getUserLikes);

// Popular products (keep at root level)
router.get('/popular', likeController.getPopularProducts);

module.exports = router;