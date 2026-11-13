const assert = require("node:assert/strict");
const test = require("node:test");

const {
  parseBatchExplanationResponse
} = require("../services/aiService");
const { buildBatchPrompt } = require("../utils/promptBuilder");

const errors = [
  {
    id: "diagnostic|2|unexpected closing ']'",
    error: "Unexpected closing ']'",
    lineNumber: 2,
    errorType: "diagnostic"
  },
  {
    id: "runtime|4|zerodivisionerror",
    error: "ZeroDivisionError: division by zero",
    lineNumber: 4,
    errorType: "runtime"
  }
];

test("batch response keeps every error and returns plain full-file source", () => {
  const source = [
    "def calculate():",
    "    x = 10",
    "    y = 0",
    "    if y == 0:",
    "        raise ValueError('denominator must not be zero')",
    "    return x / y",
    ""
  ].join("\n");
  const response = [
    `Explanation 1 [id=${errors[0].id}]:`,
    "The call is missing its closing parenthesis on line 3.",
    "Individual correction:",
    "Close the call with `)`.",
    `Explanation 2 [id=${errors[1].id}]:`,
    "Line 5 divides by zero; Python raises ZeroDivisionError.",
    "Individual correction:",
    "Check the denominator before division.",
    "Fix:",
    "This preserves the function and prevents a zero denominator.",
    "```python",
    source,
    "```",
    "Remember:",
    "- Close every opened call.",
    "- Check a divisor before dividing."
  ].join("\n");

  const result = parseBatchExplanationResponse(response, errors, "Python");

  assert.deepEqual(result.explanations.map(item => item.id), errors.map(item => item.id));
  assert.equal(result.explanations[1].errorType, "runtime");
  assert.equal(result.fix, source);
  assert.equal(result.fix.includes("```"), false);
  assert.match(result.remember, /Close every opened call/);
  assert.match(result.remember, /Check a divisor/);
});

test("batch response rejects missing or multiple full-file code blocks", () => {
  const makeResponse = code => [
    ...errors.flatMap((item, index) => [
      `Explanation ${index + 1} [id=${item.id}]:`,
      "Cause and code connection.",
      "Individual correction:",
      "Apply the local correction."
    ]),
    "Fix:",
    code,
    "Remember:",
    "Remember both lessons."
  ].join("\n");

  assert.throws(
    () => parseBatchExplanationResponse(makeResponse("plain source"), errors, "Python"),
    /exactly one fenced full-file source block/
  );
  assert.throws(
    () => parseBatchExplanationResponse(
      makeResponse("```python\na = 1\n```\n```python\nb = 2\n```"),
      errors,
      "Python"
    ),
    /exactly one fenced full-file source block/
  );
});

test("source extraction preserves code that contains Markdown-like fences", () => {
  const source = [
    "documentation = r'''",
    "```python",
    "example()",
    "```",
    "'''",
    ""
  ].join("\n");
  const response = [
    ...errors.flatMap((item, index) => [
      `Explanation ${index + 1} [id=${item.id}]:`,
      "Cause and code connection.",
      "Individual correction:",
      "Apply the local correction."
    ]),
    "Fix:",
    "````python",
    source,
    "````",
    "Remember:",
    "Remember both lessons."
  ].join("\n");

  assert.equal(
    parseBatchExplanationResponse(response, errors, "Python").fix,
    source
  );
});

test("batch prompt sends source and selected explanation languages separately", () => {
  const prompt = buildBatchPrompt({
    code: "value = 1 / 0",
    language: "Python",
    targetLanguage: "Hindi",
    errors: [errors[1]],
    knowledgeContexts: []
  });

  assert.match(prompt, /Programming language:\nPython/);
  assert.match(prompt, /selected explanation language is:\nHindi/);
  assert.match(prompt, /id=runtime\|4\|zerodivisionerror/);
  assert.match(prompt, /practical takeaway for EACH listed error/i);
});
