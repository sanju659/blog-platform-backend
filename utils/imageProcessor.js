const sharp = require("sharp");
const ffmpegPath = require("ffmpeg-static");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const UPLOADS_DIR = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

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

/**
 * Compresses a video buffer by spawning the ffmpeg binary directly.
 * - Transcodes to H.264/MP4 (broad browser compatibility)
 * - Caps resolution at 1080p (never upscales smaller videos)
 * - CRF 28 = noticeably smaller file, still solid quality for web playback
 * - Downmixes audio to AAC 128k
 *
 * @param {Buffer} buffer - raw video buffer (from multer memoryStorage)
 * @returns {Promise<string>} filename of the saved, compressed video
 */
const compressAndSaveVideo = (buffer) => {
  return new Promise((resolve, reject) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);

    // ffmpeg needs an actual file to read from, so write the buffer to a temp file first
    const tempInputPath = path.join(os.tmpdir(), `${uniqueSuffix}-input.tmp`);
    const outputFilename = `${uniqueSuffix}.mp4`;
    const outputPath = path.join(UPLOADS_DIR, outputFilename);

    fs.writeFileSync(tempInputPath, buffer);

    const args = [
      "-y",
      "-i",
      tempInputPath,

      // Video
      "-c:v",
      "libx264",
      "-crf",
      "26",
      "-preset",
      "veryfast",

      // Maximum 1080p, preserve aspect ratio, never upscale
      "-vf",
      "scale=1920:1080:force_original_aspect_ratio=decrease",

      // Audio
      "-c:a",
      "aac",
      "-b:a",
      "128k",

      // Web-friendly MP4
      "-movflags",
      "+faststart",

      outputPath,
    ];

    const ffmpegProcess = spawn(ffmpegPath, args);

    // Capture FFmpeg's error/output information
    let stderrOutput = "";
    ffmpegProcess.stderr.on("data", (data) => {
      stderrOutput += data.toString();
    });

    // Handle FFmpeg failing to start
    ffmpegProcess.on("error", (err) => {
      fs.unlink(tempInputPath, () => {});
      reject(err);
    });

    // This part runs after FFmpeg finishes.
    // Its job is to clean up the temporary file and tell
    // your Promise whether the compression succeeded or failed.
    ffmpegProcess.on("close", (code) => {
      fs.unlink(tempInputPath, () => {}); // cleanup temp file, ignore errors

      if (code === 0) {
        resolve(outputFilename);
      } else {
        reject(
          new Error(
            `ffmpeg exited with code ${code}: ${stderrOutput.slice(-500)}`,
          ),
        );
      }
    });
  });
};

module.exports = { compressAndSaveImage, compressAndSaveVideo };
