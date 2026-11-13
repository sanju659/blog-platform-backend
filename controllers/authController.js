const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { compressAndSaveImage } = require("../utils/imageProcessor");
const { deleteByUrl } = require("../utils/storage");
const crypto = require("crypto");
const { sendPasswordResetEmail } = require("../utils/sendEmail");

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

    // Compress and save the uploaded profile image (if provided)
    let imagePath = null;
    if (req.file) {
      imagePath = await compressAndSaveImage(req.file.buffer);
    }

    const oldImage = req.user.image;

    if (fullName) req.user.fullName = fullName;
    if (email) req.user.email = email;
    if (imagePath) req.user.image = imagePath;

    await req.user.save();

    if (imagePath) {
      await deleteByUrl(oldImage);
    }

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

const RESET_TOKEN_TTL_MINUTES = 15;
const RESET_COOLDOWN_MS = 60 * 1000;

// Forgot Password
exports.forgotPassword = async (req, res) => {
  // Same response for every outcome, so the API never reveals which emails exist
  const genericResponse = {
    message:
      "If an account with that email exists, a password reset link has been sent.",
  };

  try {
    const { email } = req.body;

    const user = await User.findOne({ email }).select("+passwordResetExpires");

    if (!user) {
      return res.status(200).json(genericResponse);
    }

    // Cooldown: skip if a reset email was issued in the last 60 seconds
    if (user.passwordResetExpires) {
      const issuedAt =
        user.passwordResetExpires.getTime() -
        RESET_TOKEN_TTL_MINUTES * 60 * 1000;
      if (Date.now() - issuedAt < RESET_COOLDOWN_MS) {
        return res.status(200).json(genericResponse);
      }
    }

    // Plain token goes in the email; only its hash is stored
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordResetToken: hashedToken,
          passwordResetExpires: new Date(
            Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000,
          ),
        },
      },
    );

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    // Respond first, then send in the background (keeps timing identical)
    res.status(200).json(genericResponse);

    sendPasswordResetEmail({
      to: user.email,
      name: user.fullName,
      resetUrl,
      expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
    }).catch(async (err) => {
      console.error("Failed to send reset email:", err.message);
      // Email never went out, so the token is useless: remove it
      await User.updateOne(
        { _id: user._id },
        { $set: { passwordResetToken: null, passwordResetExpires: null } },
      ).catch(() => {});
    });
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      // Still generic: don't leak internal state
      res.status(200).json(genericResponse);
    }
  }
};

// Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Atomic: find a valid, unexpired token AND consume it in one operation
    const user = await User.findOneAndUpdate(
      {
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: new Date() },
      },
      {
        $set: {
          password: hashedPassword,
          passwordChangedAt: new Date(), // invalidates all older JWTs
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      },
    );

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired reset link",
      });
    }

    res.status(200).json({
      message: "Password changed successfully. Please log in.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
