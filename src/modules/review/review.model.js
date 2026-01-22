const mongoose = require("mongoose")

const reviewSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true
    },

    // For now we keep userId as a simple string so we can test
    // reviews without a real authenticated user ObjectId.
    // Later, when auth is added, this can be switched back to ObjectId.
    userId: {
      type: String,
      required: true
    },

    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    },

    comment: String,

    isVerifiedPurchase: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
)

module.exports = mongoose.model("Review", reviewSchema)
