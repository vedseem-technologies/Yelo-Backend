const router = require("express").Router()
const { createReview, getReviews } = require("./review.controller")
const auth = require("../../middlewares/auth.middleware")

// List reviews (optionally filter by ?productId=...)
router.get("/", getReviews)

// Create a new review (requires authentication)
router.post("/", auth, createReview)

module.exports = router
