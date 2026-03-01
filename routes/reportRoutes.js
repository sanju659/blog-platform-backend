const express = require("express");
const { reportPost } = require("../controllers/reportController");

const protect = require("../middlewares/auth_middle_ware");
const adminOnly = require("../middlewares/adminOnly");

const router = express.Router();

// Report a post (Here user reporing a post)
router.post("/:postId/report", protect, reportPost);


module.exports = router;
