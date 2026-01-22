const Wishlist = require("./wishlist.model")

async function getWishlist(userId) {
  return Wishlist.findOne({ userId }).populate("products")
}

async function addToWishlist(userId, productId) {
  return Wishlist.findOneAndUpdate(
    { userId },
    { $addToSet: { products: productId } },
    { upsert: true, new: true }
  ).populate("products")
}

async function removeFromWishlist(userId, productId) {
  return Wishlist.findOneAndUpdate(
    { userId },
    { $pull: { products: productId } },
    { new: true }
  ).populate("products")
}

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist
}
