const express = require("express");
const { reportPost, getAllReports, getReportStats } = require("../controllers/reportController");

const protect = require("../middlewares/auth_middle_ware");
const adminOnly = require("../middlewares/adminOnly");

const router = express.Router();

// Report a post (Here user reporing a post)
router.post("/:postId/report", protect, reportPost);

// Get all reports 
router.get("/admin/all", protect, adminOnly, getAllReports);

// Get report statistics
router.get("/admin/stats", protect, adminOnly, getReportStats);


module.exports = router;
