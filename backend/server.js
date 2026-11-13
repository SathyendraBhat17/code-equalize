/**
 * Code Equalize - Backend Server
 * Starts the Express API and registers middleware and routes.
 */

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const { PORT } = require("./config/config");
const explainRoute = require("./routes/explain");

const app = express();

// Middleware.
app.use(cors());

app.use(
  express.json({
    limit: "1mb"
  })
);

// Health check.
app.get("/health", (req, res) => {
  return res.status(200).json({
    status: "ok",
    service: "Code Equalize Backend"
  });
});

// API routes.
app.use("/explain", explainRoute);

// Handle unknown endpoints.
app.use((req, res) => {
  return res.status(404).json({
    error: "The requested API endpoint was not found."
  });
});

// Centralized error handling.
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const isInvalidJson =
    err instanceof SyntaxError &&
    err.status === 400 &&
    Object.prototype.hasOwnProperty.call(err, "body");

  if (isInvalidJson) {
    console.error("[HTTP] Invalid JSON request body");

    return res.status(400).json({
      error: "Invalid JSON request body."
    });
  }

  const status =
    Number.isInteger(err.status) &&
    err.status >= 400 &&
    err.status < 500
      ? err.status
      : 500;

  console.error(
    `[HTTP] Request failed (${status}): ${err.type || err.name || "Error"}`
  );

  return res.status(status).json({
    error: status === 413
      ? "Request body is too large."
      : "Request could not be processed."
  });
});

// Start the server.
const server = app.listen(PORT, () => {
  console.log(`[Server] Code Equalize backend running on port ${PORT}`);
});

// Handle startup/runtime server errors.
server.on("error", (err) => {
  console.error(`[Server] Failed to start: ${err.message}`);
  process.exitCode = 1;
});

module.exports = { app, server };