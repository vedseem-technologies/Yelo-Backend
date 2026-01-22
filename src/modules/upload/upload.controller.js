/**
 * Image Upload Controller with Compression
 * Handles image uploads with automatic compression using ConvertAPI
 */

const multer = require("multer");
const { compressImageBuffer, compressImageToBase64 } = require("../../utils/convertApiCompression");

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit (increased from 10MB)
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  }
});

/**
 * Upload and compress single image
 * POST /api/upload/compress-image
 */
exports.uploadAndCompressImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided"
      });
    }

    const { quality = 20 } = req.body; // Default quality 20 for aggressive compression (target 20-30 KB)
    const qualityNum = parseInt(quality, 10);

    if (isNaN(qualityNum) || qualityNum < 1 || qualityNum > 100) {
      return res.status(400).json({
        success: false,
        message: "Quality must be a number between 1 and 100"
      });
    }

    // Compress the image
    const compressedBase64 = await compressImageToBase64(
      req.file.buffer,
      req.file.originalname,
      qualityNum
    );

    // Sanitize and validate base64 before converting to buffer
    let sanitizedBase64 = compressedBase64.trim().replace(/\s/g, '');
    
    // Validate base64 format
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(sanitizedBase64)) {
      throw new Error('Invalid base64 format returned from compression');
    }
    
    // Ensure proper padding
    const remainder = sanitizedBase64.length % 4;
    if (remainder !== 0) {
      sanitizedBase64 += '='.repeat(4 - remainder);
    }
    
    // Safely convert to buffer to check size
    let buffer;
    try {
      buffer = Buffer.from(sanitizedBase64, "base64");
    } catch (error) {
      throw new Error(`Failed to convert base64 to buffer: ${error.message}`);
    }
    
    const compressedSize = buffer.length;
    const compressedSizeKB = (compressedSize / 1024).toFixed(2);
    const originalSizeKB = (req.file.size / 1024).toFixed(2);

    // Return compressed image as base64 (use sanitized version)
    res.json({
      success: true,
      data: {
        base64: sanitizedBase64, // Use sanitized base64
        mimeType: "image/webp",
        originalName: req.file.originalname,
        originalSize: req.file.size,
        originalSizeKB: originalSizeKB,
        compressedSize: compressedSize,
        compressedSizeKB: compressedSizeKB,
        compressionRatio: ((1 - compressedSize / req.file.size) * 100).toFixed(2) + "%"
      }
    });
  } catch (error) {
    console.error("Error uploading and compressing image:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to compress image"
    });
  }
};

/**
 * Upload and compress multiple images
 * POST /api/upload/compress-images
 */
exports.uploadAndCompressImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No image files provided"
      });
    }

    const { quality = 20 } = req.body; // Default quality 20 for aggressive compression (target 20-30 KB)
    const qualityNum = parseInt(quality, 10);

    if (isNaN(qualityNum) || qualityNum < 1 || qualityNum > 100) {
      return res.status(400).json({
        success: false,
        message: "Quality must be a number between 1 and 100"
      });
    }

    // Compress all images in parallel
    const compressionPromises = req.files.map(file =>
      compressImageToBase64(file.buffer, file.originalname, qualityNum)
        .then(base64 => {
          // Sanitize and validate base64
          let sanitizedBase64 = base64.trim().replace(/\s/g, '');
          
          // Validate base64 format
          if (!/^[A-Za-z0-9+/]*={0,2}$/.test(sanitizedBase64)) {
            throw new Error('Invalid base64 format returned from compression');
          }
          
          // Ensure proper padding
          const remainder = sanitizedBase64.length % 4;
          if (remainder !== 0) {
            sanitizedBase64 += '='.repeat(4 - remainder);
          }
          
          // Safely convert to buffer
          let buffer;
          try {
            buffer = Buffer.from(sanitizedBase64, "base64");
          } catch (error) {
            throw new Error(`Failed to convert base64 to buffer: ${error.message}`);
          }
          
          return {
            base64: sanitizedBase64,
            mimeType: "image/webp",
            originalName: file.originalname,
            originalSize: file.size,
            compressedSize: buffer.length,
            compressionRatio: ((1 - buffer.length / file.size) * 100).toFixed(2) + "%"
          };
        })
        .catch(error => ({
          error: error.message,
          originalName: file.originalname
        }))
    );

    const results = await Promise.all(compressionPromises);

    res.json({
      success: true,
      data: results,
      total: results.length,
      successful: results.filter(r => !r.error).length,
      failed: results.filter(r => r.error).length
    });
  } catch (error) {
    console.error("Error uploading and compressing images:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to compress images"
    });
  }
};

// Export multer middleware for use in routes
exports.upload = upload;
