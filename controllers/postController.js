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

// Get single post by ID
exports.getPostById = async (req, res) => {
  try {
    // the 'id' is taken from url "http://127.0.0.1:3000/api/posts/id"
    const { id } = req.params;

    // getting the post using id and also finding it's author's full name and image
    const post = await Post.findOne({
      _id: id,
      published: true,
    }).populate("author", "fullName image");

    // showing this error when post not found
    if (!post) {
      return res.status(404).json({
        message: "Post not found",
      });
    }

    // sending the post(in the form of json) as response
    res.status(200).json(post);
  } catch (error) {
    console.error(error);

    // Handle invalid ObjectId
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
