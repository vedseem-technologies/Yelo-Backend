const Shop = require("./shop.model")
const { reassignAllProducts } = require("../assignment/assignment.service")

async function getAllShops() {
  return Shop.find({}).sort({ createdAt: 1 })
}

async function getShopBySlug(slug) {
  return Shop.findOne({ slug })
}

async function createShop(shopData) {
  const shop = await Shop.create(shopData)
  
  // Reassign all products to shops after creating a new shop
  await reassignAllProducts()
  
  return shop
}

async function updateShop(slug, updateData) {
  const shop = await Shop.findOneAndUpdate(
    { slug },
    { $set: updateData },
    { new: true, runValidators: true }
  )
  
  if (!shop) {
    throw new Error("Shop not found")
  }
  
  // Reassign all products to shops after updating shop criteria
  await reassignAllProducts()
  
  return shop
}

async function deleteShop(slug) {
  const shop = await Shop.findOneAndDelete({ slug })
  
  if (!shop) {
    throw new Error("Shop not found")
  }
  
  // Reassign all products to shops after deleting a shop
  await reassignAllProducts()
  
  return shop
}

module.exports = {
  getAllShops,
  getShopBySlug,
  createShop,
  updateShop,
  deleteShop
}
