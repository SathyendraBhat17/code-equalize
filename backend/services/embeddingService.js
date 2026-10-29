const { DefaultEmbeddingFunction } = require("@chroma-core/default-embed");

// Use the same local semantic embedding model ChromaDB's default queryTexts
// and documents path uses; never return random vectors as semantic data.
const embeddingFunction = new DefaultEmbeddingFunction();

async function getEmbedding(errorText) {
  if (typeof errorText !== "string" || !errorText.trim()) {
    throw new TypeError("errorText must be a non-empty string");
  }
  const [embedding] = await embeddingFunction.generate([errorText]);
  return embedding;
}

module.exports = { getEmbedding };
