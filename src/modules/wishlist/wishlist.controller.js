const mongoose = require("mongoose")
const {
  getWishlist,
  addToWishlist,
  removeFromWishlist
} = require("./wishlist.service")

async function fetchWishlist(req, res) {
  try {
    const userId = req.user.userId
    const wishlist = await getWishlist(userId)
    res.json({ success: true, data: wishlist || { products: [] } })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

async function addProductToWishlist(req, res) {
  try {
    const userId = req.user.userId
    const { productId } = req.body

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid productId" })
    }

    const wishlist = await addToWishlist(userId, productId)
    res.json({ success: true, data: wishlist })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

async function removeProductFromWishlist(req, res) {
  try {
    const userId = req.user.userId
    const { productId } = req.params

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid productId" })
    }

    const wishlist = await removeFromWishlist(userId, productId)
    res.json({ success: true, data: wishlist })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}

module.exports = {
  fetchWishlist,
  addProductToWishlist,
  removeProductFromWishlist
}
