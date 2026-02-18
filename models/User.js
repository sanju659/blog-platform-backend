const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 5,
    },
    image: {
      type: String,
      default: "https://cdn-icons-png.flaticon.com/512/149/149071.png",
    },
    // Role field for admin functionality
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    // Status field for user suspension/ban
    status: {
      type: String,
      enum: ["active", "suspended", "banned"],
      default: "active",
    },
    // Optional: Store reason for suspension/ban
    statusReason: {
      type: String,
      default: null,
    },
    // Optional: When status was changed
    statusChangedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
