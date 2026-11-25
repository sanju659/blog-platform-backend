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

const { commentLimiter } = require("../middlewares/rateLimiter");
const { validateCreateComment } = require("../validators/commentValidator");
const {
  getComments,
  createComment,
} = require("../controllers/commentController");

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

// Comments (read is public, writing needs a normal active user)
router.get("/:id/comments", optionalAuth, validatePostId, getComments);
router.post(
  "/:id/comments",
  protect,
  blockAdmin,
  commentLimiter,
  validateCreateComment,
  createComment,
);

module.exports = router;
