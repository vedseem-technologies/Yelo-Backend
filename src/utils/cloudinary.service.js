const { cloudinary, config } = require('../config/cloudinary.config');
const streamifier = require('streamifier');

async function uploadSingle(buffer, options = {}) {
  const {
    folder = config.folder,
    filename,
    resourceType = 'image',
    transformation = {
      quality: 'auto',
      fetch_format: 'auto',
      width: 1200,
      crop: 'limit'
    }
  } = options;


  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        transformation,
        public_id: filename,
        use_filename: filename ? true : false,
        unique_filename: !filename
      },
      (error, result) => {
        if (error) {
          console.error(' Cloudinary upload failed:', error.message);
          return reject(error);
        }

     

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          format: result.format,
          width: result.width,
          height: result.height,
          bytes: result.bytes,
          createdAt: result.created_at
        });
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

async function uploadMultiple(buffers, options = {}) {
  const {
    folder = config.folder,
    filenames = []
  } = options;


  const uploadPromises = buffers.map((buffer, index) => {
    const filename = filenames[index];
    return uploadSingle(buffer, { folder, filename })
      .then(result => {
      
        return result;
      })
      .catch(error => {
        console.error(` Image ${index + 1}/${buffers.length} upload failed:`, error.message);
        return {
          error: error.message,
          index
        };
      });
  });

  const results = await Promise.all(uploadPromises);

  const successful = results.filter(r => !r.error);
  const failed = results.filter(r => r.error);

  if (failed.length > 0) {
    console.log(` Failed uploads: ${failed.length}`);
  }

  return results;
}

async function deleteImage(publicId) {

  try {
    const result = await cloudinary.uploader.destroy(publicId);

    if (result.result === 'ok') {
      return { success: true, publicId };
    } else {
      return { success: false, publicId, result: result.result };
    }
  } catch (error) {
    console.error(` Error deleting image:`, error.message);
    throw error;
  }
}

function generateSignedUrl(publicId, options = {}) {
  const {
    expiresIn = 3600,
    transformation = {}
  } = options;

  const timestamp = Math.floor(Date.now() / 1000) + expiresIn;

  const signedUrl = cloudinary.url(publicId, {
    sign_url: true,
    expires_at: timestamp,
    transformation,
    secure: true
  });

  console.log(` Generated signed URL for: ${publicId}`);
  console.log(`Expires at: ${new Date(timestamp * 1000).toISOString()}`);

  return signedUrl;
}

module.exports = {
  uploadSingle,
  uploadMultiple,
  deleteImage,
  generateSignedUrl
};
