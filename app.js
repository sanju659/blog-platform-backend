const express = require("express");
const app = express();
// Behind a reverse proxy / load balancer (Nginx, Render, Railway, AWS ALB...),
// req.ip would be the proxy's IP, so every user would share one rate-limit bucket.
// Set TRUST_PROXY to the number of proxies in front of the app (usually 1).
// Leave it unset when running locally or with no proxy.
if (process.env.TRUST_PROXY) {
  app.set("trust proxy", Number(process.env.TRUST_PROXY));
}
const cors = require("cors");
const path = require("path");
require("dotenv").config();

//Importing the DB
const connectDB = require("./config/db");
// Connect to MongoDB
connectDB();

// API can accept JSON requests
app.use(express.json());
// Enable CORS for all routes
app.use(
  cors({
    origin: process.env.CLIENT_URL,
  }),
);

// Serve uploaded images as static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

//importing auth route
const authRoutes = require("./routes/authRoutes");
// importing post route
const postRoutes = require("./routes/postRoutes");
// importing admin route
const adminRoutes = require("./routes/adminRoutes");
// importing reporting route
const reportRoutes = require("./routes/reportRoutes");

// Mounting the Route
app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/reports", reportRoutes);

// app.get('/', (req, res) => {
//   res.send('Hello World!')
// })

// Port from .env (fallback included)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});
