const router = require("express").Router()
const { createRazorpayOrder, verifyPayment } = require("./payment.controller")
const auth = require("../../middlewares/auth.middleware")

// All payment routes require authentication
router.post("/create-order", auth, createRazorpayOrder)
router.post("/verify", auth, verifyPayment)

module.exports = router

