const chromaService = require("../services/chromaService");

async function seedDatabase() {
  try {
    console.log("🚀 Starting ChromaDB seeding...");

    // Clear previous data
    await chromaService.clearCollection();

    const seedEntries = [
      // =========================
      // JAVA ERRORS
      // =========================
      {
        error: "NullPointerException",
        language: "Java",
        explanation:
          "This happens when your code tries to use an object reference that is null.",
        fix:
          "Initialize the object before using it or check if it is null."
      },
      {
        error: "ArrayIndexOutOfBoundsException",
        language: "Java",
        explanation:
          "The code is trying to access an array index outside its valid range.",
        fix:
          "Check that the index is between 0 and array.length - 1."
      },
      {
        error: "Cannot find symbol",
        language: "Java",
        explanation:
          "The compiler cannot find the variable, class or method you referenced.",
        fix:
          "Check the spelling and make sure it has been declared or imported."
      },
      {
        error: "Incompatible types",
        language: "Java",
        explanation:
          "A value is being assigned to a variable of an incompatible type.",
        fix:
          "Use the correct data type or perform explicit type casting."
      },
      {
        error: "Missing semicolon",
        language: "Java",
        explanation:
          "Java statements must end with a semicolon.",
        fix:
          "Add a semicolon (;) at the end of the statement."
      },
      {
        error: "ClassNotFoundException",
        language: "Java",
        explanation:
          "Java cannot locate the required class during runtime.",
        fix:
          "Check your classpath and dependencies."
      },
      {
        error: "StackOverflowError",
        language: "Java",
        explanation:
          "Too many nested method calls usually caused by infinite recursion.",
        fix:
          "Add a proper base case in recursive methods."
      },
      {
        error: "NumberFormatException",
        language: "Java",
        explanation:
          "A string cannot be converted into a valid number.",
        fix:
          "Validate the input before calling Integer.parseInt() or Double.parseDouble()."
      },
      {
        error: "ClassCastException",
        language: "Java",
        explanation:
          "An object is being cast to an incompatible class.",
        fix:
          "Use instanceof before casting."
      },
      {
        error: "StringIndexOutOfBoundsException",
        language: "Java",
        explanation:
          "The requested character position is outside the string length.",
        fix:
          "Check the string length before accessing characters."
      },
      {
        error: "IllegalArgumentException",
        language: "Java",
        explanation:
          "A method received an invalid argument.",
        fix:
          "Verify the values before passing them to the method."
      },
      {
        error: "IOException",
        language: "Java",
        explanation:
          "An error occurred while performing file or input/output operations.",
        fix:
          "Use try-catch and verify the file path and permissions."
      },
      {
        error: "ArithmeticException: / by zero",
        language: "Java",
        explanation:
          "Division by zero is not allowed.",
        fix:
          "Ensure the denominator is not zero before dividing."
      },
      {
        error: "Unreachable statement",
        language: "Java",
        explanation:
          "The compiler found code that will never execute.",
        fix:
          "Remove or relocate the unreachable code."
      },
      {
        error: "Variable might not have been initialized",
        language: "Java",
        explanation:
          "A local variable is used before assigning a value.",
        fix:
          "Initialize the variable before using it."
      },

      // =========================
      // PYTHON ERRORS
      // =========================
      {
        error: "IndexError: list index out of range",
        language: "Python",
        explanation:
          "The code tries to access an index that does not exist in the list.",
        fix:
          "Use len(list) to ensure the index is valid."
      },
      {
        error: "TypeError: unsupported operand type",
        language: "Python",
        explanation:
          "An operation is performed on incompatible data types.",
        fix:
          "Convert values to compatible types before the operation."
      },
      {
        error: "IndentationError",
        language: "Python",
        explanation:
          "Python code indentation is incorrect.",
        fix:
          "Use consistent indentation, preferably four spaces."
      },
      {
        error: "NameError: name is not defined",
        language: "Python",
        explanation:
          "A variable or function is used before being defined.",
        fix:
          "Declare the variable or import the function first."
      },
      {
        error: "ZeroDivisionError",
        language: "Python",
        explanation:
          "The program attempted to divide by zero.",
        fix:
          "Check that the denominator is not zero."
      },
      {
        error: "SyntaxError: unexpected EOF while parsing",
        language: "Python",
        explanation:
          "Python reached the end of the file before the statement was complete.",
        fix:
          "Check for missing parentheses, brackets or quotation marks."
      },
      {
        error: "AttributeError",
        language: "Python",
        explanation:
          "The object does not contain the requested attribute or method.",
        fix:
          "Verify the object type and available attributes."
      },
      {
        error: "KeyError",
        language: "Python",
        explanation:
          "A dictionary key does not exist.",
        fix:
          "Use dict.get() or check if the key exists first."
      },
      {
        error: "ValueError",
        language: "Python",
        explanation:
          "The value passed to a function is invalid.",
        fix:
          "Validate the input before calling the function."
      },
      {
        error: "ImportError",
        language: "Python",
        explanation:
          "Python cannot import the requested module.",
        fix:
          "Install the package or verify the module name."
      },
      {
        error: "FileNotFoundError",
        language: "Python",
        explanation:
          "The specified file cannot be found.",
        fix:
          "Verify the file path before opening it."
      },
      {
        error: "TypeError: object is not iterable",
        language: "Python",
        explanation:
          "The object cannot be used in a loop.",
        fix:
          "Ensure the variable is a list, tuple, string or another iterable."
      },
      {
        error: "RecursionError: maximum recursion depth exceeded",
        language: "Python",
        explanation:
          "The recursive function exceeded the maximum recursion depth.",
        fix:
          "Add a base case to stop recursion."
      },
      {
        error: "MemoryError",
        language: "Python",
        explanation:
          "The program has exhausted available memory.",
        fix:
          "Reduce memory usage or process data in smaller chunks."
      },
      {
        error: "StopIteration",
        language: "Python",
        explanation:
          "The iterator has no more elements.",
        fix:
          "Use a for loop or catch the StopIteration exception."
      }
    ];

    for (const entry of seedEntries) {
      await chromaService.storeResult(entry);
    }

    const count = await chromaService.getCount();

    console.log("\n=================================");
    console.log("✅ ChromaDB seeding completed!");
    console.log(`📚 Total entries: ${count}`);
    console.log("=================================\n");

  } catch (err) {
    console.error("❌ Seeding failed:", err);
  }
}

seedDatabase();