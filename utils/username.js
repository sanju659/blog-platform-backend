const USERNAME_MIN = 3;
const USERNAME_MAX = 20;

const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "root",
  "support",
  "help",
  "system",
  "moderator",
  "mod",
  "staff",
  "official",
  "blogspace",
  "api",
  "www",
  "me",
  "null",
  "undefined",
  "login",
  "logout",
  "signup",
  "register",
  "profile",
  "profiles",
  "user",
  "users",
  "dashboard",
  "settings",
  "posts",
  "post",
  "create",
  "edit",
  "delete",
  "reports",
  "report",
  "about",
  "terms",
  "privacy",
  "contact",
  "home",
  "explore",
  "search",
  "follow",
  "followers",
  "following",
]);

const normalizeUsername = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

// Returns an error message, or null if the (already normalized) username is valid
const getUsernameError = (username) => {
  if (username.length < USERNAME_MIN) {
    return `Username must be at least ${USERNAME_MIN} characters`;
  }
  if (username.length > USERNAME_MAX) {
    return `Username cannot exceed ${USERNAME_MAX} characters`;
  }
  if (!/^[a-z]/.test(username)) {
    return "Username must start with a letter";
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    return "Username can only contain lowercase letters, numbers and underscores";
  }
  if (RESERVED_USERNAMES.has(username)) {
    return "This username is not available";
  }
  return null;
};

const USERNAME_CHANGE_COOLDOWN_DAYS = 30;

// Returns the Date until which the username is locked, or null if it can be changed now
const getUsernameLockedUntil = (changedAt) => {
  if (!changedAt) return null;
  const until = new Date(
    new Date(changedAt).getTime() +
      USERNAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
  );
  return until > new Date() ? until : null;
};

module.exports = {
  USERNAME_MIN,
  USERNAME_MAX,
  USERNAME_CHANGE_COOLDOWN_DAYS,
  RESERVED_USERNAMES,
  normalizeUsername,
  getUsernameError,
  getUsernameLockedUntil,
};
