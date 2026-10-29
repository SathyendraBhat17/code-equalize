const express = require("express");

const {
  SUPPORTED_LANGUAGES,
  SUPPORTED_TARGET_LANGUAGES
} = require("../config/config");
const ragService = require("../services/ragService");

const router = express.Router();

router.post("/", async (req, res) => {
  console.log("[Explain] Request received");
  res.once("finish", () => console.log(`[Explain] Response sent (${res.statusCode})`));
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ error: "Invalid request body: expected a JSON object." });
    }
    const { error, code, language, targetLanguage } = req.body;

    if (!error || typeof error !== "string") {
      return res.status(400).json({
        error: 'Invalid request: "error" is required and must be a string.'
      });
    }

    if (!code || typeof code !== "string") {
      return res.status(400).json({
        error: 'Invalid request: "code" is required and must be a string.'
      });
    }

    if (!SUPPORTED_LANGUAGES.includes(language)) {
      return res.status(400).json({
        error: `Invalid request: "language" must be one of: ${SUPPORTED_LANGUAGES.join(", ")}.`
      });
    }

    if (!SUPPORTED_TARGET_LANGUAGES.includes(targetLanguage)) {
      return res.status(400).json({
        error: `Invalid request: "targetLanguage" must be one of: ${SUPPORTED_TARGET_LANGUAGES.join(", ")}.`
      });
    }

    const result = await ragService.processError(req.body);
    return res.status(200).json(result);
  } catch (err) {
    const status = err.statusCode === 503 ? 503 : 502;
    console.error(`[Explain] Pipeline failed (${status}): ${err.code || err.name || "Error"}`);
    return res.status(status).json({
      error: status === 503
        ? "The explanation service is not configured. Check the backend environment."
        : "The explanation service could not complete the request. Check backend logs and try again."
    });
  }
});

module.exports = router;
