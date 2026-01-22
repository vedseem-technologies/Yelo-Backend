const router = require("express").Router()
const controller = require("./brand.controller")

router.get("/", controller.getAllBrands)
router.get("/:slug", controller.getBrandBySlug)

module.exports = router

