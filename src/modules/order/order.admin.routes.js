const router = require("express").Router()
const {
  getAllAdminOrders,
  getAdminOrderById,
  updateOrderStatus,
  reassignOrderToShop,
  completeOrderAdmin
} = require("./order.admin.controller")

// Admin routes - no auth middleware needed if admin panel handles auth separately
// If you need admin auth, add it here: const adminAuth = require("../../middlewares/adminAuth.middleware")

router.get("/all", getAllAdminOrders)
router.get("/:id", getAdminOrderById)
router.put("/:id/status", updateOrderStatus)
router.post("/:id/reassign-shop", reassignOrderToShop)
router.post("/:id/complete", completeOrderAdmin)

module.exports = router

