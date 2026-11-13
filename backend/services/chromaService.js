const { ChromaClient } = require("chromadb");
const { DefaultEmbeddingFunction } = require("@chroma-core/default-embed");

const {
  CHROMA_HOST,
  CHROMA_PORT,
  TOP_K_RESULTS
} = require("../config/config");

const client = new ChromaClient({
  host: CHROMA_HOST,
  port: Number(CHROMA_PORT)
});

const COLLECTION_NAME = "code_errors";

const embeddingFunction = new DefaultEmbeddingFunction();

let collection = null;

function getResultLimit() {
  const limit = Number(TOP_K_RESULTS);

  if (!Number.isInteger(limit) || limit < 1) {
    return 3;
  }

  return limit;
}

/**
 * Get or create the persistent knowledge-base collection.
 */
async function getCollection() {
  if (collection) {
    return collection;
  }

  collection = await client.getOrCreateCollection({
    name: COLLECTION_NAME,
    metadata: {
      description: "Programming Error Knowledge Base"
    },
    embeddingFunction
  });

  return collection;
}

/**
 * Search for similar errors within the same programming language.
 */
async function searchSimilar(errorText, language) {
  if (
    typeof errorText !== "string" ||
    !errorText.trim() ||
    typeof language !== "string" ||
    !language.trim()
  ) {
    throw new TypeError("A valid error message and language are required.");
  }

  const col = await getCollection();
  const count = await col.count();

  if (count === 0) {
    return null;
  }

  const results = await col.query({
    queryTexts: [errorText.trim()],
    nResults: Math.min(getResultLimit(), count),
    where: {
      language
    },
    include: [
      "documents",
      "metadatas",
      "distances"
    ]
  });

  const matchedError = results.documents?.[0]?.[0];
  const metadata = results.metadatas?.[0]?.[0];
  const distance = results.distances?.[0]?.[0];

  if (
    typeof matchedError !== "string" ||
    !metadata ||
    typeof metadata.explanation !== "string" ||
    typeof metadata.fix !== "string"
  ) {
    return null;
  }

  return {
    matchedError,
    explanation: metadata.explanation,
    fix: metadata.fix,
    remember:
      typeof metadata.remember === "string"
        ? metadata.remember
        : null,
    distance:
      typeof distance === "number" && Number.isFinite(distance)
        ? distance
        : null,
    source: "ChromaDB"
  };
}

/**
 * Store a newly generated explanation in the knowledge base.
 */
async function storeResult({
  error,
  language,
  explanation,
  fix,
  remember
}) {
  if (
    typeof error !== "string" || !error.trim() ||
    typeof language !== "string" || !language.trim() ||
    typeof explanation !== "string" || !explanation.trim() ||
    typeof fix !== "string" || !fix.trim()
  ) {
    throw new TypeError("Invalid information provided for ChromaDB storage.");
  }

  const col = await getCollection();

  const id =
    `${language}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const metadata = {
    language,
    explanation,
    fix
  };

  if (typeof remember === "string" && remember.trim()) {
    metadata.remember = remember.trim();
  }

  await col.add({
    ids: [id],
    documents: [error.trim()],
    metadatas: [metadata]
  });

  console.log("[ChromaDB] Result stored successfully");

  return id;
}

/**
 * Get the total number of records in the knowledge base.
 */
async function getCount() {
  const col = await getCollection();
  return col.count();
}

/**
 * Inspect a stored knowledge-base record by its error text.
 * Read-only: does not modify the collection.
 */
async function inspectStoredResult(errorText, language) {
  if (
    typeof errorText !== "string" ||
    !errorText.trim() ||
    typeof language !== "string" ||
    !language.trim()
  ) {
    throw new TypeError("A valid error message and language are required.");
  }

  const col = await getCollection();

  const results = await col.get({
    where: { language },
    include: ["documents", "metadatas"]
  });

  const index = results.documents?.findIndex(
    document => document === errorText.trim()
  );

  if (index === undefined || index === -1) {
    return null;
  }

  return {
    id: results.ids[index],
    error: results.documents[index],
    metadata: results.metadatas[index]
  };
}

/**
 * Delete and recreate the knowledge-base collection.
 * WARNING: This permanently deletes its existing records.
 */
async function clearCollection() {
  collection = null;

  try {
    await client.deleteCollection({
      name: COLLECTION_NAME
    });

    collection = await client.getOrCreateCollection({
      name: COLLECTION_NAME,
      metadata: {
        description: "Programming Error Knowledge Base"
      },
      embeddingFunction
    });

    console.log("[ChromaDB] Collection cleared successfully");

  } catch (error) {
    collection = null;

    console.error(
      `[ChromaDB] Clear failed: ${error.code || error.name || "Error"}`
    );

    throw error;
  }
}

module.exports = {
  searchSimilar,
  storeResult,
  getCount,
  inspectStoredResult,
  clearCollection
};