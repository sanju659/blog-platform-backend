const mongoose = require("mongoose");

const reactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
    reaction: {
      type: String,
      enum: ["like", "dislike"],
      required: true,
    },
  },
  { timestamps: true },
);

// One reaction per user per post, enforced by the database even under concurrent requests
reactionSchema.index({ user: 1, post: 1 }, { unique: true });
// Fast counting of likes/dislikes for a post
reactionSchema.index({ post: 1, reaction: 1 });

module.exports = mongoose.model("Reaction", reactionSchema);
