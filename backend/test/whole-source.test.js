const assert = require("node:assert/strict");
const test = require("node:test");

const {
  parseBatchExplanationResponse
} = require("../services/aiService");
const { buildBatchPrompt } = require("../utils/promptBuilder");
const { validateSyntax } = require("../services/validationService");

const listed = [
  {
    id: "diagnostic|1|\"(\" was not closed",
    error: "\"(\" was not closed",
    lineNumber: 1,
    errorType: "diagnostic"
  }
];

const source = [
  "def average(total, count):",
  "    print(\"start\")",
  "    if count == 0:",
  "        return 0",
  "    return total / count"
].join("\n");

const fullResponse = [
  `Explanation 1 [id=${listed[0].id}]:`,
  "Error type: Missing Parenthesis",
  "Summary: The print call on line 2 is never closed.",
  "The call to print opens a parenthesis but never closes it, so Python cannot",
  "tell where the call ends.",
  "Individual correction:",
  "print(\"start\")",
  "",
  "Additional issue 1 [line=5]:",
  "Error type: Division by Zero",
  "Summary: count may be 0, which would raise ZeroDivisionError.",
  "If count is 0 the division has no meaningful result, like sharing a pizza",
  "among zero people. Python would raise ZeroDivisionError at runtime.",
  "",
  "Correction status: COMPLETE",
  "",
  "Fix:",
  "```python",
  source,
  "```",
  "",
  "What was fixed:",
  "- Closed the print call.",
  "- Added a guard so count is never 0 when dividing.",
  "",
  "Remember:",
  "- Close every bracket you open.",
  "- Check a divisor before dividing."
].join("\n");

test("parses issue types, summaries and source-inferred additional issues", () => {
  const result = parseBatchExplanationResponse(fullResponse, listed, "Python", {
    analyzeSource: true,
    lineCount: 5
  });

  assert.equal(result.explanations[0].issueType, "Missing Parenthesis");
  assert.match(result.explanations[0].summary, /never closed/);
  assert.doesNotMatch(result.explanations[0].explanation, /Error type:|Summary:/);

  assert.equal(result.additionalIssues.length, 1);
  const extra = result.additionalIssues[0];
  assert.equal(extra.errorType, "potential");
  assert.equal(extra.lineNumber, 4);
  assert.equal(extra.issueType, "Division by Zero");
  assert.match(extra.id, /^potential\|4\|division-by-zero$/);

  assert.equal(result.fix, source);
  assert.match(result.whatWasFixed, /Closed the print call/);
  assert.equal(result.correctionStatus, "complete");
  assert.equal(result.noIssues, false);
});

test("ignores additional issues when whole-source analysis was not requested", () => {
  const result = parseBatchExplanationResponse(fullResponse, listed, "Python");
  assert.equal(result.additionalIssues.length, 0);
});

test("drops invented line numbers instead of shifting them", () => {
  const response = fullResponse.replace("[line=5]", "[line=99]");
  const result = parseBatchExplanationResponse(response, listed, "Python", {
    analyzeSource: true,
    lineCount: 5
  });
  assert.equal(result.additionalIssues[0].lineNumber, undefined);
});

test("PARTIAL or missing correction status is never reported as complete", () => {
  const partial = parseBatchExplanationResponse(
    fullResponse.replace("Correction status: COMPLETE", "Correction status: PARTIAL"),
    listed,
    "Python",
    { analyzeSource: true, lineCount: 5 }
  );
  assert.equal(partial.correctionStatus, "partial");

  const missing = parseBatchExplanationResponse(
    fullResponse.replace("Correction status: COMPLETE\n", ""),
    listed,
    "Python",
    { analyzeSource: true, lineCount: 5 }
  );
  assert.equal(missing.correctionStatus, "partial");
});

test("rejects unknown and duplicate IDs and missing explanations", () => {
  assert.throws(
    () => parseBatchExplanationResponse(
      fullResponse.replace(`[id=${listed[0].id}]`, "[id=unknown]"),
      listed,
      "Python",
      { analyzeSource: true, lineCount: 5 }
    ),
    /explanation per error|Individual correction must immediately follow/
  );

  const duplicated = fullResponse.replace(
    "Additional issue 1 [line=5]:",
    `Explanation 2 [id=${listed[0].id}]:\nError type: X\nSummary: Y\nZ\nIndividual correction:\nNOT_SAFE_TO_STORE\n\nAdditional issue 1 [line=5]:`
  );
  assert.throws(
    () => parseBatchExplanationResponse(duplicated, listed, "Python", {
      analyzeSource: true,
      lineCount: 5
    }),
    /duplicate explanation ID/
  );
});

test("whole-source analysis of a clean file returns noIssues", () => {
  const result = parseBatchExplanationResponse("NO_ISSUES_FOUND", [], "Python", {
    analyzeSource: true,
    lineCount: 3
  });
  assert.equal(result.noIssues, true);
  assert.equal(result.explanations.length, 0);

  assert.throws(
    () => parseBatchExplanationResponse("NO_ISSUES_FOUND", listed, "Python", {
      analyzeSource: true
    }),
    /exactly one explanation per error/
  );
});

test("strips copied line-number prefixes from the corrected file", () => {
  const prefixed = source
    .split("\n")
    .map((line, index) => `${index + 1} | ${line}`)
    .join("\n");
  const result = parseBatchExplanationResponse(
    fullResponse.replace(source, prefixed),
    listed,
    "Python",
    { analyzeSource: true, lineCount: 5 }
  );
  assert.equal(result.fix, source);
});

test("whole-source prompt includes numbered source, file name and language facts", () => {
  const prompt = buildBatchPrompt({
    code: source,
    language: "Python",
    targetLanguage: "Tamil",
    errors: [],
    fileName: "main.py",
    analyzeSource: true
  });

  assert.match(prompt, /File name: main\.py/);
  assert.match(prompt, /5 \| {5}return total \/ count/);
  assert.match(prompt, /WHOLE-SOURCE ANALYSIS/);
  assert.match(prompt, /POTENTIAL issue/);
  assert.match(prompt, /ZeroDivisionError/);
  assert.match(prompt, /NO_ISSUES_FOUND/);
  assert.match(prompt, /explanation language is Tamil/);

  const cPrompt = buildBatchPrompt({
    code: "int main(){return 1/0;}",
    language: "C",
    targetLanguage: "English",
    errors: listed,
    analyzeSource: false
  });
  assert.match(cPrompt, /undefined behaviour/);
  assert.doesNotMatch(cPrompt, /WHOLE-SOURCE ANALYSIS/);
  assert.match(cPrompt, /Explain ONLY the listed errors/);
});

test("syntax validation never executes code and reports its result honestly", async () => {
  const marker = require("node:path").join(
    require("node:os").tmpdir(),
    `ce-should-not-exist-${process.pid}`
  );
  const program = `open(${JSON.stringify(marker)}, "w").write("ran")\nprint("hi")\n`;

  const passed = await validateSyntax(program, "Python");
  assert.ok(["passed", "unavailable"].includes(passed.status));
  assert.equal(require("node:fs").existsSync(marker), false);

  const failed = await validateSyntax("def broken(:\n    pass\n", "Python");
  assert.ok(["failed", "unavailable"].includes(failed.status));

  const java = await validateSyntax("class A {}", "Java");
  assert.equal(java.status, "unavailable");
});
