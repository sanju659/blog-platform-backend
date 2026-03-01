const Report = require("../models/Report");
const Post = require("../models/Post");

// User reports a post
exports.reportPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { reason, description } = req.body;

    // Validate reason
    const validReasons = ["spam", "abuse", "illegal", "harassment", "misinformation", "other"];
    if (!reason || !validReasons.includes(reason)) {
      return res.status(400).json({
        message: `Invalid reason. Must be one of: ${validReasons.join(", ")}`,
      });
    }

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        message: "Post not found",
      });
    }

    // Check if post is already deleted
    if (post.isDeleted) {
      return res.status(400).json({
        message: "This post has already been removed",
      });
    }

    // Check if user is trying to report their own post
    if (post.author.toString() === req.user._id.toString()) {
      return res.status(400).json({
        message: "You cannot report your own post",
      });
    }

    // Check if user has already reported this post
    const existingReport = await Report.findOne({
      post: postId,
      reportedBy: req.user._id,
    });

    if (existingReport) {
      return res.status(400).json({
        message: "You have already reported this post",
      });
    }

    // Create the report
    const report = await Report.create({
      post: postId,
      reportedBy: req.user._id,
      reason,
      description: description || null,
    });

    const populatedReport = await Report.findById(report._id)
      .populate("post", "title excerpt")
      .populate("reportedBy", "fullName email");

    res.status(201).json({
      message: "Post reported successfully. Our team will review it.",
      report: populatedReport,
    });
  } catch (error) {
    console.error(error);

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid post ID",
      });
    }

    res.status(500).json({
      message: "Server error",
    });
  }
};

// Admin: Get all reports
exports.getAllReports = async (req, res) => {
  try {
    const { status, reason, postId } = req.query;

    // Build filter
    let filter = {};

    // Filter by status
    if (status && ["pending", "reviewed", "dismissed"].includes(status)) {
      filter.status = status;
    } else {
      // By default, show only pending reports
      filter.status = "pending";
    }

    // Filter by reason
    if (reason && ["spam", "abuse", "illegal", "harassment", "misinformation", "other"].includes(reason)) {
      filter.reason = reason;
    }

    // Filter by specific post
    if (postId) {
      filter.post = postId;
    }

    const reports = await Report.find(filter)
      .populate("post", "title content excerpt image author")
      .populate("reportedBy", "fullName email")
      .populate("reviewedBy", "fullName email")
      .populate({
        path: "post",
        populate: {
          path: "author",
          select: "fullName email image",
        },
      })
      .sort({ createdAt: -1 });

    // Group reports by post for better overview
    const reportsByPost = {};
    reports.forEach((report) => {
      if (report.post) {
        const postId = report.post._id.toString();
        if (!reportsByPost[postId]) {
          reportsByPost[postId] = {
            post: report.post,
            reportCount: 0,
            reports: [],
          };
        }
        reportsByPost[postId].reportCount++;
        reportsByPost[postId].reports.push(report);
      }
    });

    res.status(200).json({
      count: reports.length,
      reports,
      groupedByPost: Object.values(reportsByPost),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
    });
  }
};
