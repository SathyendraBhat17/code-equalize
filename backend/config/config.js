// Central configuration values used across the backend
const PORT = Number(process.env.PORT) || 3000;
const CHROMA_HOST = process.env.CHROMA_HOST || "localhost";
const CHROMA_PORT = Number(process.env.CHROMA_PORT) || 8000;
const SIMILARITY_THRESHOLD = Number(process.env.SIMILARITY_THRESHOLD) || 0.85;
const TOP_K_RESULTS = Number(process.env.TOP_K_RESULTS) || 3;

const SUPPORTED_LANGUAGES = ["Java", "Python"];
const SUPPORTED_TARGET_LANGUAGES = ["Kannada", "Hindi"];

module.exports = {
  PORT,
  CHROMA_HOST,
  CHROMA_PORT,
  SIMILARITY_THRESHOLD,
  TOP_K_RESULTS,
  SUPPORTED_LANGUAGES,
  SUPPORTED_TARGET_LANGUAGES
};