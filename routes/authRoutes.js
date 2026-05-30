const express = require("express");
const {
  signup,
  login,
  getAllUsers,
  getMe,
  updateProfile,
  changePassword,
} = require("../controllers/authController");
const protect = require("../middlewares/auth_middle_ware");
const {
  validateSignup,
  validateLogin,
  validateUpdateProfile,
  validateChangePassword,
} = require("../validators/authValidator");
const upload = require("../config/multerConfig");

const router = express.Router();

router.post("/signup", validateSignup, signup);
router.post("/login",validateLogin, login);
router.get("/users", getAllUsers);

// Protected route
router.get("/me", protect, getMe);

// Update profile (protected)
router.put("/update-profile", protect, upload.single("image"), validateUpdateProfile, updateProfile);

// Change password (protected)
router.put("/change-password", protect, validateChangePassword, changePassword);

module.exports = router;
