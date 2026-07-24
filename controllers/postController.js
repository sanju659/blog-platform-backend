const Post = require("./../models/Post");
const fs = require("fs");
const path = require("path");
const { compressAndSaveImage } = require("../utils/imageProcessor");

// Create a new post
exports.createPost = async (req, res) => {
  try {
    const { title, content, excerpt, category, published } = req.body;

    // Compress and save each uploaded image, then build URLs
    let imagePaths = [];
    if (req.files && req.files.length > 0) {
      imagePaths = await Promise.all(
        req.files.map(async (file) => {
          const filename = await compressAndSaveImage(file.buffer);
          return `${process.env.BASE_URL}/uploads/${filename}`;
        }),
      );
    }

    const postData = {
      title,
      content,
      excerpt,
      images: imagePaths,
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
    const { title, content, excerpt, category, published, existingImages } =
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

    // Start with current images
    let updatedImages = post.images || [];

    // Frontend sends which existing image URLs to KEEP (as a JSON string array)
    if (existingImages !== undefined) {
      let keepImages = [];
      try {
        keepImages = JSON.parse(existingImages);
      } catch (e) {
        keepImages = updatedImages; // fallback: keep all if parsing fails
      }

      // Delete files that were removed
      const removedImages = updatedImages.filter(
        (img) => !keepImages.includes(img),
      );
      removedImages.forEach((img) => {
        if (img && img.includes("uploads/")) {
          const imgPath = path.join(
            __dirname,
            "..",
            img.replace(`${process.env.BASE_URL}/`, ""),
          );
          if (fs.existsSync(imgPath)) {
            fs.unlinkSync(imgPath);
          }
        }
      });

      updatedImages = keepImages;
    }

    // Append any newly uploaded images
    if (req.files && req.files.length > 0) {
      const newImagePaths = await Promise.all(
        req.files.map(async (file) => {
          const filename = await compressAndSaveImage(file.buffer);
          return `${process.env.BASE_URL}/uploads/${filename}`;
        }),
      );
      updatedImages = [...updatedImages, ...newImagePaths];
    }

    // Enforce max 5 images
    post.images = updatedImages.slice(0, 5);

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
    if (post.images && post.images.length > 0) {
      post.images.forEach((img) => {
        if (img && img.includes("uploads/")) {
          const imgPath = path.join(
            __dirname,
            "..",
            img.replace(`${process.env.BASE_URL}/`, ""),
          );
          if (fs.existsSync(imgPath)) {
            fs.unlinkSync(imgPath);
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
