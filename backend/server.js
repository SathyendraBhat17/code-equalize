// server.js — starts the Express server

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const { PORT } = require("./config/config");
const explainRoute = require("./routes/explain");

const app = express();

app.use(express.json());
app.use(cors());

// Routes
app.use("/explain", explainRoute);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});