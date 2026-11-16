const express = require("express");
const optionalAuth = require("../middlewares/optional_auth");
const {
  getPublicProfile,
  getUserPosts,
} = require("../controllers/userController");

const router = express.Router();

// Public. optionalAuth only lets us tell whether the viewer is the owner/an admin.
router.get("/:username", optionalAuth, getPublicProfile);
router.get("/:username/posts", optionalAuth, getUserPosts);

module.exports = router;
