require('dotenv').config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/database");
const newsletterRoutes = require("./routes/newsletter");
const checkJwt = require("./middleware/auth");
const inviteRoute = require("./routes/discordInvite"); // ✅ Discord Invite Route

const app = express();
const PORT = process.env.PORT || 5001;

// Attempt to connect to MongoDB
connectDB().then(connection => {
  if (connection) {
    console.log("✅ Application ready with MongoDB");
  } else {
    console.log("⚠️  Application ready with temporary storage");
    console.log("📧  Contact Akrm Al-Hakimi for MongoDB configuration");
  }
});

// CORS for frontend requests
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ["http://localhost:5173", "http://localhost:3000"];
app.use(cors({
  origin: corsOrigins,
  credentials: true
}));
// Middleware to parse JSON requests
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health Check Route
app.get("/", (req, res) => {
  res.send("AWS-WSU Backend API is running!");
});

// Newsletter Routes
app.use("/api/newsletter", newsletterRoutes);

// Discord Invite Route
app.use("/api", inviteRoute); // Now /api/discord-invite will work

// Protected Test Route (for Auth)
app.get("/api/user", checkJwt, (req, res) => {
  res.json({
    message: "User endpoint ready for authentication",
    user: req.auth
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!'
  });
});

// 404 Handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
