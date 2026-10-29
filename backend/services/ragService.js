const chromaService = require("./chromaService");
const aiService = require("./aiService");
const { SIMILARITY_THRESHOLD } = require("../config/config");

// Process an error using retrieved context when available, then ask Groq.
const processError = async ({ error, code, language, targetLanguage }) => {
  let similarResult = null;

  // Retrieval is optional; Groq can still explain an error without ChromaDB.
  console.log("[RAG] ChromaDB search started");
  try {
    similarResult = await chromaService.searchSimilar(error, language);
    console.log(`[RAG] ChromaDB search completed (${similarResult ? "match" : "no match"})`);
  } catch (err) {
    console.error(`[RAG] ChromaDB search failed: ${err.code || err.name || "Error"}`);
  }

  const isMatch = similarResult &&
    (similarResult.distance === null || similarResult.distance <= SIMILARITY_THRESHOLD);
  console.log(`[RAG] Groq request started${isMatch ? " (matched context)" : ""}`);
  const aiResult = await aiService.generateExplanation({
    error,
    code,
    language,
    targetLanguage,
    ...(isMatch ? {
      baseExplanation: similarResult.explanation,
      baseFix: similarResult.fix
    } : {})
  });
  console.log("[RAG] Groq request completed");

  if (isMatch) {
    return {
      explanation: aiResult.explanation,
      fix: aiResult.fix,
      remember: aiResult.remember,
      source: "ChromaDB",
      matchedError: similarResult.matchedError,
      similarity: similarResult.distance !== null
        ? Math.max(0, Math.min(100, Math.round((1 - similarResult.distance) * 100)))
        : null
    };
  }

  try {
    console.log("[RAG] ChromaDB storage started");
    await chromaService.storeResult({ error, language, explanation: aiResult.explanation, fix: aiResult.fix });
    console.log("[RAG] ChromaDB storage completed");
  } catch (err) {
    console.error(`[RAG] ChromaDB storage failed: ${err.code || err.name || "Error"}`);
  }

  return {
    explanation: aiResult.explanation,
    fix: aiResult.fix,
    remember: aiResult.remember,
    source: "AI"
  };
};

module.exports = { processError };
