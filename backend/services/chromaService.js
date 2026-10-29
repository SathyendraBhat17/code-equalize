const { ChromaClient } = require("chromadb");
const { CHROMA_HOST, CHROMA_PORT, TOP_K_RESULTS } = require("../config/config");

const client = new ChromaClient({ host: CHROMA_HOST, port: Number(CHROMA_PORT) });
const COLLECTION_NAME = "code_errors";
let collection = null;

async function getCollection() {
  if (collection) return collection;
  // ChromaDB's installed default embedding function handles queryTexts and
  // documents consistently. No synthetic/random vectors are used here.
  collection = await client.getOrCreateCollection({
    name: COLLECTION_NAME,
    metadata: { description: "Programming Error Knowledge Base" }
  });
  return collection;
}

async function clearCollection() {
  try {
    collection = null;
    try {
      await client.deleteCollection({ name: COLLECTION_NAME });
    } catch {
      // The collection may not exist yet.
    }
    collection = await client.getOrCreateCollection({
      name: COLLECTION_NAME,
      metadata: { description: "Programming Error Knowledge Base" }
    });
    console.log("[ChromaDB] Collection cleared");
  } catch (err) {
    console.error(`[ChromaDB] Clear failed: ${err.code || err.name || "Error"}`);
  }
}

async function searchSimilar(errorText, language) {
  const col = await getCollection();
  const count = await col.count();
  if (count === 0) return null;

  let results = await col.query({
    queryTexts: [errorText],
    nResults: Math.min(TOP_K_RESULTS, count),
    where: { language }
  });

  if (!results.documents?.[0]?.length) {
    results = await col.query({
      queryTexts: [errorText],
      nResults: Math.min(TOP_K_RESULTS, count)
    });
  }
  if (!results.documents?.[0]?.length) return null;

  return {
    matchedError: results.documents[0][0],
    explanation: results.metadatas?.[0]?.[0]?.explanation,
    fix: results.metadatas?.[0]?.[0]?.fix,
    distance: results.distances?.[0]?.[0] ?? null,
    source: "RAG"
  };
}

async function storeResult({ error, language, explanation, fix }) {
  const col = await getCollection();
  const id = `${language}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await col.add({
    ids: [id],
    documents: [error],
    metadatas: [{ language, explanation, fix }]
  });
  console.log("[ChromaDB] Result stored");
}

async function getCount() {
  try {
    return await (await getCollection()).count();
  } catch (err) {
    console.error(`[ChromaDB] Count failed: ${err.code || err.name || "Error"}`);
    return 0;
  }
}

module.exports = { searchSimilar, storeResult, getCount, clearCollection };
