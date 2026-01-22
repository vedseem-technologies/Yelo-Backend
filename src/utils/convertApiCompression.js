/**
 * Image Compression Utility using ConvertAPI
 * This utility compresses images using ConvertAPI service
 * 
 * Installation: npm install convertapi
 * 
 * Environment variable required:
 * CONVERTAPI_TOKEN=your_convertapi_token
 */

const ConvertAPI = require("convertapi");
const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const os = require("os");

// Initialize ConvertAPI with token from environment
let convertapi = null;

function getConvertAPI() {
  if (!convertapi) {
    const token = process.env.CONVERTAPI_TOKEN;
    if (!token) {
      throw new Error("CONVERTAPI_TOKEN environment variable is not set");
    }
    convertapi = new ConvertAPI(token);
  }
  return convertapi;
}

/**
 * Compress image file to WebP format with specified quality
 * @param {string} filePath - Path to the image file to compress
 * @param {number} quality - Quality level 1-100 (default: 30 for high compression)
 * @returns {Promise<Buffer>} Compressed image buffer
 */
async function compressImageFile(filePath, quality = 20) {
  try {
    // Check if file is already WebP - ConvertAPI doesn't support WebP→WebP conversion
    const fileExt = path.extname(filePath).toLowerCase();
    if (fileExt === '.webp') {
    
      return await fs.readFile(filePath);
    }
    
    // Read file to check buffer format
    const fileBuffer = await fs.readFile(filePath);
    if (isWebP(fileBuffer)) {
     
      return fileBuffer;
    }
    
    const api = getConvertAPI();
    const tempDir = os.tmpdir();
    const outputDir = path.join(tempDir, `output-${Date.now()}`);
    const resizeOutputDir = path.join(tempDir, `resize-${Date.now()}`);
    
    try {
      // ConvertAPI Correct Implementation: Two-step process
      // Step A: Resize the image first (max width 800 for 20-30 KB target)
      await fs.mkdir(resizeOutputDir, { recursive: true }).catch(() => {});
      
      let resizedFileUrl = filePath; // Default to original if resize fails
      
      try {
        const resized = await api.convert(
          "resize",
          {
            File: filePath,
            Width: 800, // Max width for aggressive compression (target 20-30 KB)
            MaintainAspectRatio: true
          },
          "jpg" // Output as JPG after resize
        );
        
        const resizedFiles = await resized.saveFiles(resizeOutputDir);
        if (resizedFiles && resizedFiles.length > 0) {
          // Get the URL of the resized file for next step
          if (resized.files && resized.files[0] && resized.files[0].url) {
            resizedFileUrl = resized.files[0].url;
          } else {
            resizedFileUrl = resizedFiles[0]; // Fallback to file path if URL not available
          }
        } else {
          console.log(" Resize step returned no files, using original");
        }
      } catch (resizeError) {
        // If resize fails, use original file for direct conversion
        console.log("Resize step failed, trying direct conversion:", resizeError.message);
      }
      
      // Step B: Convert resized image to WebP with compression
      const result = await api.convert(
        "webp",
        {
          File: resizedFileUrl,
          Quality: quality // Quality 20 for aggressive compression
        },
        "webp"
      );
      
      // Create temp directory for output
      await fs.mkdir(outputDir, { recursive: true }).catch(() => {});
      
      // Get the converted file
      const convertedFiles = await result.saveFiles(outputDir);
      
      if (convertedFiles && convertedFiles.length > 0) {
        // Read the compressed file
        const compressedBuffer = await fs.readFile(convertedFiles[0]);
        
        // Clean up temporary files
        // Clean up resize output directory and files
        try {
          if (fsSync.existsSync(resizeOutputDir)) {
            const resizeFiles = await fs.readdir(resizeOutputDir);
            for (const file of resizeFiles) {
              await fs.unlink(path.join(resizeOutputDir, file)).catch(() => {});
            }
            await fs.rmdir(resizeOutputDir).catch(() => {});
          }
        } catch {}
        
        // Clean up output directory and files
        for (const file of convertedFiles) {
          await fs.unlink(file).catch(() => {});
        }
        await fs.rmdir(outputDir).catch(() => {});
        
        return compressedBuffer;
      }
      
      throw new Error("No file returned from ConvertAPI");
    } catch (error) {
      // Clean up on error
      try {
        // Clean up resize output directory
        if (fsSync.existsSync(resizeOutputDir)) {
          const resizeFiles = await fs.readdir(resizeOutputDir);
          for (const file of resizeFiles) {
            await fs.unlink(path.join(resizeOutputDir, file)).catch(() => {});
          }
          await fs.rmdir(resizeOutputDir).catch(() => {});
        }
        
        // Clean up output directory
        if (fsSync.existsSync(outputDir)) {
          const files = await fs.readdir(outputDir);
          for (const file of files) {
            await fs.unlink(path.join(outputDir, file)).catch(() => {});
          }
          await fs.rmdir(outputDir).catch(() => {});
        }
      } catch {}
      
      // Handle WebP-to-WebP conversion error
      const errorMessage = error.message || String(error);
      if (errorMessage.includes('webp') && errorMessage.includes('File must be a file')) {
        return await fs.readFile(filePath);
      }
      
      // Check error response data
      if (error.response && error.response.data) {
        const errorData = error.response.data;
        if (errorData.Code === 4000 && errorData.InvalidParameters && errorData.InvalidParameters.File) {
          const fileError = Array.isArray(errorData.InvalidParameters.File) 
            ? errorData.InvalidParameters.File[0] 
            : errorData.InvalidParameters.File;
          if (fileError && fileError.includes('webp')) {
            return await fs.readFile(filePath);
          }
        }
      }
      
      throw error;
    }
  } catch (error) {
    // Final catch: if error is about WebP, return original file
    const errorMessage = error.message || String(error);
    if (errorMessage.includes('webp') || errorMessage.includes('WebP')) {
      try {
        return await fs.readFile(filePath);
      } catch (readError) {
        console.error("Error reading original file:", readError);
      }
    }
    
    console.error("Error compressing image with ConvertAPI:", error);
    throw error;
  }
}

/**
 * Detect if buffer is WebP format by checking magic bytes
 * @param {Buffer} buffer - Image buffer to check
 * @returns {boolean} True if buffer is WebP format
 */
function isWebP(buffer) {
  // WebP files start with "RIFF" (4 bytes) + file size (4 bytes) + "WEBP" (4 bytes)
  if (!buffer || buffer.length < 12) return false;
  try {
    const header = buffer.toString('ascii', 0, 4);
    const webpMarker = buffer.toString('ascii', 8, 12);
    return header === 'RIFF' && webpMarker === 'WEBP';
  } catch (error) {
    return false;
  }
}

/**
 * Detect image format from buffer
 * @param {Buffer} buffer - Image buffer to check
 * @returns {string} Image format extension (e.g., '.jpg', '.png', '.webp')
 */
function detectImageFormat(buffer) {
  if (!buffer || buffer.length < 12) return null;
  
  try {
    // Check WebP
    if (isWebP(buffer)) return '.webp';
    
    // Check JPEG (starts with FF D8 FF)
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return '.jpg';
    }
    
    // Check PNG (starts with 89 50 4E 47)
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return '.png';
    }
    
    // Check GIF (starts with GIF87a or GIF89a)
    const gifHeader = buffer.toString('ascii', 0, 6);
    if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') {
      return '.gif';
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Compress image from buffer (useful for uploads)
 * @param {Buffer} imageBuffer - Image buffer to compress
 * @param {string} originalFileName - Original filename (for format detection)
 * @param {number} quality - Quality level 1-100 (default: 20 for aggressive compression)
 * @returns {Promise<Buffer>} Compressed image buffer
 */
async function compressImageBuffer(imageBuffer, originalFileName = "image.jpg", quality = 20) {
  try {
    // CRITICAL: Check if file is already WebP FIRST - ConvertAPI doesn't support WebP→WebP conversion
    const fileExt = path.extname(originalFileName).toLowerCase();
    const detectedFormat = detectImageFormat(imageBuffer);
    
    // If buffer is WebP or filename indicates WebP, return as-is
    if (isWebP(imageBuffer) || fileExt === '.webp' || detectedFormat === '.webp') {
      return imageBuffer; // Return original, no compression needed
    }
    
    // If we can't detect the format and filename doesn't have extension, default to jpg
    const inputFormat = detectedFormat || fileExt || '.jpg';
    
    const api = getConvertAPI();
    const tempDir = os.tmpdir();
    
    // Ensure temp file has correct extension based on detected format
    const baseFileName = originalFileName.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/\.[^/.]+$/, '') || 'image';
    const tempInputPath = path.join(tempDir, `input-${Date.now()}-${Math.random().toString(36).substring(7)}-${baseFileName}${inputFormat}`);
    const tempOutputDir = path.join(tempDir, `output-${Date.now()}`);
    const resizeOutputDir = path.join(tempDir, `resize-${Date.now()}`);
    
    try {
      // Write buffer to temporary file
      await fs.writeFile(tempInputPath, imageBuffer);
      
      // Double-check: Read back and verify it's not WebP before sending to ConvertAPI
      const verifyBuffer = await fs.readFile(tempInputPath);
      if (isWebP(verifyBuffer)) {
        await fs.unlink(tempInputPath).catch(() => {});
        return imageBuffer;
      }
      
      // ConvertAPI Correct Implementation: Two-step process
      // Step A: Resize the image first (max width 800 for 20-30 KB target)
      await fs.mkdir(resizeOutputDir, { recursive: true }).catch(() => {});
      
      let resizedFileUrl = tempInputPath; // Default to original if resize fails
      
      try {
        const resized = await api.convert(
          "resize",
          {
            File: tempInputPath,
            Width: 800, // Max width for aggressive compression (target 20-30 KB)
            MaintainAspectRatio: true
          },
          "jpg" // Output as JPG after resize
        );
        
        const resizedFiles = await resized.saveFiles(resizeOutputDir);
        if (resizedFiles && resizedFiles.length > 0) {
          // Get the URL of the resized file for next step
          // ConvertAPI returns file URLs in the result object
          if (resized.files && resized.files[0] && resized.files[0].url) {
            resizedFileUrl = resized.files[0].url;
          } else {
            resizedFileUrl = resizedFiles[0]; // Fallback to file path if URL not available
          }
        } else {
          console.log("⚠️ Resize step returned no files, using original");
        }
      } catch (resizeError) {
        // If resize fails, use original file for direct conversion
        console.log("⚠️ Resize step failed, trying direct conversion:", resizeError.message);
      }
      
      // Step B: Convert resized image to WebP with compression
      const result = await api.convert(
        "webp",
        {
          File: resizedFileUrl,
          Quality: quality // Quality 20 for aggressive compression
        },
        "webp"
      );
      
      // Create temp directory for output
      await fs.mkdir(tempOutputDir, { recursive: true }).catch(() => {});
      
      // Save converted file
      const convertedFiles = await result.saveFiles(tempOutputDir);
      
      if (convertedFiles && convertedFiles.length > 0) {
        // Read compressed file
        const compressedBuffer = await fs.readFile(convertedFiles[0]);
        
        // Clean up temporary files
        await fs.unlink(tempInputPath).catch(() => {});
        
        // Clean up resize output directory and files
        try {
          if (fsSync.existsSync(resizeOutputDir)) {
            const resizeFiles = await fs.readdir(resizeOutputDir);
            for (const file of resizeFiles) {
              await fs.unlink(path.join(resizeOutputDir, file)).catch(() => {});
            }
            await fs.rmdir(resizeOutputDir).catch(() => {});
          }
        } catch {}
        
        // Clean up final output directory and files
        for (const file of convertedFiles) {
          await fs.unlink(file).catch(() => {});
        }
        await fs.rmdir(tempOutputDir).catch(() => {});
        
        return compressedBuffer;
      }
      
      throw new Error("No file returned from ConvertAPI");
    } catch (error) {
      // Clean up on error
      await fs.unlink(tempInputPath).catch(() => {});
      
      // Clean up resize output directory if it exists
      try {
        if (fsSync.existsSync(resizeOutputDir)) {
          const files = await fs.readdir(resizeOutputDir);
          for (const file of files) {
            await fs.unlink(path.join(resizeOutputDir, file)).catch(() => {});
          }
          await fs.rmdir(resizeOutputDir).catch(() => {});
        }
      } catch {}
      
      // Clean up output directory recursively (compatible with older Node.js)
      try {
        if (fsSync.existsSync(tempOutputDir)) {
          const files = await fs.readdir(tempOutputDir);
          for (const file of files) {
            await fs.unlink(path.join(tempOutputDir, file)).catch(() => {});
          }
          await fs.rmdir(tempOutputDir).catch(() => {});
        }
      } catch {}
      
      // Handle specific WebP-to-WebP conversion error
      const errorMessage = error.message || String(error);
      if (errorMessage.includes('webp') && errorMessage.includes('File must be a file')) {
        return imageBuffer; // Return original buffer if it's already WebP
      }
      
      // Check error response data for WebP-related errors
      if (error.response && error.response.data) {
        const errorData = error.response.data;
        if (errorData.Code === 4000 && errorData.InvalidParameters && errorData.InvalidParameters.File) {
          const fileError = Array.isArray(errorData.InvalidParameters.File) 
            ? errorData.InvalidParameters.File[0] 
            : errorData.InvalidParameters.File;
          if (fileError && fileError.includes('webp')) {
            return imageBuffer; // Return original buffer
          }
        }
      }
      
      throw error;
    }
  } catch (error) {
    // Final catch: if error is about WebP, return original buffer
    const errorMessage = error.message || String(error);
    if (errorMessage.includes('webp') || errorMessage.includes('WebP')) {
      return imageBuffer;
    }
    
    console.error("Error compressing image buffer with ConvertAPI:", error);
    throw error;
  }
}

/**
 * Compress image and return as base64 string
 * @param {Buffer} imageBuffer - Image buffer to compress
 * @param {string} originalFileName - Original filename
 * @param {number} quality - Quality level 1-100 (default: 20 for aggressive compression)
 * @returns {Promise<string>} Base64 encoded compressed image
 */
async function compressImageToBase64(imageBuffer, originalFileName = "image.jpg", quality = 20) {
  try {
    const compressedBuffer = await compressImageBuffer(imageBuffer, originalFileName, quality);
    return compressedBuffer.toString("base64");
  } catch (error) {
    console.error("Error compressing image to base64:", error);
    throw error;
  }
}

module.exports = {
  compressImageFile,
  compressImageBuffer,
  compressImageToBase64,
  getConvertAPI
};
