const express = require("express");
const app = express();
require("dotenv").config();

//Importing the DB
const connectDB = require("./config/db");
// Connect to MongoDB
connectDB();

// API can accept JSON requests
app.use(express.json());

//importing auth route
const authRoutes = require("./routes/authRoutes");
// importing post route
const postRoutes = require("./routes/postRoutes");

// Mounting the Route
app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);

// app.get('/', (req, res) => {
//   res.send('Hello World!')
// })

// Port from .env (fallback included)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});
