const express = require("express");
const subcategoryController = require("./../controllers/subCategoryController");
const authController = require("./../controllers/authController");

const router = express.Router({ mergeParams: true });

router
  .route("/")
  .post(
    authController.protect,
    authController.restrictTo("admin"),
    subcategoryController.createSubcategory
  )
  .get(subcategoryController.getAllSubcategories);

router
  .route("/:id")
  .delete(
    authController.protect,
    authController.restrictTo("admin"),
    subcategoryController.deleteSubCategory
  )
  .patch(
    authController.protect,
    authController.restrictTo("admin"),
    subcategoryController.updateSubCategory
  );

module.exports = router;
