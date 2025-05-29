const express = require("express");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 5000;

// CORS for frontend requests
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));

// Middleware to parse JSON requests
app.use(express.json());

app.get("/", (req, res) => {
  res.send("AWS-WSU Backend API is running!");
});

// Protected route we can use later to test authentication
app.get("/api/user", (req, res) => {
  res.json({ message: "User endpoint ready for authentication" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});