const Product = require("../modules/product/product.model")
const { assignProductToShops } = require("../modules/assignment/assignment.service")

async function reassignAllProducts() {
  const cursor = Product.find({ isActive: true }).cursor()

  for await (const product of cursor) {
    await assignProductToShops(product)
  }

  console.log("✅ Product reassignment completed")
}

module.exports = reassignAllProducts
