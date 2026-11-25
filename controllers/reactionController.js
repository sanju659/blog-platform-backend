const Post = require("../models/Post");
const Reaction = require("../models/Reaction");

// Only published, non-deleted posts can be reacted to (or have reactions read)
const findReactablePost = (id) =>
  Post.findOne({ _id: id, published: true, isDeleted: false }).select("_id");

// Counts + the current user's reaction, in two parallel queries
const getSummary = async (postId, userId) => {
  const [grouped, mine] = await Promise.all([
    Reaction.aggregate([
      { $match: { post: postId } },
      { $group: { _id: "$reaction", count: { $sum: 1 } } },
    ]),
    userId
      ? Reaction.findOne({ post: postId, user: userId })
          .select("reaction")
          .lean()
      : null,
  ]);

  const countOf = (type) => grouped.find((g) => g._id === type)?.count || 0;

  return {
    likeCount: countOf("like"),
    dislikeCount: countOf("dislike"),
    currentUserReaction: mine?.reaction || null,
  };
};

// GET /api/posts/:id/reactions (public)
exports.getReactions = async (req, res) => {
  try {
    const post = await findReactablePost(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    res.status(200).json(await getSummary(post._id, req.user?._id));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/posts/:id/reactions  { reaction: "like" | "dislike" }
// Sets (creates or switches) the user's reaction. Safe to call repeatedly.
exports.setReaction = async (req, res) => {
  try {
    const post = await findReactablePost(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const upsert = () =>
      Reaction.findOneAndUpdate(
        { user: req.user._id, post: post._id },
        { $set: { reaction: req.body.reaction } },
        { upsert: true, setDefaultsOnInsert: true },
      );

    try {
      await upsert();
    } catch (err) {
      // Two simultaneous first-time requests can collide on the unique index: retry once
      if (err.code === 11000) await upsert();
      else throw err;
    }

    res.status(200).json(await getSummary(post._id, req.user._id));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/posts/:id/reactions
exports.removeReaction = async (req, res) => {
  try {
    const post = await findReactablePost(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    await Reaction.deleteOne({ user: req.user._id, post: post._id });

    res.status(200).json(await getSummary(post._id, req.user._id));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
