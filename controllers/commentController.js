const mongoose = require("mongoose");
const Post = require("../models/Post");
const Comment = require("../models/Comment");

const PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 30;

// Only published, non-deleted posts can have comments
const findCommentablePost = (id) =>
  Post.findOne({ _id: id, published: true, isDeleted: false }).select("_id");

// Joins the author and drops comments from suspended/banned accounts
const authorLookup = [
  {
    $lookup: {
      from: "users",
      localField: "author",
      foreignField: "_id",
      as: "author",
      pipeline: [
        { $match: { status: "active" } },
        { $project: { fullName: 1, username: 1, image: 1 } },
      ],
    },
  },
  { $unwind: "$author" },
];

const formatComment = (comment, viewerId) => ({
  _id: comment._id,
  content: comment.content,
  createdAt: comment.createdAt,
  editedAt: comment.editedAt || null,
  author: {
    _id: comment.author._id,
    fullName: comment.author.fullName,
    username: comment.author.username || null,
    image: comment.author.image,
  },
  // UI hint only. Ownership is always re-checked on the server for edit/delete.
  isMine: !!viewerId && comment.author._id.toString() === viewerId.toString(),
});

// GET /api/posts/:id/comments?limit=10&cursor=<ms>_<id>  (public)
exports.getComments = async (req, res) => {
  try {
    const post = await findCommentablePost(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || PAGE_SIZE, 1),
      MAX_PAGE_SIZE,
    );

    // Cursor format: "<createdAtMs>_<commentId>"
    let cursorMatch = null;
    if (req.query.cursor) {
      const [ms, id] = String(req.query.cursor).split("_");
      const date = new Date(Number(ms));

      if (isNaN(date.getTime()) || !/^[a-f0-9]{24}$/i.test(id || "")) {
        return res.status(400).json({ message: "Invalid cursor" });
      }

      cursorMatch = {
        $or: [
          { createdAt: { $lt: date } },
          { createdAt: date, _id: { $lt: new mongoose.Types.ObjectId(id) } },
        ],
      };
    }

    const [rows, totals] = await Promise.all([
      Comment.aggregate([
        { $match: { post: post._id } },
        ...(cursorMatch ? [{ $match: cursorMatch }] : []),
        { $sort: { createdAt: -1, _id: -1 } },
        { $limit: limit + 1 }, // one extra row tells us whether another page exists
        ...authorLookup,
      ]),
      // Total only on the first page (it's the heavier query)
      req.query.cursor
        ? null
        : Comment.aggregate([
            { $match: { post: post._id } },
            ...authorLookup,
            { $count: "n" },
          ]),
    ]);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];

    res.status(200).json({
      comments: page.map((c) => formatComment(c, req.user?._id)),
      hasMore,
      nextCursor:
        hasMore && last
          ? `${new Date(last.createdAt).getTime()}_${last._id}`
          : null,
      ...(totals ? { total: totals[0]?.n || 0 } : {}),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/posts/:id/comments  { content }
exports.createComment = async (req, res) => {
  try {
    const post = await findCommentablePost(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = await Comment.create({
      post: post._id,
      author: req.user._id,
      content: req.body.content,
    });

    // req.user is already loaded and active (protect checked it)
    res.status(201).json({
      message: "Comment added",
      comment: formatComment(
        {
          ...comment.toObject(),
          author: {
            _id: req.user._id,
            fullName: req.user.fullName,
            username: req.user.username,
            image: req.user.image,
          },
        },
        req.user._id,
      ),
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const first = Object.values(error.errors)[0];
      return res
        .status(400)
        .json({ message: first?.message || "Invalid comment" });
    }
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// The logged-in user's public fields, shaped like a populated comment author
const ownerShape = (user) => ({
  _id: user._id,
  fullName: user.fullName,
  username: user.username,
  image: user.image,
});

// PATCH /api/comments/:commentId  { content }
exports.editComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    if (comment.author.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "You can only edit your own comments" });
    }

    // Editing is only allowed while the post is still public
    if (!(await findCommentablePost(comment.post))) {
      return res.status(404).json({ message: "Comment not found" });
    }

    // content was already trimmed by the validator
    if (req.body.content !== comment.content) {
      comment.content = req.body.content;
      comment.editedAt = new Date();
      await comment.save();
    }

    res.status(200).json({
      message: "Comment updated",
      comment: formatComment(
        { ...comment.toObject(), author: ownerShape(req.user) },
        req.user._id,
      ),
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const first = Object.values(error.errors)[0];
      return res
        .status(400)
        .json({ message: first?.message || "Invalid comment" });
    }
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/comments/:commentId
exports.deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId).select(
      "author",
    );
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    if (comment.author.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "You can only delete your own comments" });
    }

    // The author filter makes the ownership rule part of the query itself
    await Comment.deleteOne({ _id: comment._id, author: req.user._id });

    res.status(200).json({ message: "Comment deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
