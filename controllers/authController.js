const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Sign Up
exports.signup = async (req, res) => {
  try {
    const { fullName, email, password, image } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        message: "User already exists",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      fullName,
      email,
      password: hashedPassword,
      image,
    });

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        image: user.image,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
    });
  }
};

// Login
exports.login = async (req, res) => { 
  try {
    const { email, password } = req.body;

    // Validation(Validation done in express validator)
    // if (!email || !password) {
    //   return res.status(400).json({
    //     message: "Email and password required",
    //   });
    // }

    // Check user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    // Generate JWT
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.status(200).json({
      message: "Login successful",
      token: token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        image: user.image,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get All User
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");

    res.status(200).json({
      count: users.length,
      users,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get logged-in user
exports.getMe = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      message: "Not authorized",
    });
  }

  res.status(200).json(req.user);
};

// Update Profile
exports.updateProfile = async (req, res) => {
  try {
    const { fullName, email } = req.body;

    // Check if email is already taken by another user
    if (email) {
      const existingUser = await User.findOne({
        email,
        _id: { $ne: req.user._id },
      });
      if (existingUser) {
        return res.status(409).json({
          message: "Email is already taken",
        });
      }
    }

    // Get image path from uploaded file (if exists)
    const imagePath = req.file
      ? `${process.env.BASE_URL}/uploads/${req.file.filename}`
      : null;

    // Update only provided fields
    if (fullName) req.user.fullName = fullName;
    if (email) req.user.email = email;
    if (imagePath) req.user.image = imagePath;

    await req.user.save();

    res.status(200).json({
      message: "Profile updated successfully",
      user: {
        id: req.user._id,
        fullName: req.user.fullName,
        email: req.user.email,
        image: req.user.image,
        role: req.user.role,
        createdAt: req.user.createdAt,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
    });
  }
};


// Change Password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user with password (req.user doesn't have password since we use .select("-password"))
    const user = await User.findById(req.user._id);

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        message: "Current password is incorrect",
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    await user.save();

    res.status(200).json({
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
    });
  }
};