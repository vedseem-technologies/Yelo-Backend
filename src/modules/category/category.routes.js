const router = require("express").Router()
const controller = require("./category.controller")
const freeSubcategoryController = require("./free-subcategory.controller")

// Public routes
router.get("/", controller.getAllCategories)
router.get("/:slug", controller.getCategoryBySlug)

// Admin routes - Category CRUD
router.post("/admin/create", controller.createCategory)
router.put("/admin/:slug", controller.updateCategory)
router.delete("/admin/:slug", controller.deleteCategory)

// Admin routes - Subcategory CRUD
router.post("/admin/:slug/subcategories", controller.addSubcategory)
router.put("/admin/:slug/subcategories/:subcategorySlug", controller.updateSubcategory)
router.delete("/admin/:slug/subcategories/:subcategorySlug", controller.deleteSubcategory)

// Admin routes - Free Subcategories
router.get("/admin/free-subcategories", freeSubcategoryController.getAllFreeSubcategories)
router.post("/admin/free-subcategories/:freeSubcategoryId/assign", freeSubcategoryController.assignToCategory)
router.delete("/admin/free-subcategories/:freeSubcategoryId", freeSubcategoryController.deleteFreeSubcategory)

// Admin utility routes
router.post("/admin/update-counts", controller.updateCounts)
router.post("/admin/seed-hardcoded", controller.seedHardcodedCategories)

module.exports = router

