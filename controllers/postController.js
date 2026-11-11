const Post = require("./../models/Post");
const mongoose = require("mongoose");
const videoQueue = require("../queues/videoQueue");

const {
  deleteByUrl,
  uploadTempBuffer,
  deleteByKey,
} = require("../utils/storage");

const { compressAndSaveImage } = require("../utils/imageProcessor");

// Processes uploaded files (images + videos) into { type, url } media objects
// const processMediaFiles = async (files) => {
//   if (!files || files.length === 0) return [];

//   return Promise.all(
//     files.map(async (file) => {
//       if (file.mimetype.startsWith("video/")) {
//         const filename = await compressAndSaveVideo(
//           file.buffer,
//           file.originalname,
//         );
//         return {
//           type: "video",
//           url: `${process.env.BASE_URL}/uploads/${filename}`,
//         };
//       } else {
//         const filename = await compressAndSaveImage(file.buffer);
//         return {
//           type: "image",
//           url: `${process.env.BASE_URL}/uploads/${filename}`,
//         };
//       }
//     }),
//   );
// };

const buildVideoPlaceholder = () => ({
  _id: new mongoose.Types.ObjectId(),
  type: "video",
  url: null,
  status: "processing",
});

const processImageFiles = async (files) => {
  return Promise.all(
    files.map(async (file) => {
      const url = await compressAndSaveImage(file.buffer);
      return {
        type: "image",
        url,
        status: "ready",
      };
    }),
  );
};

// Writes the video buffer to a temp file and enqueues a compression job.
// Passing a file path (not the raw buffer) keeps Redis job payloads small.
const markVideoFailed = (postId, mediaId) =>
  Post.updateOne(
    { _id: postId, "media._id": mediaId },
    {
      $set: {
        "media.$.status": "failed",
        "media.$.error": "Video processing failed",
        "media.$.progress": null,
      },
    },
  ).catch(() => {});

// Uploads raw video to private S3 storage and enqueues compression job.
const enqueueVideoJob = async (postId, mediaId, buffer, mimetype) => {
  const rawKey = `tmp/raw/${Date.now()}-${Math.round(Math.random() * 1e9)}.tmp`;

  try {
    // 1. Upload raw video to private S3 storage
    await uploadTempBuffer(buffer, rawKey, mimetype);

    // 2. Enqueue job with S3 key instead of local file path
    await videoQueue.add("compress-video", {
      postId: postId.toString(),
      mediaId: mediaId.toString(),
      rawKey,
    });
  } catch (err) {
    console.error("Failed to enqueue video job:", err.message);

    // 3. Clean up raw S3 object if upload succeeded
    await deleteByKey(rawKey);

    // 4. Mark media as failed
    await markVideoFailed(postId, mediaId);
  }
};

// Create a new post
exports.createPost = async (req, res) => {
  try {
    const { title, content, excerpt, category, published } = req.body;

    const files = req.files || [];
    const imageFiles = files.filter((f) => f.mimetype.startsWith("image/"));
    const videoFiles = files.filter((f) => f.mimetype.startsWith("video/"));

    const imageMedia = await processImageFiles(imageFiles);
    const videoPlaceholders = videoFiles.map(() => buildVideoPlaceholder());

    const media = [...imageMedia, ...videoPlaceholders].slice(0, 5);

    const postData = {
      title,
      content,
      excerpt,
      media,
      category,
      published: published === "true" || published === true,
      author: req.user._id,
    };

    if (postData.published === true) {
      postData.publishedAt = new Date();
    }

    const userpost = await Post.create(postData);

    res.status(201).json({
      message: "Post created successfully",
      userpost,
    });

    // Enqueue background compression jobs for each video that made it into the final media array
    videoFiles.forEach((file, idx) => {
      const placeholder = videoPlaceholders[idx];

      if (userpost.media.id(placeholder._id)) {
        enqueueVideoJob(
          userpost._id,
          placeholder._id,
          file.buffer,
          file.mimetype,
        ).catch(console.error);
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
    });
  }
};

// Get all published posts
exports.getAllPosts = async (req, res) => {
  try {
    const posts = await Post.find({
      published: true,
      isDeleted: false, // Only show non-deleted posts
    })
      .populate("author", "fullName image")
      .sort({ createdAt: -1 });

    res.status(200).json({
      count: posts.length, // total number of posts
      posts, // the post itself is sent as json
    });
  } catch (error) {
    // console.error(error);
    res.status(500).json({
      message: "Server error",
    });
  }
};

// Get single post by ID
exports.getPostById = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await Post.findById(id).populate("author", "fullName image");

    if (!post) {
      return res.status(404).json({
        message: "Post not found",
      });
    }

    // Soft-deleted posts are only visible to admins
    if (post.isDeleted) {
      if (!req.user || req.user.role !== "admin") {
        return res.status(404).json({
          message: "Post not found",
        });
      }
    }

    // If post is a draft, only allow author to view it
    if (!post.published) {
      if (!req.user) {
        return res.status(403).json({
          message: "This post is not published",
        });
      }

      if (post.author._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          message: "This post is not published",
        });
      }
    }

    res.status(200).json(post);
  } catch (error) {
    res.status(500).json({
      message: "Server error",
    });
  }
};

// Get posts by the user
exports.getMyPosts = async (req, res) => {
  try {
    const posts = await Post.find({
      author: req.user._id,
      isDeleted: false, // Only show non-deleted posts
    }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      count: posts.length,
      posts,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update post (author only)
exports.updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, excerpt, category, published, existingMedia } =
      req.body;

    const post = await Post.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!post) {
      return res.status(404).json({
        message: "Post not found",
      });
    }

    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "You are not allowed to update this post",
      });
    }

    if (title) post.title = title;
    if (content) post.content = content;
    if (excerpt) post.excerpt = excerpt;
    if (category) post.category = category;

    // Start from the post's REAL media (from the DB), never from client data
    let updatedMedia = post.media.map((m) => m.toObject());
    let removedMedia = [];

    if (existingMedia !== undefined) {
      let clientMedia;
      try {
        clientMedia = JSON.parse(existingMedia);
      } catch (e) {
        return res
          .status(400)
          .json({ message: "Invalid existingMedia format" });
      }

      if (!Array.isArray(clientMedia)) {
        return res
          .status(400)
          .json({ message: "existingMedia must be an array" });
      }

      // The client only tells us WHICH existing items to keep (by _id or url).
      // We never copy objects from the client.
      const keepIds = new Set(
        clientMedia
          .map((m) => m?._id)
          .filter(Boolean)
          .map(String),
      );
      const keepUrls = new Set(clientMedia.map((m) => m?.url).filter(Boolean));

      const isKept = (m) =>
        keepIds.has(String(m._id)) || (m.url && keepUrls.has(m.url));

      removedMedia = updatedMedia.filter((m) => !isKept(m));
      updatedMedia = updatedMedia.filter(isKept);
    }

    const files = req.files || [];
    const imageFiles = files.filter((f) => f.mimetype.startsWith("image/"));
    const videoFiles = files.filter((f) => f.mimetype.startsWith("video/"));

    const imageMedia = await processImageFiles(imageFiles);
    const videoPlaceholders = videoFiles.map(() => buildVideoPlaceholder());

    updatedMedia = [...updatedMedia, ...imageMedia, ...videoPlaceholders].slice(
      0,
      5,
    );
    post.media = updatedMedia;

    if (published !== undefined) {
      const isPublished = published === "true" || published === true;

      if (isPublished && !post.publishedAt) {
        post.publishedAt = new Date();
      }
      if (!isPublished) {
        post.publishedAt = null;
      }
      post.published = isPublished;
    }

    const updatedPost = await post.save();

    // Delete removed files only AFTER the DB save succeeded
    await Promise.all(removedMedia.map((m) => deleteByUrl(m.url)));

    res.status(200).json({
      message: "Post updated successfully",
      updatedPost,
    });

    videoFiles.forEach((file, idx) => {
      const placeholder = videoPlaceholders[idx];

      if (updatedPost.media.id(placeholder._id)) {
        enqueueVideoJob(
          updatedPost._id,
          placeholder._id,
          file.buffer,
          file.mimetype,
        ).catch(console.error);
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
    });
  }
};

// Delete post (author only)
exports.deletePost = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await Post.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!post) {
      return res.status(404).json({
        message: "Post not found",
      });
    }

    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "You are not allowed to delete this post",
      });
    }

    // Delete all image files
    // Delete all media files (images + videos)
    if (post.media && post.media.length > 0) {
      await Promise.all(post.media.map((m) => deleteByUrl(m.url)));
    }

    await post.deleteOne();

    res.status(200).json({
      message: "Post deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
    });
  }
};
