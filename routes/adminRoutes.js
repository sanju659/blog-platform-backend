const express = require("express");
const {
  getAllUsersAdmin,
  getAllPostsAdmin,
  softDeletePost,
  restorePost,
  updateUserStatus,
  getDashboardStats,
} = require("../controllers/adminController");

const protect = require("../middlewares/auth_middle_ware");
const adminOnly = require("../middlewares/adminOnly");

const {
  validateGetUsersQuery,
  validateGetPostsQuery,
  validateUpdateUserStatus,
  validateSoftDeletePost,
  validateRestorePost,
} = require("../validators/adminValidator");

const router = express.Router();

// All admin routes require authentication (protect) and admin role (adminOnly)

// Dashboard statistics
router.get("/dashboard", protect, adminOnly, getDashboardStats);

// User management
router.get("/users", protect, adminOnly, validateGetUsersQuery, getAllUsersAdmin);
router.put("/users/:userId/status", protect, adminOnly, validateUpdateUserStatus, updateUserStatus);

// Post management
router.get("/posts", protect, adminOnly, validateGetPostsQuery, getAllPostsAdmin);
router.delete("/posts/:id/soft-delete", protect, adminOnly, validateSoftDeletePost, softDeletePost);
router.put("/posts/:id/restore", protect, adminOnly, validateRestorePost, restorePost);

module.exports = router;
