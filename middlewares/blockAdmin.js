// Admin accounts moderate the platform and don't use social features
const blockAdmin = (req, res, next) => {
  if (req.user?.role === "admin") {
    return res
      .status(403)
      .json({ message: "Admin accounts cannot use this feature" });
  }
  next();
};

module.exports = blockAdmin;
