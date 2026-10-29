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

// Keep parser and other middleware failures in the API's JSON contract.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500
    ? err.status
    : 500;
  console.error(`[HTTP] Middleware failed (${status}): ${err.type || err.name || "Error"}`);
  return res.status(status).json({ error: status === 400
    ? "Invalid JSON request body."
    : "Request could not be processed." });
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
