const Product = require("./product.model")

/**
 * Checks if stock is available for all items.
 * @param {Array} items - Array of items with { productId, quantity }
 * @returns {Promise<void>} - Resolves if stock is sufficient, throws error if not
 */
async function checkStock(items) {
  console.log("Checking stock for items:", items.length)
  for (const item of items) {
    const product = await Product.findById(item.productId)

    if (!product) {
      console.error(`Product not found: ${item.productId}`)
      throw new Error(`Product not found: ${item.productId}`)
    }

    console.log(`Checking stock for product: ${product.name} (Current Stock: ${product.stock}, Requested: ${item.quantity})`)

    if (product.stock < item.quantity) {
      console.error(`Insufficient stock for product: ${product.name}`)
      throw new Error(`Insufficient stock for product: ${product.name}`)
    }
  }
  console.log("Stock check passed for all items")
}

/**
 * Atomically reduces stock for items.
 * @param {Array} items - Array of items with { productId, quantity }
 * @returns {Promise<void>}
 */
async function reduceStock(items) {
  console.log("Attempting to reduce stock for items:", items.length)
  const deductedItems = []

  try {
    for (const item of items) {
      console.log(`Reducing stock for product ${item.productId} by ${item.quantity}`)

      // Atomic update: Decrement stock ONLY if stock >= quantity
      const updatedProduct = await Product.findOneAndUpdate(
        {
          _id: item.productId,
          stock: { $gte: item.quantity }
        },
        { $inc: { stock: -item.quantity } },
        { new: true }
      )

      if (!updatedProduct) {
        console.error(`Failed to reduce stock for product ${item.productId}. It might be out of stock.`)
        throw new Error(`Insufficient stock or concurrency issue for product ${item.productId}`)
      }

      console.log(`Stock reduced successfully for ${updatedProduct.name}. New Stock: ${updatedProduct.stock}`)
      deductedItems.push({ productId: item.productId, quantity: item.quantity })
    }
    console.log("All items deducted successfully")
  } catch (error) {
    console.error("Error during stock deduction. Initiating rollback...", error.message)
    await rollbackStock(deductedItems)
    throw error
  }
}

/**
 * Rolls back stock deduction in case of failure.
 * @param {Array} items - Array of items to rollback { productId, quantity }
 */
async function rollbackStock(items) {
  console.log("Rolling back stock for items:", items.length)
  for (const item of items) {
    try {
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { stock: item.quantity } }
      )
      console.log(`Stock rolled back for product ${item.productId} by ${item.quantity}`)
    } catch (err) {
      console.error(`Failed to rollback stock for product ${item.productId}`, err)
    }
  }
}

module.exports = {
  checkStock,
  reduceStock,
  rollbackStock
}
