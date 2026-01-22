const mongoose = require("mongoose")
const Review = require("./review.model")
const User = require("../user/user.model")
const { recalculateProductRating } = require("./review.service")
const { reassignSingleProduct } = require("../assignment/assignment.service")

async function createReview(req, res) {
  const { productId, rating, comment } = req.body
  const userId = req.user?.userId || "TEMP_USER_ID"

  // ✅ Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid productId"
    })
  }

  try {
    const review = await Review.create({
      productId,
      userId: userId.toString(),
      rating,
      comment
    })

    // Update rating & review count
    await recalculateProductRating(productId)

    // Reassign ONLY this product
    await reassignSingleProduct(productId)

    res.status(201).json({
      success: true,
      data: review
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

async function getReviews(req, res) {
  const { productId } = req.query

  const filter = {}
  if (productId && mongoose.Types.ObjectId.isValid(productId)) {
    filter.productId = productId
  }

  try {
    const reviews = await Review.find(filter)
      .sort({ createdAt: -1 })
      .lean()
    
    // Populate user names
    const reviewsWithUsers = await Promise.all(
      reviews.map(async (review) => {
        try {
          const user = await User.findOne({ _id: review.userId }).lean()
          if (!user) {
            // Try finding by phone if userId is a phone number
            const userByPhone = await User.findOne({ phone: review.userId }).lean()
            return {
              ...review,
              userName: userByPhone?.name || 'Anonymous User'
            }
          }
          return {
            ...review,
            userName: user.name || 'Anonymous User'
          }
        } catch (err) {
          // If userId is not a valid ObjectId, try finding by phone
          try {
            const user = await User.findOne({ phone: review.userId }).lean()
            return {
              ...review,
              userName: user?.name || 'Anonymous User'
            }
          } catch (err2) {
            return {
              ...review,
              userName: 'Anonymous User'
            }
          }
        }
      })
    )

    // Return as array (for backward compatibility)
    res.json(reviewsWithUsers)
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

module.exports = {
  createReview,
  getReviews
}
