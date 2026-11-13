
// Central configuration values used across the backend.

/**
 * Read and validate numeric environment variables.
 */
function getNumberEnv(name, defaultValue, options = {}) {
  const rawValue = process.env[name];

  if (rawValue === undefined || rawValue.trim() === "") {
    return defaultValue;
  }

  const value = Number(rawValue);

  if (!Number.isFinite(value)) {
    throw new Error(`[Config] ${name} must be a valid number.`);
  }

  if (options.integer && !Number.isInteger(value)) {
    throw new Error(`[Config] ${name} must be an integer.`);
  }

  if (options.min !== undefined && value < options.min) {
    throw new Error(`[Config] ${name} must be at least ${options.min}.`);
  }

  if (options.max !== undefined && value > options.max) {
    throw new Error(`[Config] ${name} must not exceed ${options.max}.`);
  }

  return value;
}

// Backend server.
const PORT = getNumberEnv("PORT", 3000, {
  integer: true,
  min: 1,
  max: 65535
});

// ChromaDB connection.
const CHROMA_HOST = process.env.CHROMA_HOST || "localhost";

// Established local setup: Docker maps host 8001 → container 8000.
const CHROMA_PORT = getNumberEnv("CHROMA_PORT", 8001, {
  integer: true,
  min: 1,
  max: 65535
});

// ChromaDB retrieval configuration.
//
// This is an L2 distance threshold, not a percentage similarity.
// Lower distance means a closer match.
const SIMILARITY_THRESHOLD = getNumberEnv(
  "SIMILARITY_THRESHOLD",
  0.85,
  { min: 0 }
);

const TOP_K_RESULTS = getNumberEnv("TOP_K_RESULTS", 3, {
  integer: true,
  min: 1
});

// AI API keys.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

// Supported programming languages.
const SUPPORTED_LANGUAGES = Object.freeze([
  "Java",
  "Python",
  "C",
  "C++"
]);

// Supported explanation languages.
const SUPPORTED_TARGET_LANGUAGES = Object.freeze([
  "English",
  "Hindi",
  "Bengali",
  "Marathi",
  "Telugu",
  "Tamil",
  "Gujarati",
  "Urdu",
  "Kannada",
  "Odia",
  "Malayalam"
]);

module.exports = {
  PORT,
  CHROMA_HOST,
  CHROMA_PORT,
  SIMILARITY_THRESHOLD,
  TOP_K_RESULTS,
  GEMINI_API_KEY,
  GROQ_API_KEY,
  SUPPORTED_LANGUAGES,
  SUPPORTED_TARGET_LANGUAGES
};
