const User = require("../models/User");
const Post = require("../models/Post");
const { normalizeUsername } = require("../utils/username");
const Follow = require("../models/Follow");

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

const FOLLOW_PAGE_SIZE = 20;
const FOLLOW_MAX_PAGE_SIZE = 50;

const getFollowCounts = async (userId) => {
  const [followersCount, followingCount] = await Promise.all([
    Follow.countDocuments({ following: userId }),
    Follow.countDocuments({ follower: userId }),
  ]);
  return { followersCount, followingCount };
};

// GET /api/users/:username
exports.getPublicProfile = async (req, res) => {
  try {
    const user = await findVisibleUser(req);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isOwner =
      !!req.user && req.user._id.toString() === user._id.toString();

    const [postCount, counts, followDoc] = await Promise.all([
      Post.countDocuments({
        author: user._id,
        published: true,
        isDeleted: false,
      }),
      getFollowCounts(user._id),
      req.user && !isOwner
        ? Follow.exists({ follower: req.user._id, following: user._id })
        : null,
    ]);

    res.status(200).json({
      id: user._id,
      fullName: user.fullName,
      username: user.username,
      bio: user.bio || "",
      image: user.image,
      createdAt: user.createdAt,
      postCount,
      ...counts,
      isFollowing: !!followDoc,
      isOwner,
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

// POST /api/users/:username/follow
exports.followUser = async (req, res) => {
  try {
    const target = await findVisibleUser(req);
    if (!target || target.status !== "active") {
      return res.status(404).json({ message: "User not found" });
    }

    if (target._id.equals(req.user._id)) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    try {
      await Follow.create({ follower: req.user._id, following: target._id });
    } catch (err) {
      // 11000 = already following (unique index). Treat as success.
      if (err.code !== 11000) throw err;
    }

    res.status(200).json({
      isFollowing: true,
      ...(await getFollowCounts(target._id)),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/users/:username/follow
exports.unfollowUser = async (req, res) => {
  try {
    const target = await findVisibleUser(req);
    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }

    await Follow.deleteOne({ follower: req.user._id, following: target._id });

    res.status(200).json({
      isFollowing: false,
      ...(await getFollowCounts(target._id)),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Shared by followers/following lists.
// "followers": people who follow :username. "following": people :username follows.
const listConnections = (type) => async (req, res) => {
  try {
    const user = await findVisibleUser(req);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || FOLLOW_PAGE_SIZE, 1),
      FOLLOW_MAX_PAGE_SIZE,
    );

    const matchField = type === "followers" ? "following" : "follower";
    const otherField = type === "followers" ? "follower" : "following";

    // Join with users so suspended/banned accounts are left out of the list
    const [result] = await Follow.aggregate([
      { $match: { [matchField]: user._id } },
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $lookup: {
          from: "users",
          localField: otherField,
          foreignField: "_id",
          as: "person",
          pipeline: [
            { $match: { status: "active", username: { $type: "string" } } },
            { $project: { fullName: 1, username: 1, image: 1, bio: 1 } },
          ],
        },
      },
      { $unwind: "$person" },
      {
        $facet: {
          items: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $project: {
                _id: "$person._id",
                fullName: "$person.fullName",
                username: "$person.username",
                image: "$person.image",
                bio: "$person.bio",
                followedAt: "$createdAt",
              },
            },
          ],
          total: [{ $count: "n" }],
        },
      },
    ]);

    const total = result.total[0]?.n || 0;

    res.status(200).json({
      users: result.items,
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

exports.getFollowers = listConnections("followers");
exports.getFollowing = listConnections("following");
