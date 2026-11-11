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

    // Combined media (images + videos), preserves upload order
    media: {
      type: [
        {
          type: {
            type: String,
            enum: ["image", "video"],
            required: true,
          },
          url: {
            type: String,
            default: null, // null while a video is still processing
          },
          status: {
            type: String,
            enum: ["ready", "processing", "failed"],
            default: "ready",
          },
          progress: {
            type: Number,
            default: null, // 0-99 while processing, null otherwise
          },
          error: {
            type: String,
            default: null,
          },
        },
      ],
      default: [],
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
  },
);

// Indexes
postSchema.index({ published: 1, createdAt: -1 });
postSchema.index({ author: 1 });
postSchema.index({ isDeleted: 1 });

module.exports = mongoose.model("Post", postSchema);
