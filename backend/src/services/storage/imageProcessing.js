/**
 * Sharp pipelines for car listing images: auto-orient, cap width, re-encode JPEG.
 * Keeps upload sizes predictable before storing to local/S3 public storage.
 */
const sharp = require('sharp');

// Create the car image max width constant.
const CAR_IMAGE_MAX_WIDTH = 1200;
// Create the car image jpeg quality constant.
const CAR_IMAGE_JPEG_QUALITY = 82;

/**
 * Insert car image pipeline and return the mapped result.
 * @param {*} input
 * @returns {*}
 */
function createCarImagePipeline(input) {
  // Return the resulting value to the caller.
  return sharp(input)
    // Call .rotate to perform this step.
    .rotate()
    // Call .resize to perform this step.
    .resize({ width: CAR_IMAGE_MAX_WIDTH, withoutEnlargement: true })
    // Call .jpeg to perform this step.
    .jpeg({ quality: CAR_IMAGE_JPEG_QUALITY });
}

/**
 * reencode car image to buffer.
 * @param {*} inputPath
 * @returns {Promise<*>}
 */
async function reencodeCarImageToBuffer(inputPath) {
  // Return the resulting value to the caller.
  return createCarImagePipeline(inputPath).toBuffer();
}

/**
 * reencode car image to file.
 * @param {*} inputPath
 * @param {*} outputPath
 * @returns {Promise<*>}
 */
async function reencodeCarImageToFile(inputPath, outputPath) {
  // Wait until the asynchronous operation resolves.
  await createCarImagePipeline(inputPath).toFile(outputPath);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  CAR_IMAGE_MAX_WIDTH,
  // Contribute this line to the enclosing declaration or statement.
  CAR_IMAGE_JPEG_QUALITY,
  // Contribute this line to the enclosing declaration or statement.
  reencodeCarImageToBuffer,
  // Contribute this line to the enclosing declaration or statement.
  reencodeCarImageToFile,
};
