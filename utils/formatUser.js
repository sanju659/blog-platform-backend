const { getUsernameLockedUntil } = require("./username");

const formatUser = (user) => ({
  id: user._id,
  fullName: user.fullName,
  username: user.username,
  bio: user.bio || "",
  email: user.email,
  image: user.image,
  role: user.role,
  createdAt: user.createdAt,
  // null when the username can be changed now, otherwise the unlock date
  usernameLockedUntil: getUsernameLockedUntil(user.usernameChangedAt),
});

module.exports = formatUser;
