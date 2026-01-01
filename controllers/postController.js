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

// Get posts by user ID
exports.getPostsByUserId = async (req, res) => {
  try {
    // taking 'userId' from url 'http://127.0.0.1:3000/api/posts/user/:userId'
    const { userId } = req.params;

    // Getting all the post by 'userId'
    const posts = await Post.find({
      author: userId,
      published: true,
    })
      .populate("author", "fullName image")
      .sort({ createdAt: -1 });

    // If user does not post anything yet
    if (posts.length === 0) {
      return res.status(200).json({
        message: "No posts found for this user",
        posts: [],
      });
    }

    // Sending the response
    res.status(200).json({
      count: posts.length,
      posts,
    });
  } catch (error) {
    console.error(error);

    // If for some reason 'userId' is wrong in url parameter
    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    // for any internal server error
    res.status(500).json({
      message: "Server error",
    });
  }
};

// Update post (author only)
exports.updatePost = async (req, res) => {
  try {
    // getting the post id from url 'http://127.0.0.1:3000/api/posts/update/<POST_ID>'
    const { id } = req.params;

    const { title, content, excerpt, image, category, published } = req.body;

    // Find the post using post id
    const post = await Post.findById(id);

    // If post not found
    if (!post) {
      return res.status(404).json({
        message: "Post not found",
      });
    }

    // Ownership check
    // req.user coming from 'auth_middle_ware.js as we are using "protect"'
    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "You are not allowed to update this post",
      });
    }

    // Update fields only if provided
    if (title) post.title = title;
    if (content) post.content = content;
    if (excerpt) post.excerpt = excerpt;
    if (image) post.image = image;
    if (category) post.category = category;

    // Handle publish logic
    if (published !== undefined) {
      // Draft --> Published
      if (published === true && !post.publishedAt) {
        post.publishedAt = new Date();
      }

      // Published --> Draft
      if (published === false) {
        post.publishedAt = null;
      }

      // updating the status of 'published' in database
      post.published = published;
    }

    // Saving the whole post in Data Base
    const updatedPost = await post.save();

    res.status(200).json({
      message: "Post updated successfully",
      updatedPost,
    });
  } catch (error) {
    console.error(error);

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

// Delete post (author only)
exports.deletePost = async (req, res) => {
  try {
    // The post id has came from url http://127.0.0.1:3000/api/posts/delete/<POST_ID>
    const { id } = req.params;

    // Find post in database
    const post = await Post.findById(id);

    // Post not found
    if (!post) {
      return res.status(404).json({
        message: "Post not found",
      });
    }

    // Ownership check
    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "You are not allowed to delete this post",
      });
    }

    // Delete post
    await post.deleteOne();

    res.status(200).json({
      message: "Post deleted successfully",
    });
  } catch (error) {
    console.error(error);

    // Invalid ObjectId
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
