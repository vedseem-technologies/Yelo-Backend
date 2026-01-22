const router = require("express").Router()
const {
  fetchAllShops,
  fetchShopBySlug,
  fetchShopProducts,
  createShopHandler,
  updateShopHandler,
  deleteShopHandler,
  reassignProductsHandler
} = require("./shop.controller")
const auth = require("../../middlewares/auth.middleware")

// GET routes (public)
router.get("/", fetchAllShops) // Get all shops
router.get("/:slug/products", fetchShopProducts) // Get shop products
router.get("/:slug", fetchShopBySlug) // Get shop by slug

// CRUD routes (admin - require authentication)
router.post("/", auth, createShopHandler) // Create shop
router.put("/:slug", auth, updateShopHandler) // Update shop
router.delete("/:slug", auth, deleteShopHandler) // Delete shop
// Reassign products - temporarily without auth for admin panel access
// TODO: Add proper admin authentication or move to admin-only route
router.post("/reassign-products", reassignProductsHandler) // Reassign all products to shops

module.exports = router
