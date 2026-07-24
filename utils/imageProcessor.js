const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const UPLOADS_DIR = path.join(__dirname, "..", "uploads");

// Make sure the uploads folder exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Compresses an image buffer and writes it to /uploads.
 * - Auto-rotates based on EXIF orientation
 * - Resizes down to max 1920x1920 (keeps aspect ratio, never upscales)
 * - Converts to JPEG at quality 75 for a good size/quality tradeoff
 *
 * @param {Buffer} buffer - raw image buffer (from multer memoryStorage)
 * @returns {Promise<string>} filename of the saved, compressed image
 */
const compressAndSaveImage = async (buffer) => {
  const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  const filename = `${uniqueSuffix}.jpeg`;
  const filepath = path.join(UPLOADS_DIR, filename);

  await sharp(buffer)
    .rotate()
    .resize({
      width: 1920,
      height: 1920,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 75, mozjpeg: true })
    .toFile(filepath);

  return filename;
};

module.exports = { compressAndSaveImage };