const express = require("express");
const app = express();
const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
  res.send("AWS-WSU Backend API is running!");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
