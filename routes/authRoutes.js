const express = require("express");
const {
  signup,
  login,
  getAllUsers,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  checkUsername,
} = require("../controllers/authController");
const protect = require("../middlewares/auth_middle_ware");
const {
  validateSignup,
  validateLogin,
  validateUpdateProfile,
  validateChangePassword,
  validateForgotPassword,
  validateResetPassword,
} = require("../validators/authValidator");
const upload = require("../config/multerConfig");

const adminOnly = require("../middlewares/adminOnly");
const {
  loginIpLimiter,
  loginAccountLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  signupLimiter,
  changePasswordLimiter,
  usernameCheckLimiter,
} = require("../middlewares/rateLimiter");

const router = express.Router();

router.post("/signup", signupLimiter, validateSignup, signup);
router.post(
  "/login",
  loginIpLimiter,
  loginAccountLimiter,
  validateLogin,
  login,
);
router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  validateForgotPassword,
  forgotPassword,
);
router.post(
  "/reset-password/:token",
  resetPasswordLimiter,
  validateResetPassword,
  resetPassword,
);

router.get(
  "/username-available/:username",
  usernameCheckLimiter,
  checkUsername,
);

// Was public and returned every user. Now admin-only.
router.get("/users", protect, adminOnly, getAllUsers);

router.get("/me", protect, getMe);

router.put(
  "/update-profile",
  protect,
  upload.single("image"),
  validateUpdateProfile,
  updateProfile,
);
router.put(
  "/change-password",
  protect,
  changePasswordLimiter,
  validateChangePassword,
  changePassword,
);

module.exports = router;
