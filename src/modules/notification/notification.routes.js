const router = require("express").Router()
const { getRelatedProducts } = require("./notification.controller")
const auth = require("../../middlewares/auth.middleware")

// GET /api/notifications/related-products
// Get new products related to user's purchases, cart, and wishlist
router.get("/related-products", auth, getRelatedProducts)

module.exports = router
