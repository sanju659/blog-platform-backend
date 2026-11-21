const express = require("express");
const protect = require("../middlewares/auth_middle_ware");
const optionalAuth = require("../middlewares/optional_auth");
const { followLimiter } = require("../middlewares/rateLimiter");
const {
  getPublicProfile,
  getUserPosts,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
} = require("../controllers/userController");

const router = express.Router();

// Public. optionalAuth only lets us tell whether the viewer is the owner/an admin.
router.get("/:username", optionalAuth, getPublicProfile);
router.get("/:username/posts", optionalAuth, getUserPosts);
router.get("/:username/followers", optionalAuth, getFollowers);
router.get("/:username/following", optionalAuth, getFollowing);

// Logged-in only
router.post("/:username/follow", protect, followLimiter, followUser);
router.delete("/:username/follow", protect, followLimiter, unfollowUser);

module.exports = router;
