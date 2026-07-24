const multer = require("multer");

const storage = multer.memoryStorage();

// Allow images and videos, any size
const fileFilter = (req, file, cb) => {
  if (
    file.mimetype.startsWith("image/") ||
    file.mimetype.startsWith("video/")
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only image or video files are allowed"));
  }
};

const upload = multer({
  storage,
  fileFilter,
});

module.exports = upload;
