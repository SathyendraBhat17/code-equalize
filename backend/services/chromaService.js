// Replace with real ChromaDB calls later
const mockErrorDatabase = [
    {
      error: "NullPointerException",
      language: "Java",
      explanation:
        "This error happens when you try to use an object reference that is null.",
      fix: "Initialize the object before using it and add null checks."
    },
    {
      error: "IndexError: list index out of range",
      language: "Python",
      explanation:
        "This error happens when you access a list index that does not exist.",
      fix: "Check list length before accessing an index."
    }
  ];
  
  // Generates a mock similarity score between 0.7 and 1.0.
  const getMockSimilarityScore = () => {
    return 0.7 + Math.random() * 0.3;
  };
  
  // Searches mock database and returns a similar error result.
  const searchSimilar = async (embedding) => {
    try {
      if (!embedding || !Array.isArray(embedding) || mockErrorDatabase.length === 0) {
        return null;
      }
  
      const randomIndex = Math.floor(Math.random() * mockErrorDatabase.length);
      const matchedEntry = mockErrorDatabase[randomIndex];
      const similarity = getMockSimilarityScore();
  
      return {
        explanation: matchedEntry.explanation,
        fix: matchedEntry.fix,
        similarity
      };
    } catch (error) {
      console.error("Failed to search mock ChromaDB:", error);
      return null;
    }
  };
  
  // Stores a new result in mock database if no similar error exists.
  const storeResult = async ({ error, language, explanation, fix }) => {
    try {
      const hasSimilarEntry = mockErrorDatabase.some((entry) => {
        return (
          entry.error.toLowerCase() === String(error).toLowerCase() &&
          entry.language === language
        );
      });
  
      if (hasSimilarEntry) {
        return;
      }
  
      const newEntry = {
        error,
        language,
        explanation,
        fix
      };
  
      mockErrorDatabase.push(newEntry);
      console.log("Stored new mock ChromaDB entry:", newEntry);
    } catch (storeError) {
      console.error("Failed to store mock ChromaDB result:", storeError);
    }
  };
  
  module.exports = {
    searchSimilar,
    storeResult
  };