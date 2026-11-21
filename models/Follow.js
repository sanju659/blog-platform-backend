const mongoose = require("mongoose");

const followSchema = new mongoose.Schema(
  {
    // The user who clicked "Follow"
    follower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // The user being followed
    following: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      validate: {
        validator: function (value) {
          return !value.equals(this.follower);
        },
        message: "You cannot follow yourself",
      },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// One follow per pair: blocks duplicates, even under concurrent requests
followSchema.index({ follower: 1, following: 1 }, { unique: true });
// "Who follows X" (newest first)
followSchema.index({ following: 1, createdAt: -1 });
// "Who does X follow" (newest first)
followSchema.index({ follower: 1, createdAt: -1 });

module.exports = mongoose.model("Follow", followSchema);
