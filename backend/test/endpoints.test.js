/**
 * Endpoint tests for the real Express app with Groq and ChromaDB stubbed.
 * No network calls are made and no ChromaDB collection is touched.
 */
const assert = require("node:assert/strict");
const test = require("node:test");
const Module = require("node:module");

process.env.GROQ_API_KEY = "test-key-not-real";
process.env.PORT = String(39000 + (process.pid % 500));

// ---- Groq stub -----------------------------------------------------------
let groqHandler = async () => {
  throw new Error("no handler");
};
const groqCalls = [];

class FakeGroq {
  constructor() {
    this.chat = {
      completions: {
        create: async params => {
          groqCalls.push(params);
          return groqHandler(params);
        }
      }
    };
  }
}

const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === "groq-sdk") {
    return FakeGroq;
  }
  return originalLoad.call(this, request, ...rest);
};

// ---- ChromaDB stub (in-memory; the real collection is never used) -------
const chromaService = require("../services/chromaService");
const stored = [];
let searchBehaviour = async () => null;

chromaService.searchSimilar = (...args) => searchBehaviour(...args);
chromaService.storeResult = async record => {
  stored.push(record);
  return "stub-id";
};
chromaService.clearCollection = async () => {
  throw new Error("clearCollection must never be called");
};

const { server } = require("../server");
Module._load = originalLoad;

const base = `http://127.0.0.1:${process.env.PORT}`;

const reply = content => ({
  choices: [{ message: { content }, finish_reason: "stop" }]
});

async function post(path, body) {
  const response = await fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

const code = "x = 10\ny = 0\nprint(x / y\n";
const diagnostic = {
  id: "diagnostic|2|\"(\" was not closed",
  error: "\"(\" was not closed",
  lineNumber: 2,
  errorType: "diagnostic"
};

const goodResponse = [
  `Explanation 1 [id=${diagnostic.id}]:`,
  "Error type: Missing Parenthesis",
  "Summary: print( on line 3 is never closed.",
  "The parenthesis opened by print is never closed.",
  "Individual correction:",
  "print(x / y)",
  "Additional issue 1 [line=3]:",
  "Error type: Division by Zero",
  "Summary: y is 0, so x / y may raise ZeroDivisionError.",
  "Dividing by zero has no meaningful result.",
  "Correction status: COMPLETE",
  "Fix:",
  "```python",
  "x = 10",
  "y = 0",
  "if y != 0:",
  "    print(x / y)",
  "else:",
  "    print(\"Cannot divide by zero\")",
  "```",
  "What was fixed:",
  "- Closed the print call.",
  "- Added a zero check.",
  "Remember:",
  "- Close brackets.",
  "- Check divisors."
].join("\n");

test.after(() => new Promise(resolve => server.close(resolve)));

test("GET /health", async () => {
  const response = await fetch(base + "/health");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "ok");
});

test("POST /explain/all returns explanations, potential issues, fix, What was fixed, Remember", async () => {
  groqHandler = async () => reply(goodResponse);
  stored.length = 0;
  groqCalls.length = 0;

  const { status, body } = await post("/explain/all", {
    code,
    language: "Python",
    targetLanguage: "Hindi",
    fileName: "main.py",
    analyzeSource: true,
    errors: [diagnostic]
  });

  assert.equal(status, 200);
  assert.equal(body.explanations.length, 2);
  assert.equal(body.explanations[0].id, diagnostic.id);
  assert.equal(body.explanations[0].issueType, "Missing Parenthesis");
  assert.equal(body.explanations[1].errorType, "potential");
  assert.equal(body.explanations[1].lineNumber, 2);
  assert.doesNotMatch(body.fix, /```/);
  assert.match(body.fix, /if y != 0:/);
  assert.match(body.whatWasFixed, /zero check/);
  assert.match(body.remember, /Check divisors/);
  assert.equal(body.correctionStatus, "complete");
  assert.equal(body.validation.status === "passed" || body.validation.status === "unavailable", true);
  assert.equal(body.noIssues, false);

  // The whole source and the selected language reach Groq in one call.
  assert.equal(groqCalls.length, 1);
  const prompt = groqCalls[0].messages[1].content;
  assert.match(prompt, /3 \| print\(x \/ y/);
  assert.match(prompt, /explanation language is Hindi/);
  assert.equal(groqCalls[0].model, "openai/gpt-oss-120b");

  // Only the real diagnostic is stored, with its individual correction,
  // never the full-file fix or the AI-inferred issue.
  assert.equal(stored.length, 1);
  assert.equal(stored[0].error, diagnostic.error);
  assert.equal(stored[0].fix, "print(x / y)");
});

test("whole-source analysis works with no editor diagnostics", async () => {
  groqHandler = async () => reply("NO_ISSUES_FOUND");

  const { status, body } = await post("/explain/all", {
    code: "print('hello')\n",
    language: "Python",
    targetLanguage: "English",
    analyzeSource: true,
    errors: []
  });

  assert.equal(status, 200);
  assert.equal(body.noIssues, true);
  assert.deepEqual(body.explanations, []);
});

test("ChromaDB failure falls back to Groq-only analysis", async () => {
  groqHandler = async () => reply(goodResponse);
  searchBehaviour = async () => {
    throw new Error("connection refused");
  };

  const { status, body } = await post("/explain/all", {
    code,
    language: "Python",
    targetLanguage: "English",
    analyzeSource: true,
    errors: [diagnostic]
  });

  assert.equal(status, 200);
  assert.equal(body.source, "AI");
  searchBehaviour = async () => null;
});

test("malformed AI output and Groq failures return a clear 502", async () => {
  groqHandler = async () => reply("Here is some text without the required sections.");

  let result = await post("/explain/all", {
    code,
    language: "Python",
    targetLanguage: "English",
    errors: [diagnostic]
  });
  assert.equal(result.status, 502);
  assert.match(result.body.error, /could not complete/);

  groqHandler = async () => {
    const error = new Error("rate limited");
    error.status = 429;
    throw error;
  };
  result = await post("/explain/all", {
    code,
    language: "Python",
    targetLanguage: "English",
    errors: [diagnostic]
  });
  assert.equal(result.status, 502);

  groqHandler = async () => ({
    choices: [{ message: { content: goodResponse.slice(0, 200) }, finish_reason: "length" }]
  });
  result = await post("/explain/all", {
    code,
    language: "Python",
    targetLanguage: "English",
    errors: [diagnostic]
  });
  assert.equal(result.status, 502);
});

test("invalid request payloads are rejected with 400", async () => {
  const valid = {
    code,
    language: "Python",
    targetLanguage: "English",
    errors: [diagnostic]
  };

  const cases = [
    { ...valid, language: "Ruby" },
    { ...valid, targetLanguage: "Klingon" },
    { ...valid, errors: [] },
    { ...valid, analyzeSource: "yes" },
    { ...valid, errors: [diagnostic, diagnostic] },
    { ...valid, errors: [{ ...diagnostic, lineNumber: -1 }] },
    { ...valid, errors: [{ ...diagnostic, errorType: "severe" }] },
    { ...valid, errors: [{ ...diagnostic, relatedDiagnostics: "x" }] },
    { ...valid, errors: Array.from({ length: 21 }, (_, i) => ({ ...diagnostic, id: `id${i}` })) },
    { ...valid, code: "" }
  ];

  for (const body of cases) {
    const result = await post("/explain/all", body);
    assert.equal(result.status, 400, JSON.stringify(body).slice(0, 120));
  }

  const invalidJson = await post("/explain/all", "{not json");
  assert.equal(invalidJson.status, 400);
});

test("POST /explain single-error endpoint still works", async () => {
  groqHandler = async () => reply(
    "Explanation:\nThe call is not closed.\nFix:\n```python\nprint(1)\n```\nRemember:\nClose brackets."
  );

  const { status, body } = await post("/explain", {
    error: "\"(\" was not closed",
    code: "print(1",
    language: "Python",
    targetLanguage: "English"
  });

  assert.equal(status, 200);
  assert.match(body.explanation, /not closed/);
});

test("unknown endpoints such as /explain-all return 404", async () => {
  const result = await post("/explain-all", {});
  assert.equal(result.status, 404);
});
