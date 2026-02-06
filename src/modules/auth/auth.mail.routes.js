const express = require("express");
const router = express.Router();
const { requestOTP, verifyOTP } = require("./auth.mail.controller");

router.post("/request-otp", requestOTP);
router.post("/verify-otp", verifyOTP);

module.exports = router;
