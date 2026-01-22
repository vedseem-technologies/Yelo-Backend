const router = require("express").Router()
const { firebaseLoginHandler } = require("./auth.controller")

router.post("/firebase-login", firebaseLoginHandler)

module.exports = router
