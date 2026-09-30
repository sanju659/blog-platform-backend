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

const compressAndSaveVideo = (buffer, onProgress) => {
  return new Promise((resolve, reject) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);

    const tempInputPath = path.join(os.tmpdir(), `${uniqueSuffix}-input.tmp`);
    const outputFilename = `${uniqueSuffix}.mp4`;
    const outputPath = path.join(UPLOADS_DIR, outputFilename);

    fs.writeFileSync(tempInputPath, buffer);

    const args = [
      "-y",
      "-i",
      tempInputPath,
      "-c:v",
      "libx264",
      "-crf",
      "26",
      "-preset",
      "veryfast",
      "-vf",
      "scale=1920:1080:force_original_aspect_ratio=decrease",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      "-progress",
      "pipe:1", // stream machine-readable progress lines to stdout
      "-nostats",
      outputPath,
    ];

    const ffmpegProcess = spawn(ffmpegPath, args);

    let durationSeconds = null;
    let stderrOutput = "";

    // ffmpeg prints "Duration: HH:MM:SS.ms" once near the start, in stderr
    ffmpegProcess.stderr.on("data", (data) => {
      const chunk = data.toString();
      stderrOutput += chunk;

      if (durationSeconds === null) {
        const match = chunk.match(/Duration:\s(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        if (match) {
          const [, hours, minutes, seconds] = match;
          durationSeconds =
            Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
        }
      }
    });

    // -progress pipe:1 writes key=value lines to stdout as it encodes
    let stdoutBuffer = "";
    ffmpegProcess.stdout.on("data", (data) => {
      stdoutBuffer += data.toString();

      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop(); // keep any incomplete trailing line for next chunk

      for (const line of lines) {
        if (line.startsWith("out_time_ms=") && durationSeconds && onProgress) {
          const outTimeMs = Number(line.split("=")[1]);
          if (!isNaN(outTimeMs)) {
            const elapsedSeconds = outTimeMs / 1_000_000; // ffmpeg's field is actually microseconds
            const percent = Math.min(
              Math.round((elapsedSeconds / durationSeconds) * 100),
              99, // cap at 99 until we get the final "end" signal
            );
            onProgress(percent);
          }
        }

        if (line === "progress=end" && onProgress) {
          onProgress(100);
        }
      }
    });

    ffmpegProcess.on("error", (err) => {
      fs.unlink(tempInputPath, () => {});
      reject(err);
    });

    ffmpegProcess.on("close", (code) => {
      fs.unlink(tempInputPath, () => {});

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
