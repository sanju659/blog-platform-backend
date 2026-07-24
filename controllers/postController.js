const Post = require("./../models/Post");
const fs = require("fs");
const path = require("path");
const { compressAndSaveImage, saveVideo } = require("../utils/imageProcessor");

// Processes uploaded files (images + videos) into { type, url } media objects
const processMediaFiles = async (files) => {
  if (!files || files.length === 0) return [];

  return Promise.all(
    files.map(async (file) => {
      if (file.mimetype.startsWith("video/")) {
        const filename = saveVideo(file.buffer, file.originalname);
        return {
          type: "video",
          url: `${process.env.BASE_URL}/uploads/${filename}`,
        };
      } else {
        const filename = await compressAndSaveImage(file.buffer);
        return {
          type: "image",
          url: `${process.env.BASE_URL}/uploads/${filename}`,
        };
      }
    }),
  );
};

// Create a new post
exports.createPost = async (req, res) => {
  try {
    const { title, content, excerpt, category, published } = req.body;

    const media = await processMediaFiles(req.files);

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
  } catch (error) {
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

    const post = await Post.findOne({
      _id: id,
      isDeleted: false, // Only show non-deleted posts
    }).populate("author", "fullName image");

    if (!post) {
      return res.status(404).json({
        message: "Post not found",
      });
    }

    // If post is a draft, only allow author to view it
    if (!post.published) {
      if (!req.user) {
        return res.status(403).json({
          message: "This post is not published",
        });
      }

      // Who created the post vs Who is making the request right now
      if (post.author._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          message: "This post is not published",
        });
      }
    }

    res.status(200).json(post);
  } catch (error) {
    // console.error(error);

    // if (error.name === "CastError") {
    //   return res.status(400).json({
    //     message: "Invalid post ID",
    //   });
    // }

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

    // Start with current media
    let updatedMedia = post.media || [];

    // Frontend sends which existing media items to KEEP (JSON array of {type, url})
    if (existingMedia !== undefined) {
      let keepMedia = [];
      try {
        keepMedia = JSON.parse(existingMedia);
      } catch (e) {
        keepMedia = updatedMedia; // fallback: keep all if parsing fails
      }

      const keepUrls = keepMedia.map((m) => m.url);

      // Delete files that were removed
      const removedMedia = updatedMedia.filter(
        (m) => !keepUrls.includes(m.url),
      );
      removedMedia.forEach((m) => {
        if (m.url && m.url.includes("uploads/")) {
          const filePath = path.join(
            __dirname,
            "..",
            m.url.replace(`${process.env.BASE_URL}/`, ""),
          );
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      });

      updatedMedia = keepMedia;
    }

    // Append any newly uploaded media
    if (req.files && req.files.length > 0) {
      const newMedia = await processMediaFiles(req.files);
      updatedMedia = [...updatedMedia, ...newMedia];
    }

    // Enforce max 5 items total
    post.media = updatedMedia.slice(0, 5);

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

    res.status(200).json({
      message: "Post updated successfully",
      updatedPost,
    });
  } catch (error) {
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
      post.media.forEach((m) => {
        if (m.url && m.url.includes("uploads/")) {
          const filePath = path.join(
            __dirname,
            "..",
            m.url.replace(`${process.env.BASE_URL}/`, ""),
          );
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      });
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
