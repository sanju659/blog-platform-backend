require("dotenv").config();
const { Worker } = require("bullmq");
const mongoose = require("mongoose");
const fs = require("fs");
const os = require("os");
const path = require("path");
const connection = require("../config/redis");
const Post = require("../models/Post");
const { compressAndSaveVideo } = require("../utils/imageProcessor");
const {
  downloadToFile,
  deleteByKey,
  deleteByUrl,
} = require("../utils/storage");

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Video worker connected to MongoDB"))
  .catch((err) => {
    console.error("Video worker failed to connect to MongoDB:", err.message);
    process.exit(1);
  });

// True if the post still exists AND still contains this media entry
const mediaStillExists = (postId, mediaId) =>
  Post.exists({ _id: postId, "media._id": mediaId });

const worker = new Worker(
  "video-processing",
  async (job) => {
    const { postId, mediaId, rawKey } = job.data;

    if (!rawKey) throw new Error("Job is missing rawKey");

    // Item 8 (before): skip all work if the post/placeholder was removed
    if (!(await mediaStillExists(postId, mediaId))) {
      console.log(
        `Video job ${job.id} skipped: post or media no longer exists`,
      );
      return { skipped: true };
    }

    const inputPath = path.join(
      os.tmpdir(),
      `${job.id}-${Date.now()}-input.tmp`,
    );

    try {
      // Item 5: pull the raw video from S3 (works on any machine)
      await downloadToFile(rawKey, inputPath);

      // Throttle DB writes: at most one progress update per second,
      // or when the percent value actually changed
      let lastUpdate = 0;
      let lastPercent = -1;

      const onProgress = (percent) => {
        const now = Date.now();
        if (percent === lastPercent) return;
        if (now - lastUpdate < 1000 && percent < 100) return;

        lastUpdate = now;
        lastPercent = percent;

        Post.updateOne(
          { _id: postId, "media._id": mediaId },
          { $set: { "media.$.progress": percent } },
        ).catch(() => {});
      };

      // Item 7: pass the file path, no buffer copy
      const videoUrl = await compressAndSaveVideo(inputPath, onProgress);

      const result = await Post.updateOne(
        { _id: postId, "media._id": mediaId },
        {
          $set: {
            "media.$.url": videoUrl,
            "media.$.status": "ready",
            "media.$.progress": null,
          },
        },
      );

      // Item 8 (after): post/media vanished while we were compressing
      if (result.matchedCount === 0) {
        console.log(`Video job ${job.id}: media gone, deleting uploaded file`);
        await deleteByUrl(videoUrl);
        return { orphaned: true };
      }

      return { videoUrl };
    } finally {
      fs.unlink(inputPath, () => {});
    }
  },
  {
    connection,
    concurrency: 2,
  },
);

// Raw temp video is no longer needed once the job finishes (success or skipped)
worker.on("completed", (job) => {
  console.log(`Video job ${job.id} completed`);
  deleteByKey(job.data.rawKey);
});

worker.on("failed", async (job, err) => {
  if (!job) {
    console.error("Video job failed:", err.message);
    return;
  }

  console.error(`Video job ${job.id} failed:`, err.message);

  // Only clean up / mark failed on the final attempt (safe if you add retries later)
  const finalAttempt = job.attemptsMade >= (job.opts.attempts || 1);
  if (!finalAttempt) return;

  const { postId, mediaId, rawKey } = job.data;

  if (postId && mediaId) {
    await Post.updateOne(
      { _id: postId, "media._id": mediaId },
      {
        $set: {
          "media.$.status": "failed",
          "media.$.error": "Video processing failed",
          "media.$.progress": null,
        },
      },
    ).catch(() => {});
  }

  await deleteByKey(rawKey);
});

console.log("Video worker started, waiting for jobs...");
