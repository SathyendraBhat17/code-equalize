/**
 * Syntax-only validation of the AI-corrected source.
 *
 * Nothing here executes the user's program:
 * - Python: ast.parse() builds a syntax tree only.
 * - C / C++: the compiler runs with -fsyntax-only (no object code, no run).
 * - Java: not checked (javac needs the original file layout); reported as
 *   unavailable.
 *
 * Every tool is optional. If it is missing or times out, the result is
 * "unavailable", never a false "passed". A passed syntax check does not
 * prove the runtime behaviour is correct.
 */

const { execFile } = require("child_process");

const VALIDATION_TIMEOUT_MS = 5000;
const MAX_DETAIL_LENGTH = 400;

const PYTHON_CHECK =
  "import ast, sys\n" +
  "source = sys.stdin.read()\n" +
  "try:\n" +
  "    ast.parse(source)\n" +
  "except SyntaxError as error:\n" +
  "    print(f'line {error.lineno}: {error.msg}')\n" +
  "    sys.exit(1)\n";

function isEnabled() {
  return process.env.SYNTAX_VALIDATION !== "off";
}

function runTool(command, args, input) {
  return new Promise(resolve => {
    const child = execFile(
      command,
      args,
      {
        timeout: VALIDATION_TIMEOUT_MS,
        maxBuffer: 256 * 1024,
        windowsHide: true
      },
      (error, stdout, stderr) => {
        if (error && (error.code === "ENOENT" || error.killed)) {
          resolve({ available: false });
          return;
        }

        resolve({
          available: true,
          ok: !error,
          output: `${stdout || ""}${stderr || ""}`.trim()
        });
      }
    );

    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}

function firstLines(text) {
  return text
    .split(/\r?\n/)
    .filter(line => line.trim())
    .slice(0, 3)
    .join("\n")
    .slice(0, MAX_DETAIL_LENGTH);
}

async function checkPython(code) {
  for (const command of ["python3", "python"]) {
    const result = await runTool(command, ["-I", "-c", PYTHON_CHECK], code);

    if (result.available) {
      return result;
    }
  }

  return { available: false };
}

async function checkC(code, language) {
  const compiler = language === "C" ? "gcc" : "g++";
  const sourceLanguage = language === "C" ? "c" : "c++";

  const result = await runTool(
    compiler,
    ["-fsyntax-only", "-x", sourceLanguage, "-"],
    code
  );

  // Local headers ("#include \"util.h\"") cannot be found when checking
  // from stdin; that is an environment limit, not a syntax failure.
  if (
    result.available &&
    !result.ok &&
    /No such file or directory/i.test(result.output)
  ) {
    return { available: false };
  }

  return result;
}

/**
 * Returns { status: "passed" | "failed" | "unavailable", tool?, detail? }.
 */
async function validateSyntax(code, language) {
  if (!isEnabled() || typeof code !== "string" || !code.trim()) {
    return { status: "unavailable" };
  }

  try {
    let result;
    let tool;

    if (language === "Python") {
      tool = "Python ast.parse";
      result = await checkPython(code);
    } else if (language === "C" || language === "C++") {
      tool = `${language === "C" ? "gcc" : "g++"} -fsyntax-only`;
      result = await checkC(code, language);
    } else {
      return { status: "unavailable" };
    }

    if (!result.available) {
      return { status: "unavailable" };
    }

    return result.ok
      ? { status: "passed", tool }
      : { status: "failed", tool, detail: firstLines(result.output) };
  } catch {
    return { status: "unavailable" };
  }
}

module.exports = { validateSyntax };
