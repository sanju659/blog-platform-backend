const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    // The post being reported
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },

    // User who reported the post
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Reason for the report
    reason: {
      type: String,
      required: true,
      enum: ["spam", "abuse", "illegal", "harassment", "misinformation", "other"],
    },

    // Optional additional details
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    // Status of the report
    status: {
      type: String,
      enum: ["pending", "reviewed", "dismissed"],
      default: "pending",
    },

    // Admin who reviewed the report
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // When it was reviewed
    reviewedAt: {
      type: Date,
      default: null,
    },

    // Admin's note on the review
    reviewNote: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true, // adds createdAt & updatedAt
  }
);

// Indexes for efficient queries
reportSchema.index({ post: 1, reportedBy: 1 }, { unique: true }); // One user can only report a post once
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ post: 1 });

module.exports = mongoose.model("Report", reportSchema);