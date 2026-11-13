const Groq = require("groq-sdk");
const { GROQ_API_KEY } = require("../config/config");
const {
  buildPrompt,
  buildBatchPrompt
} = require("../utils/promptBuilder");

let groq;

const MODEL = "openai/gpt-oss-120b";
const MAX_COMPLETION_TOKENS = 4096;
// gpt-oss-120b is a reasoning model: reasoning tokens count toward the
// completion limit, and a full corrected file plus explanations in an Indic
// language can be long. A truncated response is rejected, never shown.
const MAX_BATCH_COMPLETION_TOKENS = 16384;

// Keep the Groq call (including its single SDK retry) shorter than the
// extension's batch request timeout, so the backend always answers with a
// result or an error before the client gives up.
const GROQ_TIMEOUT_MS = 60000;

function getGroqClient() {
  if (!GROQ_API_KEY) {
    const error = new Error("GROQ_API_KEY is not configured");
    error.code = "GROQ_NOT_CONFIGURED";
    error.statusCode = 503;
    throw error;
  }

  if (!groq) {
    groq = new Groq({
      apiKey: GROQ_API_KEY,
      timeout: GROQ_TIMEOUT_MS,
      maxRetries: 1
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


const LINE_PREFIX_PATTERN = /^\s*\d+ \| ?/;

/**
 * Removes "N | " listing prefixes if the model copied them into the
 * corrected file. Only applied when every non-empty line carries one.
 */
function stripLineNumberPrefixes(source) {
  const lines = source.split("\n");
  const nonEmpty = lines.filter(line => line.trim());

  if (
    nonEmpty.length === 0 ||
    !nonEmpty.every(line => LINE_PREFIX_PATTERN.test(line))
  ) {
    return source;
  }

  return lines
    .map(line => line.replace(LINE_PREFIX_PATTERN, ""))
    .join("\n");
}

/**
 * Return the one complete source block required by the batch contract,
 * together with any prose written around the fence.
 */
function extractConsolidatedSource(fix, language) {
  // Match Markdown fences by their full delimiter length. This lets source
  // contain triple backticks when the enclosing block uses four or more.
  const blocks = [...fix.matchAll(/^[ \t]*(`{3,})([^\r\n`]*)\r?\n([\s\S]*?)^[ \t]*\1[ \t]*$/gm)];

  if (blocks.length !== 1) {
    throw new Error(
      "The AI response must contain exactly one fenced full-file source block."
    );
  }

  const [whole, , label, source] = blocks[0];
  const normalizedLabel = label.trim().toLowerCase().replace(/^language-/, "");
  const expectedLabels = {
    "C++": new Set(["cpp", "c++", "cxx"]),
    "C": new Set(["c"]),
    "Java": new Set(["java"]),
    "Python": new Set(["python", "py", "python3"])
  };
  const accepted = expectedLabels[language];

  if (normalizedLabel && accepted && !accepted.has(normalizedLabel)) {
    throw new Error(
      `The AI returned ${normalizedLabel} source for a ${language} file.`
    );
  }

  // The newline immediately before the closing fence is Markdown framing,
  // not part of the program text.
  const code = stripLineNumberPrefixes(source.replace(/\r?\n$/, ""));

  if (!code.trim()) {
    throw new Error("The AI returned an empty corrected source file.");
  }

  const start = blocks[0].index;
  const prose = (
    fix.slice(0, start) + "\n" + fix.slice(start + whole.length)
  ).trim();

  return { code, prose };
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


const MAX_ADDITIONAL_ISSUES = 10;
const NO_ISSUES_MARKER = "NO_ISSUES_FOUND";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Splits an issue block into its "Error type:", "Summary:" and
 * explanation paragraph. The labels are optional for compatibility.
 */
function splitIssueContent(content) {
  let issueType = "";
  let summary = "";
  const remaining = [];

  for (const line of content.split(/\r?\n/)) {
    const typeMatch = !issueType &&
      line.match(/^\s*(?:[-*]\s*)?(?:\*\*|__)?Error type(?:\*\*|__)?\s*:\s*(?:\*\*|__)?\s*(.*?)\s*(?:\*\*|__)?\s*$/i);
    if (typeMatch) {
      issueType = typeMatch[1].trim();
      continue;
    }

    const summaryMatch = !summary &&
      line.match(/^\s*(?:[-*]\s*)?(?:\*\*|__)?Summary(?:\*\*|__)?\s*:\s*(?:\*\*|__)?\s*(.*?)\s*$/i);
    if (summaryMatch) {
      summary = summaryMatch[1].replace(/(?:\*\*|__)$/, "").trim();
      continue;
    }

    remaining.push(line);
  }

  return {
    issueType: issueType.replace(/[.。]$/, "").slice(0, 80),
    summary: summary.slice(0, 400),
    explanation: remaining.join("\n").trim()
  };
}

function slugify(value) {
  return String(value || "issue")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "issue";
}

/**
 * Parses a coordinated batch response into explanations[], additional
 * source-inferred issues, one corrected file, What was fixed, and Remember.
 *
 * Stable IDs are authoritative: every listed error must have exactly one
 * explanation, unknown or duplicate IDs are rejected, and incomplete
 * responses throw instead of being presented as complete.
 */
function parseBatchExplanationResponse(
  rawText,
  expectedErrors,
  language,
  options = {}
) {
  if (typeof rawText !== "string" || !rawText.trim()) {
    throw new Error("The AI returned an empty response.");
  }

  if (!Array.isArray(expectedErrors)) {
    throw new Error("Batch parsing requires the expected error list.");
  }

  const analyzeSource = options.analyzeSource === true;
  const lineCount =
    Number.isInteger(options.lineCount) && options.lineCount > 0
      ? options.lineCount
      : Number.MAX_SAFE_INTEGER;
  const maxAdditional =
    Number.isInteger(options.maxAdditionalIssues)
      ? options.maxAdditionalIssues
      : MAX_ADDITIONAL_ISSUES;

  if (expectedErrors.length === 0 && !analyzeSource) {
    throw new Error("Batch parsing requires the expected error list.");
  }

  const text = cleanOuterMarkdown(rawText);

  const escapedIds = expectedErrors
    .map(item => item.id)
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp);
  const idPattern = escapedIds.length ? escapedIds.join("|") : "(?!)";

  const markerPattern = new RegExp(
    "(?:^|\\n)[ \\t]*(?:#{1,4}[ \\t]*)?(?:\\*\\*|__)?(" +
      `Explanation\\s+(\\d+)\\s*\\[id=(${idPattern})\\]` +
      "|Additional issue\\s+(\\d+)\\s*\\[line=([^\\]\\n]*)\\]" +
      "|Individual correction|Correction status|Fix|What was fixed|Remember" +
    ")\\s*:(?:\\*\\*|__)?[ \\t]*",
    "gi"
  );

  const markers = [];
  let match;

  while ((match = markerPattern.exec(text)) !== null) {
    const label = match[1].toLowerCase();
    let kind;

    if (label.startsWith("explanation")) {
      kind = "explanation";
    } else if (label.startsWith("additional issue")) {
      kind = "additional";
    } else if (label === "individual correction") {
      kind = "correction";
    } else if (label === "correction status") {
      kind = "status";
    } else if (label === "what was fixed") {
      kind = "whatWasFixed";
    } else {
      kind = label;
    }

    markers.push({
      kind,
      index: match[2] ? Number(match[2]) : undefined,
      id: match[3] ? match[3].trim() : undefined,
      lineLabel: match[5] !== undefined ? match[5].trim() : undefined,
      start: match.index,
      contentStart: markerPattern.lastIndex
    });
  }

  // A clean file: the model reports that nothing is wrong.
  if (
    expectedErrors.length === 0 &&
    !markers.some(item =>
      item.kind === "explanation" || item.kind === "additional"
    ) &&
    new RegExp(`(^|\\n)\\s*${NO_ISSUES_MARKER}\\b`).test(text)
  ) {
    return {
      explanations: [],
      additionalIssues: [],
      fix: "",
      whatWasFixed: "",
      remember: "",
      correctionStatus: "none",
      noIssues: true
    };
  }

  const explanationsById = new Map();
  const additionalIssues = [];
  const usedAdditionalIds = new Set();
  const seenAdditional = new Set();

  let fix = "";
  let whatWasFixed = "";
  let remember = "";
  let statusText = "";

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
        ...splitIssueContent(content),
        individualCorrection: null
      });
    } else if (current.kind === "additional") {
      if (!analyzeSource) {
        // Additional findings were not requested; ignore them safely.
        continue;
      }

      const parts = splitIssueContent(content);

      if (!parts.explanation && !parts.summary) {
        throw new Error("The AI returned an additional issue without an explanation.");
      }

      const lineValue = Number.parseInt(current.lineLabel, 10);
      const lineNumber =
        Number.isInteger(lineValue) &&
        String(lineValue) === current.lineLabel &&
        lineValue >= 1 &&
        lineValue <= lineCount
          ? lineValue - 1
          : undefined;

      const dedupeKey = `${lineNumber ?? "na"}|${parts.issueType.toLowerCase()}`;

      if (seenAdditional.has(dedupeKey)) {
        continue;
      }

      seenAdditional.add(dedupeKey);

      if (additionalIssues.length >= maxAdditional) {
        continue;
      }

      let id = `potential|${lineNumber ?? "na"}|${slugify(parts.issueType)}`;
      let suffix = 2;

      while (
        usedAdditionalIds.has(id) ||
        expectedErrors.some(item => item.id === id)
      ) {
        id = `potential|${lineNumber ?? "na"}|${slugify(parts.issueType)}-${suffix++}`;
      }

      usedAdditionalIds.add(id);

      additionalIssues.push({
        id,
        error: parts.summary || parts.issueType || "Potential issue",
        lineNumber,
        errorType: "potential",
        issueType: parts.issueType,
        summary: parts.summary,
        explanation: parts.explanation || parts.summary
      });
    } else if (current.kind === "correction") {
      const previous = markers[i - 1];

      if (!previous || previous.kind !== "explanation") {
        // Corrections attached to additional issues are not stored.
        if (previous && previous.kind === "additional") {
          continue;
        }

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
    } else if (current.kind === "whatWasFixed" && !whatWasFixed) {
      whatWasFixed = content;
    } else if (current.kind === "remember" && !remember) {
      remember = content;
    } else if (current.kind === "status" && !statusText) {
      statusText = content;
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

  const explanations = expectedErrors.map(item => {
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
      issueType: generated.issueType,
      summary: generated.summary,
      explanation: generated.explanation,
      individualCorrection:
        correction === "NOT_SAFE_TO_STORE"
          ? null
          : correction
    };
  });

  if (explanations.length + additionalIssues.length === 0) {
    throw new Error("The AI response did not contain any issue explanations.");
  }

  if (!fix) {
    throw new Error("The AI response is missing the Fix section.");
  }

  if (!remember) {
    throw new Error("The AI response is missing the Remember section.");
  }

  const { code: correctedSource, prose } =
    extractConsolidatedSource(fix, language);

  const fixedSummary = whatWasFixed || prose;

  if (!fixedSummary) {
    throw new Error("The AI response is missing the What was fixed section.");
  }

  // A missing status is treated conservatively: never claim completeness
  // the model did not state.
  const correctionStatus = /^\W*COMPLETE\b/i.test(statusText)
    ? "complete"
    : "partial";

  return {
    explanations,
    additionalIssues,
    fix: correctedSource,
    whatWasFixed: fixedSummary,
    remember,
    correctionStatus,
    noIssues: false
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
  knowledgeContexts = [],
  fileName,
  analyzeSource = false
}) {
  if (
    typeof code !== "string" || !code.trim() ||
    typeof language !== "string" || !language.trim() ||
    typeof targetLanguage !== "string" || !targetLanguage.trim() ||
    !Array.isArray(errors) ||
    (errors.length === 0 && !analyzeSource)
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
      knowledgeContexts,
      fileName,
      analyzeSource,
      maxAdditionalIssues: MAX_ADDITIONAL_ISSUES
    });

    console.log(
      `[Groq] Generating batch explanation for ${errors.length} ${language} error(s) in ${targetLanguage}` +
      `${analyzeSource ? " with whole-source analysis" : ""}`
    );

    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are Code Equalize, an expert beginner-friendly programming tutor. " +
            "Analyse the complete source file, explain every issue accurately, " +
            "provide one complete corrected file, a What was fixed summary, and one " +
            "consolidated Remember section, and follow the output format exactly."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_completion_tokens: MAX_BATCH_COMPLETION_TOKENS
    });

    const choice = completion.choices?.[0];
    const rawText = choice?.message?.content;

    if (choice?.finish_reason === "length") {
      const truncatedError = new Error(
        "Groq stopped before completing the batch response (token limit)."
      );
      truncatedError.code = "GROQ_TRUNCATED";
      throw truncatedError;
    }

    if (typeof rawText !== "string" || !rawText.trim()) {
      const emptyError = new Error("Groq returned an empty batch response.");
      emptyError.code = "GROQ_EMPTY_RESPONSE";
      throw emptyError;
    }

    const result = parseBatchExplanationResponse(
      rawText,
      errors,
      language,
      {
        analyzeSource,
        lineCount: code.split(/\r?\n/).length,
        maxAdditionalIssues: MAX_ADDITIONAL_ISSUES
      }
    );

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
  parseBatchExplanationResponse,
  extractConsolidatedSource
};
