const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Optional authentication - doesn't block if no token
const optionalAuth = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
      if (
        req.user?.passwordChangedAt &&
        decoded.iat < Math.floor(req.user.passwordChangedAt.getTime() / 1000)
      ) {
        req.user = null;
      }
    } catch (error) {
      // Token invalid, but continue anyway
      req.user = null;
    }
  }

  // Always proceed, even without token
  next();
};

module.exports = optionalAuth;
