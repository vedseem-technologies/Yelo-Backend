const router = require("express").Router()
const controller = require("./vendors.controller")

router.post("/", controller.createVendor)
router.get("/", controller.getAllVendors)
router.get("/slug/:slug", controller.getVendorBySlug) // Get vendor by slug
router.get("/:slug/products", controller.getVendorProducts) // Get vendor products by slug
router.get("/:id", controller.getVendorById) // Get vendor by ID
router.put("/:id", controller.updateVendor)
router.delete("/:id", controller.deleteVendor)

module.exports = router
