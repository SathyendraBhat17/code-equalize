const chromaService = require("./chromaService");
const embeddingService = require("./embeddingService");
const aiService = require("./aiService");
const { SIMILARITY_THRESHOLD } = require("../config/config");

// Processes an error request using a mock RAG flow.
const processError = async (requestData) => {
  const { error, code, language, targetLanguage } = requestData;

  const safeFallback = {
    explanation:
      "Unable to generate explanation right now. Please try again in a moment.",
    fix: "Check the error message and review the related code lines carefully.",
    source: "AI"
  };

  try {
    let embedding = null;
    let similarResult = null;

    // Step 1: Create embedding from the error text (mock service).
    try {
      embedding = await embeddingService.getEmbedding(error);
    } catch (embeddingError) {
      console.error("Embedding step failed:", embeddingError);
    }

    // Step 2: Search similar errors from mock ChromaDB.
    if (embedding) {
      try {
        similarResult = await chromaService.searchSimilar(embedding);
      } catch (searchError) {
        console.error("Chroma search failed:", searchError);
      }
    }

    // Step 3: If similarity passes threshold, translate and return DB result.
    if (
      similarResult &&
      typeof similarResult.similarity === "number" &&
      similarResult.similarity >= SIMILARITY_THRESHOLD
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
        source: "ChromaDB"
      };
    }

    // Step 4: Fallback to AI generation (mock service).
    const aiResult = await aiService.generateExplanation({
      error,
      code,
      language,
      targetLanguage
    });

    const response = {
      explanation: aiResult.explanation,
      fix: aiResult.fix,
      source: "AI"
    };

    // Step 5: Optionally store new AI result for future retrieval.
    try {
      await chromaService.storeResult({
        error,
        language,
        explanation: aiResult.explanation,
        fix: aiResult.fix
      });
    } catch (storeError) {
      console.error("Store result skipped due to error:", storeError);
    }

    return response;

  } catch (error) {
    console.error("RAG pipeline failed:", error);
    return safeFallback;
  }
};

module.exports = {
  processError
};