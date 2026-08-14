const { upload } = require('./upload');
const { adminUploadLimiter } = require('./rateLimit');
const { handleMulterError } = require('./fileUpload/handleMulterError');
const { handleFileRejected } = require('./fileUpload/handleFileRejected');
const {
  validateUploadedImage,
  validateUploadedImages,
} = require('./fileUpload/validateUploadedImage');

const adminCarImageUpload = [
  adminUploadLimiter,
  upload.single('image'),
  handleMulterError,
  handleFileRejected,
  validateUploadedImage,
];

const adminCarDocumentUpload = [
  adminUploadLimiter,
  upload.single('file'),
  handleMulterError,
  handleFileRejected,
  validateUploadedImage,
];

const adminCarDamagePhotosUpload = [
  adminUploadLimiter,
  upload.array('photos', 5),
  handleMulterError,
  handleFileRejected,
  validateUploadedImages,
];

module.exports = {
  adminCarImageUpload,
  adminCarDocumentUpload,
  adminCarDamagePhotosUpload,
};
