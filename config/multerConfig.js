const multer = require("multer");

// Store files in memory as buffers — we compress with Sharp before writing to disk
const storage = multer.memoryStorage();

// Only allow images, any size — Sharp will validate/handle the actual image data
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"));
  }
};

const upload = multer({
  storage,
  fileFilter,
  // No fileSize limit — any size is accepted as long as it's an image
});

module.exports = upload;