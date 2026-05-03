const express = require("express");

const {
  SUPPORTED_LANGUAGES,
  SUPPORTED_TARGET_LANGUAGES
} = require("../config/config");
const ragService = require("../services/ragService");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
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
    console.error("Error in /explain route:", err);
    return res.status(500).json({
      error: "Failed to process explanation request."
    });
  }
});

module.exports = router;