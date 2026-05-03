const chromaService = require("../services/chromaService");

// Seeds the mock database with initial common programming errors.
const seedDatabase = async () => {
  try {
    const seedEntries = [
      {
        error: "NullPointerException",
        language: "Java",
        explanation:
          "This happens when code tries to use an object reference that is null.",
        fix: "Initialize the object before use and add null checks where needed."
      },
      {
        error: "ArrayIndexOutOfBoundsException",
        language: "Java",
        explanation:
          "This error occurs when an array index is less than 0 or greater than its last valid index.",
        fix: "Check array length and ensure index values stay within valid range."
      },
      {
        error: "IndexError: list index out of range",
        language: "Python",
        explanation:
          "This happens when code tries to access a list item using an invalid index.",
        fix: "Validate the list size before reading or writing by index."
      },
      {
        error: "TypeError: unsupported operand type(s)",
        language: "Python",
        explanation:
          "This occurs when an operation is used on values with incompatible data types.",
        fix: "Convert values to compatible types before performing the operation."
      }
    ];

    for (const entry of seedEntries) {
      await chromaService.storeResult(entry);
    }

    console.log("Seeding complete");
  } catch (error) {
    console.error("Failed to seed database:", error);
  }
};

module.exports = {
  seedDatabase
};