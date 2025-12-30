const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  let token;

  //The guard asks: "Do you have an authorization header that starts with 'Bearer'?"
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      //If the header is "Bearer abc123xyz"
      //Split by space: ["Bearer", "abc123xyz"]
      //Take the second part [1] = "abc123xyz" ← This is the actual token
      token = req.headers.authorization.split(" ")[1];

      // Verify tokenv for example:
      //decoded = {
      // "_id": "695260cee2d9eb15059c3b94",
      // "email": "maxtate@gmail.com",
      // "image": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSsr88cCNagKzFqYivhlOZFx9-H8VBn4b6iNQ&s",
      // "createdAt": "2025-12-29T11:06:54.643Z",
      // "updatedAt": "2025-12-29T11:06:54.643Z",
      // "__v": 0 }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach user to request(feching data except password)
      req.user = await User.findById(decoded.id).select("-password");

      next();
    } catch (error) {
      return res.status(401).json({
        message: "Not authorized, token failed",
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      message: "Not authorized, no token",
    });
  }
};

module.exports = protect;
