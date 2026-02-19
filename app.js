const express = require("express");
const app = express();
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
app.use(cors());

// Serve uploaded images as static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

//importing auth route
const authRoutes = require("./routes/authRoutes");
// importing post route
const postRoutes = require("./routes/postRoutes");
// importing admin route
const adminRoutes = require("./routes/adminRoutes");

// Mounting the Route
app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/admin", adminRoutes);

// app.get('/', (req, res) => {
//   res.send('Hello World!')
// })

// Port from .env (fallback included)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});
