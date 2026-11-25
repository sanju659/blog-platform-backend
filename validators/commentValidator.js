const { body, param, validationResult } = require("express-validator");

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

const COMMENT_MAX = 1000;

const contentRule = () =>
  body("content")
    .isString()
    .withMessage("Comment must be text")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Comment cannot be empty")
    .isLength({ max: COMMENT_MAX })
    .withMessage(`Comment cannot exceed ${COMMENT_MAX} characters`);

// POST /api/posts/:id/comments
const validateCreateComment = [
  param("id").isMongoId().withMessage("Invalid post ID"),
  contentRule(),
  handleValidationErrors,
];

// PATCH /api/comments/:commentId
const validateEditComment = [
  param("commentId").isMongoId().withMessage("Invalid comment ID"),
  contentRule(),
  handleValidationErrors,
];

// DELETE /api/comments/:commentId
const validateCommentId = [
  param("commentId").isMongoId().withMessage("Invalid comment ID"),
  handleValidationErrors,
];

module.exports = {
  validateCreateComment,
  validateEditComment,
  validateCommentId,
  COMMENT_MAX,
};
