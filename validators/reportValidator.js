const { body, param, query, validationResult } = require("express-validator");

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: "Validation failed",
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  next();
};

// Valid values (mirrors your Report model)
const validReportReasons = ["spam", "abuse", "illegal", "harassment", "misinformation", "other"];
const validReportStatuses = ["pending", "reviewed", "dismissed"];
const validDeletionReasons = ["spam", "abuse", "illegal", "violation", "other"];

// POST /:postId/report
const validateReportPost = [
  param("postId")
    .isMongoId().withMessage("Invalid post ID"),

  body("reason")
    .notEmpty().withMessage("Reason is required")
    .isIn(validReportReasons).withMessage(`Reason must be one of: ${validReportReasons.join(", ")}`),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage("Description cannot exceed 500 characters"),

  handleValidationErrors,
];

// GET /admin/all - query validation
const validateGetReportsQuery = [
  query("status")
    .optional()
    .isIn(validReportStatuses).withMessage(`Status must be one of: ${validReportStatuses.join(", ")}`),

  query("reason")
    .optional()
    .isIn(validReportReasons).withMessage(`Reason must be one of: ${validReportReasons.join(", ")}`),

  query("postId")
    .optional()
    .isMongoId().withMessage("Invalid post ID"),

  handleValidationErrors,
];

// GET /admin/post/:postId
const validatePostId = [
  param("postId")
    .isMongoId().withMessage("Invalid post ID"),

  handleValidationErrors,
];

// PUT /admin/:reportId/dismiss
const validateDismissReport = [
  param("reportId")
    .isMongoId().withMessage("Invalid report ID"),

  body("note")
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage("Note cannot exceed 500 characters"),

  handleValidationErrors,
];

// PUT /admin/:reportId/review
const validateReviewReport = [
  param("reportId")
    .isMongoId().withMessage("Invalid report ID"),

  body("deletionReason")
    .notEmpty().withMessage("Deletion reason is required")
    .isIn(validDeletionReasons).withMessage(`Deletion reason must be one of: ${validDeletionReasons.join(", ")}`),

  body("note")
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage("Note cannot exceed 500 characters"),

  handleValidationErrors,
];

module.exports = {
  validateReportPost,
  validateGetReportsQuery,
  validatePostId,
  validateDismissReport,
  validateReviewReport,
};