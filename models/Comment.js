const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    // Set only when the content is edited (slice 3). null = never edited.
    editedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Comment list for a post, newest first (also serves the cursor pagination)
commentSchema.index({ post: 1, createdAt: -1, _id: -1 });
// "All comments by a user" (cleanup, moderation)
commentSchema.index({ author: 1 });

module.exports = mongoose.model("Comment", commentSchema);
