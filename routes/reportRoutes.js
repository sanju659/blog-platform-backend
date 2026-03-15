const express = require("express");
const {
  reportPost,
  getAllReports,
  getReportStats,
  getPostReports,
  dismissReport,
  reviewReport
} = require("../controllers/reportController");

const protect = require("../middlewares/auth_middle_ware");
const adminOnly = require("../middlewares/adminOnly");

const {
  validateReportPost,
  validateGetReportsQuery,
  validatePostId,
  validateDismissReport,
  validateReviewReport,
} = require("../validators/reportValidator");

const router = express.Router();

// Report a post (Here user reporing a post)
router.post("/:postId/report", protect, validateReportPost, reportPost);

// Get all reports
router.get("/admin/all", protect, adminOnly, validateGetReportsQuery,  getAllReports);

// Get report statistics
router.get("/admin/stats", protect, adminOnly, getReportStats);

// Get reports for a specific post
router.get("/admin/post/:postId", protect, adminOnly, validatePostId,  getPostReports);

// Dismiss a report (false report)
router.put("/admin/:reportId/dismiss", protect, adminOnly, validateDismissReport, dismissReport);

// Review report and take action (delete post or dismiss)
router.put("/admin/:reportId/review", protect, adminOnly, validateReviewReport, reviewReport);

module.exports = router;
