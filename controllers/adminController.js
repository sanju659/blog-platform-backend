const User = require("../models/User");
const Post = require("../models/Post");

// Get all users
exports.getAllUsersAdmin = async (req, res) => {
  try {
    // Read query parameters from request
    const { status, role, search } = req.query;

    // Create a filter object (Which is empty)
    let filter = {};

    // If admin passes a valid status, only users with that status are fetched.
    if (status && ["active", "suspended", "banned"].includes(status)) {
      filter.status = status;
    }

    // Filter by role
    // Admin can filter:
      //--> only normal users
      //--> only admins 
    if (role && ["user", "admin"].includes(role)) {
      filter.role = role;
    }

    // Search by name or email
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Fetch users from database
    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 });

    res.status(200).json({
      count: users.length,
      users,
    });
  } catch (error) {
    // console.error(error);
    res.status(500).json({
      message: "Server error",
    });
  }
};

// Get all posts including drafts and deleted (admin only)
exports.getAllPostsAdmin = async (req, res) => {
  try {
    const { published, isDeleted, category, author, search } = req.query;

    // Build filter
    let filter = {};

    // Filter by published status
    if (published !== undefined) {
      filter.published = published === "true";
    }

    // Filter by deleted status
    if (isDeleted !== undefined) {
      filter.isDeleted = isDeleted === "true";
    } else {
      // By default, show only non-deleted posts
      filter.isDeleted = false;
    }

    // Filter by category
    if (category) {
      filter.category = category;
    }

    // Filter by author
    if (author) {
      filter.author = author;
    }

    // Search in title or content
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
      ];
    }

    const posts = await Post.find(filter)
      .populate("author", "fullName email image status")
      .populate("deletedBy", "fullName email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      count: posts.length,
      posts,
    });
  } catch (error) {
    // console.error(error);
    res.status(500).json({
      message: "Server error",
    });
  }
};

// Soft delete a post (admin only)
exports.softDeletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Validate reason
    const validReasons = ["spam", "abuse", "illegal", "violation", "other"];
    if (!reason || !validReasons.includes(reason)) {
      return res.status(400).json({
        message: `Invalid reason. Must be one of: ${validReasons.join(", ")}`,
      });
    }

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({
        message: "Post not found",
      });
    }

    // Check if already deleted
    if (post.isDeleted) {
      return res.status(400).json({
        message: "Post is already deleted",
      });
    }

    // Soft delete the post
    post.isDeleted = true;
    post.deletedBy = req.user._id;
    post.deletedAt = new Date();
    post.deletionReason = reason;

    await post.save();

    const deletedPost = await Post.findById(id)
      .populate("author", "fullName email")
      .populate("deletedBy", "fullName email");

    res.status(200).json({
      message: "Post deleted successfully",
      post: deletedPost,
    });
  } catch (error) {
    // console.error(error);

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid post ID",
      });
    }

    res.status(500).json({
      message: "Server error",
    });
  }
};

// Restore a soft-deleted post (admin only)
exports.restorePost = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({
        message: "Post not found",
      });
    }

    // Check if post is deleted
    if (!post.isDeleted) {
      return res.status(400).json({
        message: "Post is not deleted",
      });
    }

    // Restore the post
    post.isDeleted = false;
    post.deletedBy = null;
    post.deletedAt = null;
    post.deletionReason = null;

    await post.save();

    const restoredPost = await Post.findById(id).populate(
      "author",
      "fullName email"
    );

    res.status(200).json({
      message: "Post restored successfully",
      post: restoredPost,
    });
  } catch (error) {
    // console.error(error);

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid post ID",
      });
    }

    res.status(500).json({
      message: "Server error",
    });
  }
};

// Update user status (suspend/ban/activate) - admin only
exports.updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, reason } = req.body;

    // Validate status
    const validStatuses = ["active", "suspended", "banned"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        // message --> Invalid status. Must be one of: active, suspended, banned
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Prevent admin from changing their own status
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(403).json({
        message: "You cannot change your own status",
      });
    }

    // Prevent changing status of other admins
    if (user.role === "admin") {
      return res.status(403).json({
        message: "You cannot change the status of another admin",
      });
    }

    // Update user status
    user.status = status;
    user.statusReason = reason || null;
    user.statusChangedAt = new Date();

    await user.save();

    res.status(200).json({
      message: `User ${status} successfully`,
      user,
    });
  } catch (error) {
    // console.error(error);

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    res.status(500).json({
      message: "Server error",
    });
  }
};

// Get dashboard statistics (admin only)
exports.getDashboardStats = async (req, res) => {
  try {
    // Total users
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: "active" });
    const suspendedUsers = await User.countDocuments({ status: "suspended" });
    const bannedUsers = await User.countDocuments({ status: "banned" });

    // Total posts
    const totalPosts = await Post.countDocuments({ isDeleted: false });
    const publishedPosts = await Post.countDocuments({
      published: true,
      isDeleted: false,
    });
    const draftPosts = await Post.countDocuments({
      published: false,
      isDeleted: false,
    });
    const deletedPosts = await Post.countDocuments({ isDeleted: true });

    // Recent activity
    const recentUsers = await User.find()
      .select("-password")
      .sort({ createdAt: -1 })
      .limit(5);

    const recentPosts = await Post.find({ isDeleted: false })
      .populate("author", "fullName email")
      .sort({ createdAt: -1 })
      .limit(5);

    const recentDeletedPosts = await Post.find({ isDeleted: true })
      .populate("author", "fullName email")
      .populate("deletedBy", "fullName email")
      .sort({ deletedAt: -1 })
      .limit(5);

    res.status(200).json({
      users: {
        total: totalUsers,
        active: activeUsers,
        suspended: suspendedUsers,
        banned: bannedUsers,
      },
      posts: {
        total: totalPosts,
        published: publishedPosts,
        drafts: draftPosts,
        deleted: deletedPosts,
      },
      recentActivity: {
        users: recentUsers,
        posts: recentPosts,
        deletedPosts: recentDeletedPosts,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
    });
  }
};