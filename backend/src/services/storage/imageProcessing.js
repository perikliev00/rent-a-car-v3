/**
 * Sharp pipelines for car listing images: auto-orient, cap width, re-encode JPEG.
 * Keeps upload sizes predictable before storing to local/S3 public storage.
 */
const sharp = require('sharp');

const CAR_IMAGE_MAX_WIDTH = 1200;
const CAR_IMAGE_JPEG_QUALITY = 82;

/**
 * Insert car image pipeline and return the mapped result.
 * @param {*} input
 * @returns {*}
 */
function createCarImagePipeline(input) {
  return sharp(input)
    .rotate()
    .resize({ width: CAR_IMAGE_MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: CAR_IMAGE_JPEG_QUALITY });
}

/**
 * reencode car image to buffer.
 * @param {*} inputPath
 * @returns {Promise<*>}
 */
async function reencodeCarImageToBuffer(inputPath) {
  return createCarImagePipeline(inputPath).toBuffer();
}

/**
 * reencode car image to file.
 * @param {*} inputPath
 * @param {*} outputPath
 * @returns {Promise<*>}
 */
async function reencodeCarImageToFile(inputPath, outputPath) {
  await createCarImagePipeline(inputPath).toFile(outputPath);
}

module.exports = {
  CAR_IMAGE_MAX_WIDTH,
  CAR_IMAGE_JPEG_QUALITY,
  reencodeCarImageToBuffer,
  reencodeCarImageToFile,
};
