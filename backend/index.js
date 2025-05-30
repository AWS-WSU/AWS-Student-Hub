require('dotenv').config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/database");
const newsletterRoutes = require("./routes/newsletter");

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
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000"],
  credentials: true
}));

// Middleware to parse JSON requests
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/", (req, res) => {
  res.send("AWS-WSU Backend API is running!");
});

// Newsletter routes
app.use("/api/newsletter", newsletterRoutes);

// Protected route we can use later to test authentication
app.get("/api/user", (req, res) => {
  res.json({ message: "User endpoint ready for authentication" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!'
  });
});

// Handle 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});