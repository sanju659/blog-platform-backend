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
  },
  {
    timestamps: true, // adds createdAt & updatedAt
  }
);

// Indexes
postSchema.index({ published: 1, createdAt: -1 });
postSchema.index({ author: 1 });

module.exports = mongoose.model("Post", postSchema);
