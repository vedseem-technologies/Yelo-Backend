const Review = require("./review.model")
const Product = require("../product/product.model")

async function recalculateProductRating(productId) {
  const stats = await Review.aggregate([
    { $match: { productId } },
    {
      $group: {
        _id: "$productId",
        avgRating: { $avg: "$rating" },
        count: { $sum: 1 }
      }
    }
  ])

  if (!stats.length) {
    await Product.updateOne(
      { _id: productId },
      { rating: 0, reviews: 0 }
    )
    return
  }

  await Product.updateOne(
    { _id: productId },
    {
      rating: Number(stats[0].avgRating.toFixed(1)),
      reviews: stats[0].count
    }
  )
}

module.exports = {
  recalculateProductRating
}
