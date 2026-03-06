const { body, param, validationResult } = require("express-validator");

// Middleware to handle validation errors
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

// Valid categories (mirrors your Post model)
const validCategories = [
  "Technology",
  "Nature",
  "Travel",
  "Lifestyle",
  "Programming",
  "Personal",
];

// Create post validation
const validateCreatePost = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ max: 200 })
    .withMessage("Title cannot exceed 200 characters"),

  body("content").notEmpty().withMessage("Content is required"),

  body("excerpt")
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage("Excerpt cannot exceed 300 characters"),

  body("category")
    .optional()
    .isIn(validCategories)
    .withMessage(`Category must be one of: ${validCategories.join(", ")}`),

  body("published")
  .optional()
  .isBoolean()
  .withMessage("Published must be true or false")
  .toBoolean(),

  handleValidationErrors,
];

// Update post validation (all optional)
const validateUpdatePost = [
  param("id").isMongoId().withMessage("Invalid post ID"),

  body("title")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Title cannot be empty")
    .isLength({ max: 200 })
    .withMessage("Title cannot exceed 200 characters"),

  body("content").optional().notEmpty().withMessage("Content cannot be empty"),

  body("excerpt")
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage("Excerpt cannot exceed 300 characters"),

  body("category")
    .optional()
    .isIn(validCategories)
    .withMessage(`Category must be one of: ${validCategories.join(", ")}`),

  body("published")
  .optional()
  .isBoolean()
  .withMessage("Published must be true or false")
  .toBoolean(),

  handleValidationErrors,
];

// Validate MongoDB ID in params
const validatePostId = [
  param("id").isMongoId().withMessage("Invalid post ID"),

  handleValidationErrors,
];

module.exports = { validateCreatePost, validateUpdatePost, validatePostId };
