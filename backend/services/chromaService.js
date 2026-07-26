const { ChromaClient } = require("chromadb");
const { CHROMA_HOST, CHROMA_PORT, TOP_K_RESULTS } = require("../config/config");

const client = new ChromaClient({
  host: CHROMA_HOST,
  port: Number(CHROMA_PORT)
});

const COLLECTION_NAME = "code_errors";
let collection = null;

// Get or create collection
async function getCollection() {
  if (collection) return collection;

  collection = await client.getOrCreateCollection({
    name: COLLECTION_NAME,
    metadata: {
      description: "Programming Error Knowledge Base"
    }
  });

  return collection;
}

// Clear collection before reseeding
async function clearCollection() {
  try {
    collection = null;

    try {
      await client.deleteCollection({
        name: COLLECTION_NAME
      });
    } catch (err) {
      // Collection may not exist
    }

    collection = await client.getOrCreateCollection({
      name: COLLECTION_NAME,
      metadata: {
        description: "Programming Error Knowledge Base"
      }
    });

    console.log("✅ ChromaDB collection cleared.");
  } catch (err) {
    console.error("Failed to clear collection:", err);
  }
}

// Search similar errors
async function searchSimilar(errorText, language) {
  try {
    const col = await getCollection();

    const count = await col.count();

    if (count === 0) return null;

    let results = await col.query({
      queryTexts: [errorText],
      nResults: Math.min(TOP_K_RESULTS, count),
      where: {
        language
      }
    });

    // fallback without language filter
    if (
      !results.documents?.[0] ||
      results.documents[0].length === 0
    ) {
      results = await col.query({
        queryTexts: [errorText],
        nResults: Math.min(TOP_K_RESULTS, count)
      });
    }

    if (
      !results.documents?.[0] ||
      results.documents[0].length === 0
    ) {
      return null;
    }

    return {
  matchedError: results.documents[0][0],
  explanation: results.metadatas[0][0].explanation,
  fix: results.metadatas[0][0].fix,
  distance: results.distances?.[0]?.[0] ?? null,
  source: "RAG"
};

  } catch (err) {
    console.error("ChromaDB search failed:", err);
    return null;
  }
}

// Store new result
async function storeResult({
  error,
  language,
  explanation,
  fix
}) {
  try {
    const col = await getCollection();

    const id =
      `${language}_${Date.now()}_${Math.random()}`
        .replace(/\./g, "_");

    await col.add({
      ids: [id],
      documents: [error],
      metadatas: [{
        language,
        explanation,
        fix
      }]
    });

    console.log(`✅ Stored: ${error}`);

  } catch (err) {
    console.error("ChromaDB store failed:", err);
  }
}

// Count entries
async function getCount() {
  try {
    const col = await getCollection();
    return await col.count();
  } catch (err) {
    console.error(err);
    return 0;
  }
}

module.exports = {
  searchSimilar,
  storeResult,
  getCount,
  clearCollection
};