const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

const minutes = (n) => n * 60 * 1000;

// Shared options: JSON 429 response, standard RateLimit-* headers
const build = (options) =>
  rateLimit({
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ message: options.message }),
    ...options,
  });

// Login: 10 attempts / 15 min per IP, counting only FAILED attempts
const loginIpLimiter = build({
  windowMs: minutes(15),
  limit: 10,
  skipSuccessfulRequests: true,
  message: "Too many login attempts. Please try again in 15 minutes.",
});

// Login: 5 failed attempts / 15 min per IP + email combination
// (slows password guessing on one account without locking the real owner out
// from other networks)
const loginAccountLimiter = build({
  windowMs: minutes(15),
  limit: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) =>
    `${ipKeyGenerator(req.ip)}:${String(req.body?.email || "").toLowerCase()}`,
  message: "Too many login attempts. Please try again in 15 minutes.",
});

// Forgot password: 5 requests / hour per IP
const forgotPasswordLimiter = build({
  windowMs: minutes(60),
  limit: 5,
  message: "Too many reset requests. Please try again later.",
});

// Reset password: 10 attempts / 15 min per IP (stops token guessing)
const resetPasswordLimiter = build({
  windowMs: minutes(15),
  limit: 10,
  message: "Too many attempts. Please try again later.",
});

// Signup: 10 accounts / hour per IP
const signupLimiter = build({
  windowMs: minutes(60),
  limit: 10,
  message: "Too many accounts created from this network. Try again later.",
});

// Change password (logged in): 10 attempts / 15 min per IP
const changePasswordLimiter = build({
  windowMs: minutes(15),
  limit: 10,
  skipSuccessfulRequests: true,
  message: "Too many attempts. Please try again later.",
});

// Username availability check: 30 / min per IP (the signup form checks while typing)
const usernameCheckLimiter = build({
  windowMs: minutes(1),
  limit: 30,
  message: "Too many checks. Please slow down.",
});

// Follow / unfollow: 100 actions / hour per logged-in user (must run after `protect`)
const followLimiter = build({
  windowMs: minutes(60),
  limit: 100,
  keyGenerator: (req) => String(req.user._id),
  message: "You're following too fast. Please try again later.",
});

module.exports = {
  loginIpLimiter,
  loginAccountLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  signupLimiter,
  changePasswordLimiter,
  usernameCheckLimiter,
  followLimiter,
};
