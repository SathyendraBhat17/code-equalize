
const express = require("express");

const {
  SUPPORTED_LANGUAGES,
  SUPPORTED_TARGET_LANGUAGES
} = require("../config/config");

const ragService = require("../services/ragService");

const router = express.Router();

const VALID_ERROR_TYPES = [
  "diagnostic",
  "runtime",
  "potential"
];

function validateCommonFields(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Invalid request body: expected a JSON object.";
  }

  const { code, language, targetLanguage } = body;

  if (typeof code !== "string" || !code.trim()) {
    return 'Invalid request: "code" is required and must be a non-empty string.';
  }

  if (!SUPPORTED_LANGUAGES.includes(language)) {
    return `"language" must be one of: ${SUPPORTED_LANGUAGES.join(", ")}.`;
  }

  if (!SUPPORTED_TARGET_LANGUAGES.includes(targetLanguage)) {
    return `"targetLanguage" must be one of: ${SUPPORTED_TARGET_LANGUAGES.join(", ")}.`;
  }

  return null;
}

function handlePipelineError(label, err, res) {
  const status = err.statusCode === 503 ? 503 : 502;

  console.error(`[${label}] Pipeline failed (${status}):`, err);
  console.error(`[${label}] Error message:`, err.message);
  console.error(`[${label}] Stack:`, err.stack);

  return res.status(status).json({
    error: status === 503
      ? "The explanation service is not configured. Check the backend environment."
      : "The explanation service could not complete the request. Check backend logs and try again."
  });
}

/**
 * Existing single-error endpoint.
 * POST /explain
 */
router.post("/", async (req, res) => {
  console.log("[Explain] Request received");

  res.once("finish", () => {
    console.log(`[Explain] Response sent (${res.statusCode})`);
  });

  try {
    const validationError = validateCommonFields(req.body);

    if (validationError) {
      return res.status(400).json({
        error: validationError
      });
    }

    const { error, errorType = "diagnostic" } = req.body;

    if (typeof error !== "string" || !error.trim()) {
      return res.status(400).json({
        error: '"error" is required and must be a non-empty string.'
      });
    }

    if (!VALID_ERROR_TYPES.includes(errorType)) {
      return res.status(400).json({
        error: `"errorType" must be one of: ${VALID_ERROR_TYPES.join(", ")}.`
      });
    }

    const result = await ragService.processError({
      ...req.body,
      errorType
    });

    return res.status(200).json(result);

  } catch (err) {
    return handlePipelineError("Explain", err, res);
  }
});

/**
 * Batch endpoint.
 * POST /explain/all
 *
 * Generates one explanation per error, together with
 * one consolidated code fix and one Remember section.
 */
router.post("/all", async (req, res) => {
  console.log("[Explain All] Batch request received");

  res.once("finish", () => {
    console.log(`[Explain All] Response sent (${res.statusCode})`);
  });

  try {
    const validationError = validateCommonFields(req.body);

    if (validationError) {
      return res.status(400).json({
        error: validationError
      });
    }

    const { errors } = req.body;

    if (!Array.isArray(errors) || errors.length === 0) {
      return res.status(400).json({
        error: '"errors" must be a non-empty array.'
      });
    }

    const seenIds = new Set();

    for (let index = 0; index < errors.length; index++) {
      const item = errors[index];

      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return res.status(400).json({
          error: `Invalid error entry at index ${index}.`
        });
      }

      if (
        typeof item.id !== "string" ||
        !item.id.trim() ||
        typeof item.error !== "string" ||
        !item.error.trim()
      ) {
        return res.status(400).json({
          error: `Error entry at index ${index} requires a valid id and error message.`
        });
      }

      if (seenIds.has(item.id)) {
        return res.status(400).json({
          error: `Duplicate error id: ${item.id}.`
        });
      }

      seenIds.add(item.id);

      if (
        item.lineNumber !== undefined &&
        (
          !Number.isInteger(item.lineNumber) ||
          item.lineNumber < 0
        )
      ) {
        return res.status(400).json({
          error: `Invalid lineNumber for error id=${item.id}.`
        });
      }

      if (!VALID_ERROR_TYPES.includes(item.errorType)) {
        return res.status(400).json({
          error: `Invalid errorType for error id=${item.id}.`
        });
      }
    }

    const result = await ragService.processAllErrors({
      code: req.body.code,
      language: req.body.language,
      targetLanguage: req.body.targetLanguage,
      errors
    });

    return res.status(200).json(result);

  } catch (err) {
    return handlePipelineError("Explain All", err, res);
  }
});

module.exports = router;
