const express = require("express");

const {
  SUPPORTED_LANGUAGES,
  SUPPORTED_TARGET_LANGUAGES
} = require("../config/config");
const ragService = require("../services/ragService");

const router = express.Router();

const SUPPORTED_ERROR_TYPES = new Set([
  "diagnostic",
  "runtime",
  "potential"
]);

router.post("/", async (req, res) => {
  console.log("[ExplainAll] Request received");
  res.once("finish", () =>
    console.log(`[ExplainAll] Response sent (${res.statusCode})`)
  );

  try {
    if (
      !req.body ||
      typeof req.body !== "object" ||
      Array.isArray(req.body)
    ) {
      return res.status(400).json({
        error: "Invalid request body: expected a JSON object."
      });
    }

    const { code, language, targetLanguage, errors } = req.body;

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

    if (!Array.isArray(errors) || errors.length === 0) {
      return res.status(400).json({
        error: 'Invalid request: "errors" must be a non-empty array.'
      });
    }

    if (errors.length > 20) {
      return res.status(400).json({
        error: 'Invalid request: "errors" may contain at most 20 items.'
      });
    }

    const seenIds = new Set();

    for (let index = 0; index < errors.length; index++) {
      const item = errors[index];

      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return res.status(400).json({
          error: `Invalid request: errors[${index}] must be an object.`
        });
      }

      if (!item.id || typeof item.id !== "string" || !item.id.trim()) {
        return res.status(400).json({
          error: `Invalid request: errors[${index}].id is required.`
        });
      }

      if (
        !item.error ||
        typeof item.error !== "string" ||
        !item.error.trim()
      ) {
        return res.status(400).json({
          error: `Invalid request: errors[${index}].error is required.`
        });
      }

      if (
        item.errorType !== undefined &&
        !SUPPORTED_ERROR_TYPES.has(item.errorType)
      ) {
        return res.status(400).json({
          error: `Invalid request: errors[${index}].errorType must be diagnostic, runtime, or potential.`
        });
      }

      if (
        item.lineNumber !== undefined &&
        (
          typeof item.lineNumber !== "number" ||
          !Number.isFinite(item.lineNumber) ||
          item.lineNumber < 0
        )
      ) {
        return res.status(400).json({
          error: `Invalid request: errors[${index}].lineNumber must be a non-negative number.`
        });
      }

      const id = item.id.trim();

      if (seenIds.has(id)) {
        return res.status(400).json({
          error: `Invalid request: duplicate error id "${id}".`
        });
      }

      seenIds.add(id);
    }

    const result = await ragService.processAllErrors({
      code,
      language,
      targetLanguage,
      errors
    });

    return res.status(200).json(result);
  } catch (err) {
    const status =
      err.statusCode === 400
        ? 400
        : err.statusCode === 503
          ? 503
          : 502;

    console.error(`[ExplainAll] Pipeline failed (${status}):`, err);
    console.error("[ExplainAll] Error message:", err.message);
    console.error("[ExplainAll] Stack:", err.stack);

    return res.status(status).json({
      error:
        status === 400
          ? err.message
          : status === 503
            ? "The explanation service is not configured. Check the backend environment."
            : "The explanation service could not complete the request. Check backend logs and try again."
    });
  }
});

module.exports = router;
