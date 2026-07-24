const chromaService = require("../services/chromaService");

// Seeds the mock database with common programming errors.
const seedDatabase = async () => {
  try {
    const seedEntries = [
      // ===== JAVA ERRORS =====
      {
        error: "NullPointerException",
        language: "Java",
        explanation:
          "This happens when your code tries to use an object that has not been initialized (null reference).",
        fix:
          "Initialize the object before using it and add null checks to avoid accessing null values."
      },
      {
        error: "ArrayIndexOutOfBoundsException",
        language: "Java",
        explanation:
          "This error occurs when you try to access an array index that is outside its valid range.",
        fix:
          "Ensure the index is within the array bounds by checking the array length before accessing."
      },
      {
        error: "Missing semicolon",
        language: "Java",
        explanation:
          "Java requires a semicolon at the end of each statement. Missing it causes a syntax error.",
        fix:
          "Add a semicolon (;) at the end of the statement."
      },
      {
        error: "Cannot find symbol",
        language: "Java",
        explanation:
          "This happens when the compiler cannot recognize a variable, method, or class name.",
        fix:
          "Check for spelling mistakes and ensure the variable or method is properly declared."
      },
      {
        error: "Incompatible types",
        language: "Java",
        explanation:
          "This error occurs when you try to assign a value of one data type to a variable of another incompatible type.",
        fix:
          "Make sure the data types match or use proper type casting."
      },
      {
        error: "ClassNotFoundException",
        language: "Java",
        explanation:
          "This occurs when the JVM cannot find the specified class during runtime.",
        fix:
          "Ensure the class exists and is included in the classpath."
      },

      // ===== PYTHON ERRORS =====
      {
        error: "IndexError: list index out of range",
        language: "Python",
        explanation:
          "This happens when you try to access an index that does not exist in a list.",
        fix:
          "Check the length of the list before accessing elements using an index."
      },
      {
        error: "TypeError: unsupported operand type(s)",
        language: "Python",
        explanation:
          "This occurs when an operation is performed on incompatible data types.",
        fix:
          "Ensure both operands are of compatible types before performing operations."
      },
      {
        error: "IndentationError",
        language: "Python",
        explanation:
          "Python relies on indentation for defining code blocks. Incorrect indentation causes this error.",
        fix:
          "Fix the spacing to maintain consistent indentation (usually 4 spaces)."
      },
      {
        error: "SyntaxError: unexpected EOF while parsing",
        language: "Python",
        explanation:
          "This error occurs when Python reaches the end of the file but expects more input, often due to missing brackets or quotes.",
        fix:
          "Check for missing parentheses, quotes, or incomplete statements."
      },
      {
        error: "NameError: name is not defined",
        language: "Python",
        explanation:
          "This happens when you try to use a variable or function that has not been defined.",
        fix:
          "Make sure the variable or function is declared before using it."
      },
      {
        error: "ZeroDivisionError",
        language: "Python",
        explanation:
          "This occurs when you try to divide a number by zero, which is not allowed.",
        fix:
          "Ensure the denominator is not zero before performing division."
      }
    ];

    for (const entry of seedEntries) {
      await chromaService.storeResult(entry);
    }

    console.log("Seeding complete with extended dataset");
  } catch (error) {
    console.error("Failed to seed database:", error);
  }
};

module.exports = {
  seedDatabase
};