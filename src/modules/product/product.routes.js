const express = require("express")
const router = express.Router()
const controller = require("./product.controller")
const searchController = require("./product.search.controller")

// Admin routes for product management (MUST be before regex route)
const adminController = require("./product.admin.controller")
router.get("/admin/debug", adminController.getProductDebugData)
router.get("/admin/check-indexes", adminController.checkIndexes)
router.post("/admin/delete-all", adminController.deleteAllProducts)
router.post("/admin/delete-by-criteria", adminController.deleteProductsByCriteria)
router.post("/admin/reassign-and-sync", adminController.reassignAndSyncProducts)
router.post("/admin/create-categories-from-products", adminController.createCategoriesFromProducts)
router.post("/admin/populate-subcategories", adminController.populateSubcategories)
router.post("/admin/migrate-categories", adminController.migrateCategories)
router.post("/admin/seed-shops", adminController.seedShopsEndpoint)

// PUT/PATCH/DELETE routes (admin) - Must be before GET routes to avoid conflicts
router.put("/:id", controller.updateProduct)
router.patch("/:id", controller.patchProduct)
router.delete("/:id", controller.deleteProduct)

// POST routes (admin)
router.post("/", controller.createProduct)
router.post("/bulk", controller.createBulkProducts)

// GET routes (public)
router.get("/count", controller.getProductCount) // Health check endpoint
router.get("/search/suggestions", searchController.getSearchSuggestions) // Search suggestions (top 5 products)
router.get("/search/comprehensive", searchController.comprehensiveSearch) // Comprehensive search (products, categories, subcategories)
router.get("/", controller.getAllProducts)
router.get("/trending", controller.getTrendingProducts)
router.get("/category", controller.getProductsByCategory)
router.get("/shop/:shopSlug", controller.getProductsByShop)
router.get("/vendor/:vendorSlug", controller.getProductsByVendor)
// Use regex to capture slugs with slashes (e.g., vendor-slug/product-slug)
// This matches any path that doesn't start with the above routes
router.get(/^\/(.+)$/, controller.getProductBySlug) // Must be last to avoid conflicts

module.exports = router
