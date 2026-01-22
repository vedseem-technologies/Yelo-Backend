const router = require("express").Router()
const {
  fetchWishlist,
  addProductToWishlist,
  removeProductFromWishlist
} = require("./wishlist.controller")
const auth = require("../../middlewares/auth.middleware")

// All wishlist routes require authentication
router.get("/", auth, fetchWishlist)
router.post("/", auth, addProductToWishlist)
router.delete("/:productId", auth, removeProductFromWishlist)

module.exports = router
