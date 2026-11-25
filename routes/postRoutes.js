const express = require("express");
const {
  createPost,
  getAllPosts,
  getPostById,
  getMyPosts,
  updatePost,
  deletePost,
  getFeed,
} = require("./../controllers/postController");

const protect = require("../middlewares/auth_middle_ware");
const optionalAuth = require("../middlewares/optional_auth");
const upload = require("../config/multerConfig");
const {
  validateCreatePost,
  validateUpdatePost,
  validatePostId,
  validateSetReaction,
} = require("../validators/postValidator");
const blockAdmin = require("../middlewares/blockAdmin");
const { reactionLimiter } = require("../middlewares/rateLimiter");
const {
  getReactions,
  setReaction,
  removeReaction,
} = require("../controllers/reactionController");

const router = express.Router();

// Create post with image upload
router.post(
  "/create",
  protect,
  upload.array("media", 10),
  validateCreatePost,
  createPost,
);
// Get all published posts (public)
router.get("/allposts", getAllPosts);
// Get posts by the user
router.get("/my-posts", protect, getMyPosts);
// Following feed (must stay above "/:id")
router.get("/feed", protect, blockAdmin, getFeed);
// Get single post by ID (optional auth)
router.get("/:id", optionalAuth, validatePostId, getPostById);
// Update post (author only, protected)
router.put(
  "/update/:id",
  protect,
  upload.array("media", 10),
  validateUpdatePost,
  updatePost,
);
// Delete post (author only)
router.delete("/delete/:id", protect, validatePostId, deletePost);

// Reactions (read is public, writes need a normal active user)
router.get("/:id/reactions", optionalAuth, validatePostId, getReactions);
router.post(
  "/:id/reactions",
  protect,
  blockAdmin,
  reactionLimiter,
  validateSetReaction,
  setReaction,
);
router.delete(
  "/:id/reactions",
  protect,
  blockAdmin,
  reactionLimiter,
  validatePostId,
  removeReaction,
);

module.exports = router;
