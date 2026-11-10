const sharp = require("sharp");
const ffmpegPath = require("ffmpeg-static");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { uploadBuffer, uploadFile } = require("./storage");

const uniqueName = () => Date.now() + "-" + Math.round(Math.random() * 1e9);

// Compresses an image and uploads it to S3. Returns the public URL.
const compressAndSaveImage = async (buffer) => {
  const compressed = await sharp(buffer)
    .rotate()
    .resize({
      width: 1920,
      height: 1920,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 75, mozjpeg: true })
    .toBuffer();

  return uploadBuffer(
    compressed,
    `uploads/images/${uniqueName()}.jpeg`,
    "image/jpeg",
  );
};

// Compresses a video file with ffmpeg, uploads the result to S3. Returns the public URL.
// inputPath is owned by the caller (this function does not delete it).
// Calls onProgress(percent) as ffmpeg reports progress.
const compressAndSaveVideo = (inputPath, onProgress) => {
  return new Promise((resolve, reject) => {
    const name = uniqueName();
    const tempOutputPath = path.join(os.tmpdir(), `${name}-output.mp4`);

    const args = [
      "-y",
      "-i",
      inputPath,
      "-c:v",
      "libx264",
      "-crf",
      "26",
      "-preset",
      "veryfast",
      "-vf",
      "scale='min(1920,iw)':'min(1920,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      "-progress",
      "pipe:1",
      "-nostats",
      tempOutputPath,
    ];

    const ffmpegProcess = spawn(ffmpegPath, args);

    let durationSeconds = null;
    let stderrOutput = "";

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

    let stdoutBuffer = "";
    ffmpegProcess.stdout.on("data", (data) => {
      stdoutBuffer += data.toString();

      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith("out_time_ms=") && durationSeconds && onProgress) {
          const outTimeMs = Number(line.split("=")[1]);
          if (!isNaN(outTimeMs)) {
            const elapsedSeconds = outTimeMs / 1_000_000;
            const percent = Math.min(
              Math.round((elapsedSeconds / durationSeconds) * 100),
              99,
            );
            onProgress(percent);
          }
        }
      }
    });

    ffmpegProcess.on("error", (err) => {
      fs.unlink(tempOutputPath, () => {});
      reject(err);
    });

    ffmpegProcess.on("close", async (code) => {
      if (code !== 0) {
        fs.unlink(tempOutputPath, () => {});
        return reject(
          new Error(
            `ffmpeg exited with code ${code}: ${stderrOutput.slice(-500)}`,
          ),
        );
      }

      try {
        const url = await uploadFile(
          tempOutputPath,
          `uploads/videos/${name}.mp4`,
          "video/mp4",
        );
        resolve(url);
      } catch (err) {
        reject(err);
      } finally {
        fs.unlink(tempOutputPath, () => {});
      }
    });
  });
};

module.exports = { compressAndSaveImage, compressAndSaveVideo };
