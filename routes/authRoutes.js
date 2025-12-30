const express = require("express");
const {
  signup,
  login,
  getAllUsers,
  getMe,
} = require("../controllers/authController");
const protect = require("../middlewares/auth_middle_ware");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/users", getAllUsers);
// Protected route
router.get("/me", protect, getMe);

module.exports = router;
