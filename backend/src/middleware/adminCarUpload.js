const { upload } = require('./upload');
const { adminUploadLimiter } = require('./rateLimit');
const { handleMulterError } = require('./fileUpload/handleMulterError');
const { handleFileRejected } = require('./fileUpload/handleFileRejected');
const {
  validateUploadedImage,
  validateUploadedImages,
} = require('./fileUpload/validateUploadedImage');
const { adminPrivateDocumentUpload } = require('./privateUpload');

const adminCarImageUpload = [
  adminUploadLimiter,
  upload.single('image'),
  handleMulterError,
  handleFileRejected,
  validateUploadedImage,
];

const adminCarDocumentUpload = adminPrivateDocumentUpload;

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
