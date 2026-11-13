const chromaService = require("./chromaService");
const aiService = require("./aiService");

const {
  SIMILARITY_THRESHOLD
} = require("../config/config");

const CHROMA_SEARCH_TIMEOUT_MS = 4000;
const BATCH_CHROMA_CONCURRENCY = 2;

/**
 * Checks whether a ChromaDB result is suitable for reuse.
 */
function isValidChromaMatch(similarResult) {
  if (
    !similarResult ||
    typeof similarResult !== "object"
  ) {
    return false;
  }

  const distance = similarResult.distance;

  return (
    typeof similarResult.explanation === "string" &&
    similarResult.explanation.trim().length > 0 &&
    typeof similarResult.fix === "string" &&
    similarResult.fix.trim().length > 0 &&
    typeof distance === "number" &&
    Number.isFinite(distance) &&
    Number.isFinite(SIMILARITY_THRESHOLD) &&
    distance >= 0 &&
    distance <= SIMILARITY_THRESHOLD
  );
}

/**
 * Prevents slow ChromaDB operations from blocking the pipeline.
 */
function withTimeout(promise, timeoutMs, label) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error(
        `${label} timed out after ${timeoutMs}ms`
      );

      error.code = "CHROMA_TIMEOUT";
      reject(error);
    }, timeoutMs);
  });

  return Promise.race([
    promise,
    timeoutPromise
  ]).finally(() => {
    clearTimeout(timeoutId);
  });
}

/**
 * Searches ChromaDB with a timeout.
 */
async function searchSimilarWithTimeout(error, language) {
  return withTimeout(
    chromaService.searchSimilar(error, language),
    CHROMA_SEARCH_TIMEOUT_MS,
    "ChromaDB search"
  );
}

/**
 * Original single-error RAG pipeline.
 *
 * 1. Search ChromaDB.
 * 2. Use accepted knowledge as Groq context.
 * 3. Generate an explanation.
 * 4. Store new results when no suitable match exists.
 */
const processError = async ({
  error,
  code,
  language,
  targetLanguage
}) => {
  let similarResult = null;

  console.log("[RAG] ChromaDB search started");

  try {
    similarResult = await searchSimilarWithTimeout(
      error,
      language
    );

    console.log(
      `[RAG] ChromaDB search completed: ${
        similarResult ? "result found" : "no result"
      }`
    );
  } catch (err) {
    console.error(
      `[RAG] ChromaDB search failed: ${
        err.code || err.name || "Error"
      }`
    );
  }

  const distance = similarResult?.distance;
  const isValidMatch = isValidChromaMatch(similarResult);

  console.log(
    `[RAG] Match status: ${
      isValidMatch ? "accepted" : "not accepted"
    }`
  );

  console.log(
    `[RAG] Groq request started${
      isValidMatch ? " (using knowledge-base context)" : ""
    }`
  );

  const aiResult = await aiService.generateExplanation({
    error,
    code,
    language,
    targetLanguage,
    ...(isValidMatch
      ? {
          baseExplanation: similarResult.explanation,
          baseFix: similarResult.fix
        }
      : {})
  });

  console.log("[RAG] Groq request completed");

  if (!isValidMatch) {
    try {
      console.log("[RAG] ChromaDB storage started");

      await chromaService.storeResult({
        error,
        language,
        explanation: aiResult.explanation,
        fix: aiResult.fix,
        remember: aiResult.remember
      });

      console.log("[RAG] ChromaDB storage completed");
    } catch (err) {
      console.error(
        `[RAG] ChromaDB storage failed: ${
          err.code || err.name || "Error"
        }`
      );
    }
  }

  return {
    explanation: aiResult.explanation,
    fix: aiResult.fix,
    remember: aiResult.remember ?? null,
    source: isValidMatch ? "ChromaDB" : "AI",
    matchedError: isValidMatch
      ? similarResult.matchedError
      : undefined,
    distance: isValidMatch ? distance : null
  };
};

/**
 * Batch RAG pipeline.
 *
 * 1. Searches ChromaDB for every detected error.
 * 2. Collects accepted knowledge contexts.
 * 3. Sends all errors and available contexts to Groq.
 * 4. Generates individual explanations.
 * 5. Generates one consolidated full-code fix.
 * 6. Generates one Remember section.
 * 7. Stores newly generated error knowledge in ChromaDB.
 */
const processAllErrors = async ({
  code,
  language,
  targetLanguage,
  errors
}) => {
  if (!Array.isArray(errors) || errors.length === 0) {
    const error = new Error(
      "At least one error is required for batch explanation."
    );

    error.statusCode = 400;
    throw error;
  }

  const normalizedErrors = errors.map(item => ({
    id: String(item.id).trim(),
    error: String(item.error).trim(),

    lineNumber:
      typeof item.lineNumber === "number" &&
      Number.isFinite(item.lineNumber)
        ? item.lineNumber
        : undefined,

    errorType:
      item.errorType === "runtime" ||
      item.errorType === "potential"
        ? item.errorType
        : "diagnostic"
  }));

  const knowledgeContexts = [];
  const matchMetaById = new Map();

  let acceptedMatches = 0;

  console.log(
    `[RAG] Batch ChromaDB search started for ${normalizedErrors.length} error(s)`
  );

  // Search errors in controlled batches.
  for (
    let start = 0;
    start < normalizedErrors.length;
    start += BATCH_CHROMA_CONCURRENCY
  ) {
    const batch = normalizedErrors.slice(
      start,
      start + BATCH_CHROMA_CONCURRENCY
    );

    const results = await Promise.all(
      batch.map(async item => {
        try {
          const similarResult = await searchSimilarWithTimeout(
            item.error,
            language
          );

          if (!isValidChromaMatch(similarResult)) {
            return null;
          }

          return {
            errorId: item.id,
            explanation: similarResult.explanation,
            fix: similarResult.fix,
            matchedError: similarResult.matchedError,
            distance: similarResult.distance
          };
        } catch (err) {
          console.error(
            `[RAG] Batch ChromaDB search failed for id=${item.id}: ${
              err.code || err.name || "Error"
            }`
          );

          return null;
        }
      })
    );

    for (const result of results) {
      if (!result) {
        continue;
      }

      acceptedMatches++;

      knowledgeContexts.push(result);

      matchMetaById.set(result.errorId, {
        matchedError: result.matchedError,
        distance: result.distance,
        source: "ChromaDB"
      });
    }
  }

  console.log(
    `[RAG] Batch ChromaDB search completed: ${acceptedMatches} accepted match(es)`
  );

  console.log(
    `[RAG] Batch Groq request started${
      acceptedMatches > 0
        ? " (using knowledge-base context)"
        : ""
    }`
  );

  // One Groq generation for all errors.
  const aiResult = await aiService.generateBatchExplanation({
    code,
    language,
    targetLanguage,
    errors: normalizedErrors,
    knowledgeContexts
  });

  console.log("[RAG] Batch Groq request completed");

  // Index the generated explanations by their original error IDs.
  const generatedById = new Map(
    aiResult.explanations.map(item => [
      item.id,
      item
    ])
  );

  // Build individual explanation results.
  const explanations = normalizedErrors.map(item => {
    const generated = generatedById.get(item.id);
    const meta = matchMetaById.get(item.id);

    if (!generated) {
      throw new Error(
        `Groq response is missing explanation for error id=${item.id}.`
      );
    }

    return {
      id: item.id,
      error: generated.error,
      lineNumber: item.lineNumber,
      errorType: item.errorType,
      explanation: generated.explanation,
      source: meta?.source || "AI",
      matchedError: meta?.matchedError,
      distance: meta ? meta.distance : null
    };
  });

  // Store only newly generated knowledge with a safe,
  // error-specific correction.
  // Never store the consolidated full-file fix as an individual fix.
  for (const item of normalizedErrors) {
    if (matchMetaById.has(item.id)) {
      continue;
    }

    const generated = generatedById.get(item.id);

    if (!generated) {
      continue;
    }

    const individualCorrection =
      generated.individualCorrection;

    // Do not store an unsafe or missing correction.
    if (
      typeof individualCorrection !== "string" ||
      !individualCorrection.trim()
    ) {
      console.warn(
        `[RAG] Skipping ChromaDB storage for id=${item.id}: no safe individual correction.`
      );
      continue;
    }

    try {
      console.log(
        `[RAG] ChromaDB storage started for id=${item.id}`
      );

      await chromaService.storeResult({
        error: item.error,
        language,
        explanation: generated.explanation,
        fix: individualCorrection,
        remember: aiResult.remember
      });

      console.log(
        `[RAG] ChromaDB storage completed for id=${item.id}`
      );
    } catch (err) {
      console.error(
        `[RAG] ChromaDB storage failed for id=${item.id}: ${
          err.code || err.name || "Error"
        }`
      );
    }
  }

  console.log("[RAG] Batch pipeline completed");

  return {
    explanations,
    fix: aiResult.fix,
    remember: aiResult.remember,
    source:
      acceptedMatches === normalizedErrors.length
        ? "ChromaDB"
        : acceptedMatches > 0
          ? "Mixed"
          : "AI"
  };
};

module.exports = {
  processError,
  processAllErrors
};