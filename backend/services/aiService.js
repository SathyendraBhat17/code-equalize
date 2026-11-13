const Groq = require("groq-sdk");
const { GROQ_API_KEY } = require("../config/config");
const {
  buildPrompt,
  buildBatchPrompt
} = require("../utils/promptBuilder");

let groq;

const MODEL = "openai/gpt-oss-120b";
const MAX_COMPLETION_TOKENS = 4096;
const MAX_BATCH_COMPLETION_TOKENS = 8192;

function getGroqClient() {
  if (!GROQ_API_KEY) {
    const error = new Error("GROQ_API_KEY is not configured");
    error.code = "GROQ_NOT_CONFIGURED";
    error.statusCode = 503;
    throw error;
  }

  if (!groq) {
    groq = new Groq({
      apiKey: GROQ_API_KEY
    });
  }

  return groq;
}

function cleanOuterMarkdown(text) {
  return text
    .trim()
    .replace(/^```(?:markdown|md|text)?\s*\n?/i, "")
    .replace(/\n?```\s*$/, "")
    .trim();
}

/** Return only the one complete source block required by the batch contract. */
function extractConsolidatedSource(fix, language) {
  // Match Markdown fences by their full delimiter length. This lets source
  // contain triple backticks when the enclosing block uses four or more.
  const blocks = [...fix.matchAll(/^[ \t]*(`{3,})([^\r\n`]*)\r?\n([\s\S]*?)^[ \t]*\1[ \t]*$/gm)];

  if (blocks.length !== 1) {
    throw new Error(
      "The AI response must contain exactly one fenced full-file source block."
    );
  }

  const [, , label, source] = blocks[0];
  const normalizedLabel = label.trim().toLowerCase().replace(/^language-/, "");
  const expectedLabels = {
    "C++": new Set(["cpp", "c++", "cxx"]),
    "C": new Set(["c"]),
    "Java": new Set(["java"]),
    "Python": new Set(["python", "py"])
  };
  const accepted = expectedLabels[language];

  if (normalizedLabel && accepted && !accepted.has(normalizedLabel)) {
    throw new Error(
      `The AI returned ${normalizedLabel} source for a ${language} file.`
    );
  }

  // The newline immediately before the closing fence is Markdown framing,
  // not part of the program text.
  return source.replace(/\r?\n$/, "");
}

function parseExplanationResponse(rawText) {
  if (typeof rawText !== "string" || !rawText.trim()) {
    throw new Error("The AI returned an empty response.");
  }

  const text = cleanOuterMarkdown(rawText);

  const sectionPattern =
    /(?:^|\n)\s*(?:\*\*|__)?(Explanation|Fix|Remember)\s*:(?:\*\*|__)?\s*/gi;

  const matches = [];
  let match;

  while ((match = sectionPattern.exec(text)) !== null) {
    matches.push({
      label: match[1].toLowerCase(),
      start: match.index,
      contentStart: sectionPattern.lastIndex
    });
  }

  const sections = {
    explanation: "",
    fix: "",
    remember: ""
  };

  for (let index = 0; index < matches.length; index++) {
    const current = matches[index];
    const next = matches[index + 1];

    if (sections[current.label]) {
      continue;
    }

    sections[current.label] = text
      .slice(
        current.contentStart,
        next ? next.start : text.length
      )
      .trim();
  }

  for (const label of ["explanation", "fix", "remember"]) {
    if (!sections[label]) {
      const error = new Error(
        `The AI response is missing the ${label} section.`
      );
      error.code = "GROQ_INVALID_FORMAT";
      throw error;
    }
  }

  return sections;
}

/**
 * Parses a multi-error batch response into explanations[], fix, remember.
 */
function parseBatchExplanationResponse(rawText, expectedErrors, language) {
  if (typeof rawText !== "string" || !rawText.trim()) {
    throw new Error("The AI returned an empty response.");
  }

  if (!Array.isArray(expectedErrors) || expectedErrors.length === 0) {
    throw new Error("Batch parsing requires the expected error list.");
  }

  const text = cleanOuterMarkdown(rawText);

  const escapedIds = expectedErrors
    .map(item => item.id)
    .sort((left, right) => right.length - left.length)
    .map(id => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const markerPattern = new RegExp(
    `(?:^|\\n)\\s*(?:\\*\\*|__)?(Explanation\\s+(\\d+)\\s*\\[id=(${escapedIds.join("|")})\\]|Individual correction|Fix|Remember)\\s*:(?:\\*\\*|__)?\\s*`,
    "gi"
  );

  const markers = [];
  let match;

  while ((match = markerPattern.exec(text)) !== null) {
    const label = match[1].toLowerCase();

    let kind;

    if (label.startsWith("explanation")) {
      kind = "explanation";
    } else if (label === "individual correction") {
      kind = "correction";
    } else {
      kind = label;
    }

    markers.push({
      kind,
      index: match[2] ? Number(match[2]) : undefined,
      id: match[3] ? match[3].trim() : undefined,
      start: match.index,
      contentStart: markerPattern.lastIndex
    });
  }

  const explanationsById = new Map();

  let fix = "";
  let remember = "";

  for (let i = 0; i < markers.length; i++) {
    const current = markers[i];
    const next = markers[i + 1];

    const content = text.slice(
      current.contentStart,
      next ? next.start : text.length
    ).trim();

    if (current.kind === "explanation") {
      if (!current.id || explanationsById.has(current.id)) {
        throw new Error(
          `Missing or duplicate explanation ID: ${current.id || "unknown"}`
        );
      }

      explanationsById.set(current.id, {
        index: current.index,
        explanation: content,
        individualCorrection: null
      });
    } else if (current.kind === "correction") {
      const previous = markers[i - 1];

      if (!previous || previous.kind !== "explanation") {
        throw new Error(
          "Individual correction must immediately follow its explanation."
        );
      }

      const entry = explanationsById.get(previous.id);

      if (!entry || entry.individualCorrection !== null) {
        throw new Error(
          `Invalid individual correction for error id=${previous.id}.`
        );
      }

      entry.individualCorrection = content;
    } else if (current.kind === "fix" && !fix) {
      fix = content;
    } else if (current.kind === "remember" && !remember) {
      remember = content;
    }
  }

  if (explanationsById.size !== expectedErrors.length) {
    throw new Error(
      "The AI response does not contain exactly one explanation per error."
    );
  }

  const expectedIds = new Set(expectedErrors.map(item => item.id));

  for (const id of explanationsById.keys()) {
    if (!expectedIds.has(id)) {
      throw new Error(
        `The AI returned an unexpected error ID: ${id}.`
      );
    }
  }

  const explanations = expectedErrors.map((item, index) => {
    const generated = explanationsById.get(item.id);

    if (
  !generated ||
  !generated.explanation ||
  !generated.individualCorrection
) {
      throw new Error(
        `The AI response is incomplete for error id=${item.id}.`
      );
    }

    const correction = generated.individualCorrection;

    return {
      id: item.id,
      error: item.error,
      lineNumber: item.lineNumber,
      errorType: item.errorType,
      explanation: generated.explanation,
      individualCorrection:
        correction === "NOT_SAFE_TO_STORE"
          ? null
          : correction
    };
  });

  if (!fix) {
    throw new Error("The AI response is missing the Fix section.");
  }

  if (!remember) {
    throw new Error("The AI response is missing the Remember section.");
  }

  const correctedSource = extractConsolidatedSource(fix, language);

  return {
    explanations,
    fix: correctedSource,
    remember
  };
}

async function generateExplanation({
  error,
  code,
  language,
  targetLanguage,
  baseExplanation,
  baseFix
}) {
  if (
    typeof error !== "string" || !error.trim() ||
    typeof code !== "string" || !code.trim() ||
    typeof language !== "string" || !language.trim() ||
    typeof targetLanguage !== "string" || !targetLanguage.trim()
  ) {
    const validationError = new Error(
      "Missing or invalid information required to generate an explanation."
    );
    validationError.code = "INVALID_EXPLANATION_INPUT";
    throw validationError;
  }

  try {
    const client = getGroqClient();

    const prompt = buildPrompt({
      error,
      code,
      language,
      targetLanguage,
      baseExplanation,
      baseFix
    });

    console.log(
      `[Groq] Generating ${language} explanation in ${targetLanguage}`
    );

    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are Code Equalize, an expert beginner-friendly programming tutor. " +
            "Follow the supplied prompt carefully. Explain the actual cause, " +
            "ground every explanation in the reported error and source, provide a technically accurate correction, " +
            "and return all three required sections."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_completion_tokens: MAX_COMPLETION_TOKENS
    });

    const rawText = completion.choices?.[0]?.message?.content;

    if (typeof rawText !== "string" || !rawText.trim()) {
      const emptyError = new Error("Groq returned an empty response.");
      emptyError.code = "GROQ_EMPTY_RESPONSE";
      throw emptyError;
    }

    const result = parseExplanationResponse(rawText);

    console.log("[Groq] Explanation generated and parsed successfully");

    return {
      explanation: result.explanation,
      fix: result.fix,
      remember: result.remember
    };

  } catch (error) {
    console.error(
      `[Groq] Request failed: ${error.code || error.name || "Error"}` +
      `${error.status ? ` (HTTP ${error.status})` : ""}`
    );

    console.error("[Groq] Error detail:", error.message || error);

    throw error;
  }
}

async function generateBatchExplanation({
  code,
  language,
  targetLanguage,
  errors,
  knowledgeContexts = []
}) {
  if (
    typeof code !== "string" || !code.trim() ||
    typeof language !== "string" || !language.trim() ||
    typeof targetLanguage !== "string" || !targetLanguage.trim() ||
    !Array.isArray(errors) ||
    errors.length === 0
  ) {
    const validationError = new Error(
      "Missing or invalid information required to generate batch explanations."
    );
    validationError.code = "INVALID_EXPLANATION_INPUT";
    throw validationError;
  }

  for (const item of errors) {
    if (
      !item ||
      typeof item.id !== "string" || !item.id.trim() ||
      typeof item.error !== "string" || !item.error.trim()
    ) {
      const validationError = new Error(
        "Each batch error requires a non-empty id and error message."
      );
      validationError.code = "INVALID_EXPLANATION_INPUT";
      throw validationError;
    }
  }

  try {
    const client = getGroqClient();

    const prompt = buildBatchPrompt({
      code,
      language,
      targetLanguage,
      errors,
      knowledgeContexts
    });

    console.log(
      `[Groq] Generating batch explanation for ${errors.length} ${language} error(s) in ${targetLanguage}`
    );

    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are Code Equalize, an expert beginner-friendly programming tutor. " +
            "Explain every listed error, provide one consolidated full-file fix, " +
            "provide a practical Remember takeaway for every listed error, and follow the output format exactly."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_completion_tokens: MAX_BATCH_COMPLETION_TOKENS
    });

    const rawText = completion.choices?.[0]?.message?.content;

    if (typeof rawText !== "string" || !rawText.trim()) {
      const emptyError = new Error("Groq returned an empty batch response.");
      emptyError.code = "GROQ_EMPTY_RESPONSE";
      throw emptyError;
    }

    const result = parseBatchExplanationResponse(rawText, errors, language);

    console.log("[Groq] Batch explanation generated and parsed successfully");

    return result;

  } catch (error) {
    console.error(
      `[Groq] Batch request failed: ${error.code || error.name || "Error"}` +
      `${error.status ? ` (HTTP ${error.status})` : ""}`
    );

    console.error("[Groq] Error detail:", error.message || error);

    throw error;
  }
}

module.exports = {
  generateExplanation,
  generateBatchExplanation,
  parseBatchExplanationResponse
};
