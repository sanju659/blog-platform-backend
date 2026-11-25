const express = require("express");
const protect = require("../middlewares/auth_middle_ware");
const blockAdmin = require("../middlewares/blockAdmin");
const { commentEditLimiter } = require("../middlewares/rateLimiter");
const {
  validateEditComment,
  validateCommentId,
} = require("../validators/commentValidator");
const {
  editComment,
  deleteComment,
} = require("../controllers/commentController");

const router = express.Router();

router.patch(
  "/:commentId",
  protect,
  blockAdmin,
  commentEditLimiter,
  validateEditComment,
  editComment,
);

router.delete(
  "/:commentId",
  protect,
  blockAdmin,
  commentEditLimiter,
  validateCommentId,
  deleteComment,
);

module.exports = router;
