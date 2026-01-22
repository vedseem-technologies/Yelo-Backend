const router = require("express").Router();
const controller = require("./upload.controller");

// Single image upload and compress
router.post(
  "/compress-image",
  controller.upload.single("image"),
  controller.uploadAndCompressImage
);

// Multiple images upload and compress
router.post(
  "/compress-images",
  controller.upload.array("images", 10), // Max 10 images
  controller.uploadAndCompressImages
);

module.exports = router;
