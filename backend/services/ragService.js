const chromaService = require("./chromaService");
const aiService = require("./aiService");
const { SIMILARITY_THRESHOLD } = require("../config/config");

// Process an error request using the RAG pipeline
const processError = async (requestData) => {
  const { error, code, language, targetLanguage } = requestData;

  const safeFallback = {
  explanation: "Unable to generate explanation right now. Please try again in a moment.",
  fix: "Check the error message and review the related code lines carefully.",
  remember: "Programming errors are normal. Read the error message carefully and try again.",
  source: "AI"
};

  try {
    let similarResult = null;

    // Step 1: Search similar errors from ChromaDB
    try {
      similarResult = await chromaService.searchSimilar(error, language);
    } catch (searchError) {
      console.error("ChromaDB search failed:", searchError);
    }

    // Step 2: If a good match exists, translate/use the stored explanation
    if (
      similarResult &&
      (similarResult.distance === null ||
        similarResult.distance <= SIMILARITY_THRESHOLD)
    ) {
      const translatedResult = await aiService.generateExplanation({
        error,
        code,
        language,
        targetLanguage,
        baseExplanation: similarResult.explanation,
        baseFix: similarResult.fix
      });

      return {
        explanation: translatedResult.explanation,
        fix: translatedResult.fix,
        remember: translatedResult.remember,
        source: "ChromaDB",
        matchedError: similarResult.matchedError,
        similarity: similarResult.distance !== null
          ? Math.max(0, Math.min(100, Math.round((1 - similarResult.distance) * 100)))
          : null
      };
    }

    // Step 3: Otherwise generate a new explanation
    const aiResult = await aiService.generateExplanation({
      error,
      code,
      language,
      targetLanguage
    });

    const response = {
      explanation: aiResult.explanation,
      fix: aiResult.fix,
      remember: aiResult.remember,
      source: "AI"
    };

    // Step 4: Store new result for future retrieval
    try {
      await chromaService.storeResult({
        error,
        language,
        explanation: aiResult.explanation,
        fix: aiResult.fix
      });
    } catch (storeError) {
      console.error("Store result skipped:", storeError);
    }

    return response;

  } catch (err) {
    console.error("RAG pipeline failed:", err);
    return safeFallback;
  }
};

module.exports = {
  processError
};