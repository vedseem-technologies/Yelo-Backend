const router = require("express").Router();
const { updateProfile, getMe, updateAddress } = require("./user.controller");
const auth = require("../../middlewares/auth.middleware");

router.put("/profile", auth, updateProfile);
router.put("/address", auth, updateAddress);
router.get("/me", auth, getMe); // for frontend use only

module.exports = router;
