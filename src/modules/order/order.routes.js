const router = require("express").Router()
const { createOrder, getOrders, getRemainingOrders, getOrderById, downloadInvoice, completeOrder, requestRefund, requestExchange } = require("./order.controller")
const auth = require("../../middlewares/auth.middleware")

// Admin routes (MUST be before other routes to avoid conflicts)
router.use("/admin", require("./order.admin.routes"))

// All order routes require authentication
router.get("/remaining", auth, getRemainingOrders) // Must be before /:id route
router.get("/", auth, getOrders)
router.get("/:id/invoice", auth, downloadInvoice)
router.get("/:id", auth, getOrderById)
router.post("/", auth, createOrder)
router.post("/:id/complete", auth, completeOrder)
router.post("/:id/refund", auth, requestRefund)
router.post("/:id/exchange", auth, requestExchange)

module.exports = router