const express = require("express");
const { createPost, getAllPosts } = require("./../controllers/postController");

const protect = require("../middlewares/auth_middle_ware");

const router = express.Router();

// Create post (protected route to create a project)
router.post("/create", protect, createPost);
// Get all published posts (public)
router.get("/allposts", getAllPosts);

module.exports = router;
