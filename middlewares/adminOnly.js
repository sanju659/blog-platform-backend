const adminOnly = async (req, res, next) => {
  try {
    // Check if user is authenticated (from protect middleware)
    if (!req.user) {
      return res.status(401).json({
        message: "Not authorized, no user found",
      });
    }

    // Check if user has admin role
    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Access denied. Admin privileges required.",
      });
    }

    // Check if admin account is active
    if (req.user.status !== "active") {
      return res.status(403).json({
        message: "Admin account is not active",
      });
    }

    // Admin authorized, proceed
    next();
  } catch (error) {
    // console.error(error);
    res.status(500).json({
      message: "Server error in admin authorization",
    });
  }
};

module.exports = adminOnly;