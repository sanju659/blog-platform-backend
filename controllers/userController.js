const User = require("../models/User");
const Post = require("../models/Post");
const { normalizeUsername } = require("../utils/username");

const DEFAULT_PAGE_SIZE = 9;
const MAX_PAGE_SIZE = 24;

// Finds a profile by username. Returns null if it doesn't exist, or if the
// account is suspended/banned and the requester is not an admin.
const findVisibleUser = async (req) => {
  const username = normalizeUsername(req.params.username);

  const user = await User.findOne({ username }).select(
    "fullName username bio image createdAt status",
  );
  if (!user) return null;

  const isAdmin = req.user?.role === "admin";
  if (user.status !== "active" && !isAdmin) return null;

  return user;
};

// GET /api/users/:username
exports.getPublicProfile = async (req, res) => {
  try {
    const user = await findVisibleUser(req);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const postCount = await Post.countDocuments({
      author: user._id,
      published: true,
      isDeleted: false,
    });

    res.status(200).json({
      id: user._id,
      fullName: user.fullName,
      username: user.username,
      bio: user.bio || "",
      image: user.image,
      createdAt: user.createdAt,
      postCount,
      isOwner: !!req.user && req.user._id.toString() === user._id.toString(),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/users/:username/posts?page=1&limit=9
exports.getUserPosts = async (req, res) => {
  try {
    const user = await findVisibleUser(req);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || DEFAULT_PAGE_SIZE, 1),
      MAX_PAGE_SIZE,
    );

    const filter = { author: user._id, published: true, isDeleted: false };

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .select("title excerpt media category createdAt publishedAt")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Post.countDocuments(filter),
    ]);

    res.status(200).json({
      posts,
      page,
      limit,
      total,
      hasMore: page * limit < total,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
