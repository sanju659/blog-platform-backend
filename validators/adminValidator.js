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

// Valid values (mirrors your models)
const validUserStatuses = ["active", "suspended", "banned"];
const validUserRoles = ["user", "admin"];
const validPostCategories = [
  "Technology",
  "Nature",
  "Travel",
  "Lifestyle",
  "Programming",
  "Personal",
];
const validDeletionReasons = ["spam", "abuse", "illegal", "violation", "other"];

// GET /users - query validation
const validateGetUsersQuery = [
  query("status")
    .optional()
    .isIn(validUserStatuses)
    .withMessage(`Status must be one of: ${validUserStatuses.join(", ")}`),

  query("role")
    .optional()
    .isIn(validUserRoles)
    .withMessage(`Role must be one of: ${validUserRoles.join(", ")}`),

  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search term cannot exceed 100 characters"),

  handleValidationErrors,
];

// GET /posts - query validation
const validateGetPostsQuery = [
  query("isDeleted")
    .optional()
    .isIn(["true", "false"])
    .withMessage("isDeleted must be true or false"),

  query("category")
    .optional()
    .isIn(validPostCategories)
    .withMessage(`Category must be one of: ${validPostCategories.join(", ")}`),

  query("author").optional().isMongoId().withMessage("Invalid author ID"),

  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search term cannot exceed 100 characters"),

  handleValidationErrors,
];

// PUT /users/:userId/status
const validateUpdateUserStatus = [
  param("userId").isMongoId().withMessage("Invalid user ID"),

  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn(validUserStatuses)
    .withMessage(`Status must be one of: ${validUserStatuses.join(", ")}`),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage("Reason cannot exceed 300 characters"),

  handleValidationErrors,
];

// DELETE /posts/:id/soft-delete
const validateSoftDeletePost = [
  param("id").isMongoId().withMessage("Invalid post ID"),

  body("reason")
    .notEmpty()
    .withMessage("Deletion reason is required")
    .isIn(validDeletionReasons)
    .withMessage(`Reason must be one of: ${validDeletionReasons.join(", ")}`),

  handleValidationErrors,
];

// PUT /posts/:id/restore
const validateRestorePost = [
  param("id").isMongoId().withMessage("Invalid post ID"),

  handleValidationErrors,
];

module.exports = {
  validateGetUsersQuery,
  validateGetPostsQuery,
  validateUpdateUserStatus,
  validateSoftDeletePost,
  validateRestorePost,
};
