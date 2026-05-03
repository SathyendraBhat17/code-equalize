// Generates a mock embedding vector for the provided error text.
const getEmbedding = async (errorText) => {
    try {
      // Replace with real OpenAI embedding call later
      const embedding = Array.from({ length: 5 }, () => Math.random());
      return embedding;
    } catch (error) {
      console.error("Failed to generate embedding:", error);
      throw error;
    }
  };
  
  module.exports = {
    getEmbedding
  };