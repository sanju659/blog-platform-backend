const Post = require("./../models/Post");

// Create a new post
exports.createPost = async (req, res) => {
  try {
    const { title, content, excerpt, image, category, published } = req.body;

    // Basic validation
    if (!title || !content) {
      return res.status(400).json({
        message: "Title and content are required",
      });
    }

    // storing  the data in postData
    const postData = {
      title,
      content,
      excerpt,
      image,
      category,
      published: published || false,
      author: req.user._id, // comes from JWT
    };

    // If published, (Stroring the publish date)
    if (published === true) {
      postData.publishedAt = new Date();
    }

    // Storing the create post data
    const userpost = await Post.create(postData);

    res.status(201).json({
      message: "Post created successfully",
      userpost,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
    });
  }
};

// Get all published posts
exports.getAllPosts = async (req, res) => {
  try {
    const posts = await Post.find({ published: true }) // filter and take only the published post not the draft one
      .populate("author", "fullName image") // find the user from User collection and get his/her full name and image
      .sort({ createdAt: -1 }); // Newest post first

    res.status(200).json({
      count: posts.length, // total number of posts
      posts, // the post itself is sent as json
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
    });
  }
};
