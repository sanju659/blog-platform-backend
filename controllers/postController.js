const Post = require("./../models/Post");
const fs = require("fs");
const path = require("path");

// Create a new post
exports.createPost = async (req, res) => {
  try {
    const { title, content, excerpt, category, published } = req.body;

    // Basic validation
    if (!title || !content) {
      return res.status(400).json({
        message: "Title and content are required",
      });
    }

    // Get image path from uploaded file (if exists)
    const imagePath = req.file
      ? `http://127.0.0.1:3000/uploads/${req.file.filename}`
      : null;

    const postData = {
      title,
      content,
      excerpt,
      image: imagePath, // Use uploaded image path
      category,
      published: published === "true" || published === true, // Handle string/boolean from FormData
      author: req.user._id,
    };

    // If published, store the publish date
    if (postData.published === true) {
      postData.publishedAt = new Date();
    }

    // Storing the create post data
    const userpost = await Post.create(postData);

    res.status(201).json({
      message: "Post created successfully",
      userpost,
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
    const posts = await Post.find({ published: true }) // filter and take only the published post not the draft one
      .populate("author", "fullName image") // find the user from User collection and get his/her full name and image
      .sort({ createdAt: -1 }); // Newest post first

    res.status(200).json({
      count: posts.length, // total number of posts
      posts, // the post itself is sent as json
    });
  } catch (error) {
    console.error(error);
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
    console.error(error);

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid post ID",
      });
    }

    res.status(500).json({
      message: "Server error",
    });
  }
};

// Get posts by the user
exports.getMyPosts = async (req, res) => {
  try {
    const posts = await Post.find({ author: req.user._id }).sort({
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
    const { title, content, excerpt, category, published } = req.body;

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({
        message: "Post not found",
      });
    }

    // Ownership check
    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "You are not allowed to update this post",
      });
    }

    // Update fields only if provided
    if (title) post.title = title;
    if (content) post.content = content;
    if (excerpt) post.excerpt = excerpt;
    if (category) post.category = category;

    // Handle image upload(This block runs only when replacing the image.)
    if (req.file) {
      // Delete old image if it exists and is stored locally
      if (post.image && post.image.includes("uploads/")) {
        const oldImagePath = path.join(
          __dirname,
          "..",
          post.image.replace("http://127.0.0.1:3000/", ""),
        );
        // Check file exists before deleting
        if (fs.existsSync(oldImagePath)) {
          //Delete the old file
          fs.unlinkSync(oldImagePath);
        }
      }

      // Set new image(Save new image URL)
      post.image = `http://127.0.0.1:3000/uploads/${req.file.filename}`;
    }

    // Handle publish logic
    if (published !== undefined) {
      const isPublished = published === "true" || published === true;

      // Draft --> Published
      if (isPublished && !post.publishedAt) {
        post.publishedAt = new Date();
      }

      // Published --> Draft
      if (!isPublished) {
        post.publishedAt = null;
      }

      // updating the status of 'published' in database
      post.published = isPublished;
    }

    // Saving the whole post in Data Base
    const updatedPost = await post.save();

    res.status(200).json({
      message: "Post updated successfully",
      updatedPost,
    });
  } catch (error) {
    console.error(error);

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid post ID",
      });
    }

    res.status(500).json({
      message: "Server error",
    });
  }
};

// Delete post (author only)
exports.deletePost = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({
        message: "Post not found",
      });
    }

    // Ownership check
    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "You are not allowed to delete this post",
      });
    }

    // Delete image file if it exists and is stored locally
    if (post.image && post.image.includes("uploads/")) {
      const imagePath = path.join(
        __dirname,
        "..",
        post.image.replace("http://127.0.0.1:3000/", ""),
      );
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await post.deleteOne();

    res.status(200).json({
      message: "Post deleted successfully",
    });
  } catch (error) {
    console.error(error);

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid post ID",
      });
    }

    res.status(500).json({
      message: "Server error",
    });
  }
};
