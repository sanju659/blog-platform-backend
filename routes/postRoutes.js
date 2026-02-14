const express = require("express");
const {
  createPost,
  getAllPosts,
  getPostById,
  getMyPosts,
  updatePost,
  deletePost
} = require("./../controllers/postController");

const protect = require("../middlewares/auth_middle_ware");
const optionalAuth = require("../middlewares/optional_auth");
const upload = require("../config/multerConfig");

const router = express.Router();

// Create post with image upload
router.post("/create", protect, upload.single("image"), createPost);
// Get all published posts (public)
router.get("/allposts", getAllPosts);
// Get posts by the user
router.get("/my-posts", protect, getMyPosts);
// Get single post by ID (optional auth)
router.get("/:id", optionalAuth, getPostById);
// Update post (author only, protected)
router.put("/update/:id", protect, upload.single("image"), updatePost);
// Delete post (author only)
router.delete("/delete/:id", protect, deletePost);

module.exports = router;
