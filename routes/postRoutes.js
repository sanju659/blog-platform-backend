const express = require("express");
const {
  createPost,
  getAllPosts,
  getPostById,
  getPostsByUserId,
  updatePost,
  deletePost
} = require("./../controllers/postController");

const protect = require("../middlewares/auth_middle_ware");

const router = express.Router();

// Create post (protected route to create a project)
router.post("/create", protect, createPost);
// Get all published posts (public)
router.get("/allposts", getAllPosts);
// Get single post by ID (public)
router.get("/:id", getPostById);
// Get posts by user ID
router.get("/user/:userId", getPostsByUserId);
// Update post (author only, protected)
router.put("/update/:id", protect, updatePost);
// Delete post (author only)
router.delete("/delete/:id", protect, deletePost);

module.exports = router;
