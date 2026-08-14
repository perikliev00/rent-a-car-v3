const sharp = require('sharp');

const CAR_IMAGE_MAX_WIDTH = 1200;
const CAR_IMAGE_JPEG_QUALITY = 82;

function createCarImagePipeline(input) {
  return sharp(input)
    .rotate()
    .resize({ width: CAR_IMAGE_MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: CAR_IMAGE_JPEG_QUALITY });
}

async function reencodeCarImageToBuffer(inputPath) {
  return createCarImagePipeline(inputPath).toBuffer();
}

async function reencodeCarImageToFile(inputPath, outputPath) {
  await createCarImagePipeline(inputPath).toFile(outputPath);
}

module.exports = {
  CAR_IMAGE_MAX_WIDTH,
  CAR_IMAGE_JPEG_QUALITY,
  reencodeCarImageToBuffer,
  reencodeCarImageToFile,
};
