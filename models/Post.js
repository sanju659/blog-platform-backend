const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    // Described content
    content: {
      type: String,
      required: true,
    },

    // It is a short summary
    excerpt: {
      type: String,
      trim: true,
    },

    // Content image
    image: {
      type: String, // image URL for now
      default: "https://via.placeholder.com/800x400?text=No+Image",
    },

    // Creator of the post(From User Collection)
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // What type of content!
    category: {
      type: String,
      trim: true,
      enum: [
        "Technology",
        "Nature",
        "Travel",
        "Lifestyle",
        "Programming",
        "Personal",
      ],
    },

    // It is published or Draft
    published: {
      type: Boolean,
      default: false,
    },

    // Date of publish
    publishedAt: {
      type: Date,
    },

    // Total views of the post
    views: {
      type: Number,
      default: 0,
    },

    // Soft delete flag
    isDeleted: {
      type: Boolean,
      default: false,
    },

    // Who deleted it (admin)
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // When it was deleted
    deletedAt: {
      type: Date,
      default: null,
    },

    // Reason for deletion (spam, abuse, illegal, etc.)
    deletionReason: {
      type: String,
      enum: ["spam", "abuse", "illegal", "violation", "other"],
      default: null,
    },
  },
  {
    timestamps: true, // adds createdAt & updatedAt
  }
);

// Indexes
postSchema.index({ published: 1, createdAt: -1 });
postSchema.index({ author: 1 });
postSchema.index({ isDeleted: 1 });

module.exports = mongoose.model("Post", postSchema);
