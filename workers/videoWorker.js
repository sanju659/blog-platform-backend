require("dotenv").config();
const { Worker } = require("bullmq");
const mongoose = require("mongoose");
const fs = require("fs");
const connection = require("../config/redis");
const Post = require("../models/Post");
const { compressAndSaveVideo } = require("../utils/imageProcessor");

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Video worker connected to MongoDB"))
  .catch((err) => {
    console.error("Video worker failed to connect to MongoDB:", err.message);
    process.exit(1);
  });

const worker = new Worker(
  "video-processing",
  async (job) => {
    const { postId, mediaId, tempPath } = job.data;

    const buffer = fs.readFileSync(tempPath);

    // Throttle DB writes — only push a progress update at most once per second,
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

    const videoUrl = await compressAndSaveVideo(buffer, onProgress);

    fs.unlink(tempPath, () => {});

    await Post.updateOne(
      { _id: postId, "media._id": mediaId },
      {
        $set: {
          "media.$.url": videoUrl,
          "media.$.status": "ready",
          "media.$.progress": null,
        },
      },
    );

    return { videoUrl };
  },
  {
    connection,
    concurrency: 2,
  },
);

worker.on("completed", (job) => {
  console.log(`Video job ${job.id} completed`);
});

worker.on("failed", async (job, err) => {
  console.error(`Video job ${job.id} failed:`, err.message);

  if (job?.data?.postId && job?.data?.mediaId) {
    await Post.updateOne(
      { _id: job.data.postId, "media._id": job.data.mediaId },
      {
        $set: {
          "media.$.status": "failed",
          "media.$.error": "Video processing failed",
          "media.$.progress": null,
        },
      },
    ).catch(() => {});

    if (job.data.tempPath) {
      fs.unlink(job.data.tempPath, () => {});
    }
  }
});

console.log("Video worker started, waiting for jobs...");
