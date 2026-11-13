import * as vscode from 'vscode';

export type ExtractedErrorType =
  | 'diagnostic'
  | 'runtime'
  | 'potential';

export interface RelatedDiagnostic {
  message: string;
  lineNumber: number;
}

export interface ExtractedDiagnostic {
  id: string;
  errorMessage: string;
  lineNumber: number;
  errorType: ExtractedErrorType;
  fileName?: string;
  /** Cascading diagnostics caused by this same root mistake. */
  relatedDiagnostics?: RelatedDiagnostic[];
}

export interface ExtractedError {
  errorMessage: string;
  code: string;
  language: string;
  lineNumber: number;
  isStaticAnalysis?: boolean;
  errors: ExtractedDiagnostic[];
}


interface ScannerState {
  inBlockComment: boolean;
  quote: string;
  tripleQuote: string;
  escaped: boolean;
  rawStringEnd: string;
}

/**
 * Removes comments and string contents while preserving line structure.
 * Supports Python triple-quoted strings, Java text blocks,
 * C/C++ comments, and C++ raw strings.
 */
function cleanSourceLines(
  lines: string[],
  language: string
): string[] {
  const state: ScannerState = {
    inBlockComment: false,
    quote: '',
    tripleQuote: '',
    escaped: false,
    rawStringEnd: ''
  };

  const cleanedLines: string[] = [];

  for (const line of lines) {
    let result = '';
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      const next = line[i + 1];

      // Continue skipping a C/C++/Java block comment.
      if (state.inBlockComment) {
        if (char === '*' && next === '/') {
          state.inBlockComment = false;
          result += '  ';
          i += 2;
        } else {
          result += ' ';
          i++;
        }
        continue;
      }

      // Continue skipping a multiline string.
      if (state.tripleQuote) {
        if (
          line.startsWith(state.tripleQuote, i) &&
          !state.escaped
        ) {
          result += '   ';
          i += 3;
          state.tripleQuote = '';
        } else {
          if (char === '\\' && !state.escaped) {
            state.escaped = true;
          } else {
            state.escaped = false;
          }

          result += ' ';
          i++;
        }
        continue;
      }

      // Continue skipping a C++ raw string.
      if (state.rawStringEnd) {
        if (line.startsWith(state.rawStringEnd, i)) {
          result += ' '.repeat(state.rawStringEnd.length);
          i += state.rawStringEnd.length;
          state.rawStringEnd = '';
        } else {
          result += ' ';
          i++;
        }
        continue;
      }

      // Continue skipping an ordinary string.
      if (state.quote) {
        if (state.escaped) {
          state.escaped = false;
        } else if (char === '\\') {
          state.escaped = true;
        } else if (char === state.quote) {
          state.quote = '';
        }

        result += ' ';
        i++;
        continue;
      }

      // C++ raw string: R"delimiter(... )delimiter"
      if (
        language === 'cpp' &&
        line.startsWith('R"', i)
      ) {
        const openingParen = line.indexOf('(', i + 2);

        if (openingParen !== -1) {
          const delimiter = line.slice(i + 2, openingParen);

          if (
            delimiter.length <= 16 &&
            !/[\s()\\]/.test(delimiter)
          ) {
            const rawEnd = `)${delimiter}"`;

            result += ' '.repeat(openingParen - i + 1);
            i = openingParen + 1;

            const closingIndex = line.indexOf(rawEnd, i);

            if (closingIndex === -1) {
              result += ' '.repeat(line.length - i);
              state.rawStringEnd = rawEnd;
              i = line.length;
            } else {
              result += ' '.repeat(closingIndex - i + rawEnd.length);
              i = closingIndex + rawEnd.length;
            }

            continue;
          }
        }
      }

      // Python triple-quoted strings and Java text blocks.
      if (
        (language === 'python' || language === 'java') &&
        (
          line.startsWith('"""', i) ||
          line.startsWith("'''", i)
        )
      ) {
        const delimiter = line.slice(i, i + 3);
        result += '   ';
        i += 3;

        const closingIndex = line.indexOf(delimiter, i);

        if (closingIndex === -1) {
          result += ' '.repeat(line.length - i);
          state.tripleQuote = delimiter;
          state.escaped = false;
          i = line.length;
        } else {
          result += ' '.repeat(closingIndex - i + 3);
          i = closingIndex + 3;
        }

        continue;
      }

      // Start a block comment.
      if (
        language !== 'python' &&
        char === '/' &&
        next === '*'
      ) {
        state.inBlockComment = true;
        result += '  ';
        i += 2;
        continue;
      }

      // Start a single-line comment.
      if (
        language === 'python' &&
        char === '#'
      ) {
        result += ' '.repeat(line.length - i);
        break;
      }

      if (
        language !== 'python' &&
        char === '/' &&
        next === '/'
      ) {
        result += ' '.repeat(line.length - i);
        break;
      }

      // Start an ordinary string.
      if (char === '"' || char === "'") {
        state.quote = char;
        state.escaped = false;
        result += ' ';
        i++;
        continue;
      }

      result += char;
      i++;
    }

    // Ordinary strings cannot continue across physical lines
    // in these languages unless they use a multiline form.
    if (state.quote) {
      state.quote = '';
      state.escaped = false;
    }

    cleanedLines.push(result);
  }

  return cleanedLines;
}

/**
 * Detects unmatched parentheses, brackets and braces.
 * This is a lightweight heuristic, not a full parser.
 */
function detectUnclosedBraces(
  code: string,
  language: string
): Array<{
  errorMessage: string;
  lineNumber: number;
  errorType: 'diagnostic';
}> {
  const findings: Array<{
    errorMessage: string;
    lineNumber: number;
    errorType: 'diagnostic';
  }> = [];

  const stack: {
    char: string;
    line: number;
  }[] = [];

  const matching: Record<string, string> = {
    ')': '(',
    ']': '[',
    '}': '{'
  };

  const lines = cleanSourceLines(
    code.split(/\r?\n/),
    language
  );

  for (
    let lineNumber = 0;
    lineNumber < lines.length;
    lineNumber++
  ) {
    for (const char of lines[lineNumber]) {
      if (
        char === '(' ||
        char === '[' ||
        char === '{'
      ) {
        stack.push({
          char,
          line: lineNumber
        });
        continue;
      }

      if (
        char === ')' ||
        char === ']' ||
        char === '}'
      ) {
        const last = stack[stack.length - 1];

        if (last && last.char === matching[char]) {
          stack.pop();
        } else {
          findings.push({
            errorMessage: `Unexpected closing '${char}'`,
            lineNumber,
            errorType: 'diagnostic'
          });
        }
      }
    }
  }

  for (const item of stack) {
    const closing =
      item.char === '{'
        ? '}'
        : item.char === '['
          ? ']'
          : ')';

    findings.push({
      errorMessage:
        `Missing closing '${closing}' for '${item.char}' opened on line ${item.line + 1}`,
      lineNumber: item.line,
      errorType: 'diagnostic'
    });
  }

  return findings;
}

export const MAX_EXTRACTED_ERRORS = 12;
const MAX_RELATED_DIAGNOSTICS = 10;

export const SUPPORTED_LANGUAGE_IDS = [
  'java',
  'python',
  'c',
  'cpp'
];

/**
 * Builds a stable error identity for batch regeneration.
 */
export function buildErrorId(
  errorMessage: string,
  lineNumber: number,
  errorType: ExtractedErrorType
): string {
  const normalizedMessage = errorMessage
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 120);

  return [
    errorType,
    String(lineNumber),
    normalizedMessage
  ].join('|');
}

function withErrorIdentity(
  error: Omit<ExtractedDiagnostic, 'id'>,
  fileName?: string
): ExtractedDiagnostic {
  const errorType = error.errorType;
  const errorMessage = error.errorMessage;
  const lineNumber = error.lineNumber;

  return {
    id: buildErrorId(errorMessage, lineNumber, errorType),
    errorMessage,
    lineNumber,
    errorType,
    fileName: error.fileName ?? fileName,
    ...(error.relatedDiagnostics?.length
      ? { relatedDiagnostics: error.relatedDiagnostics }
      : {})
  };
}

/**
 * Plain data view of a VS Code diagnostic so the grouping logic can be
 * unit-tested without the VS Code API.
 */
export interface DiagnosticInput {
  message: string;
  line: number;
  character: number;
  isError: boolean;
  isUnnecessary?: boolean;
  isDeprecated?: boolean;
  source?: string;
  code?: string;
}

/**
 * Warnings that describe code quality rather than a correctness problem.
 * Code Equalize is not a general-purpose linter.
 */
const NON_CORRECTNESS_PATTERNS: RegExp[] = [
  /\bunused\b/i,
  /\bnever (?:used|read|referenced)\b/i,
  /\bis not accessed\b/i,
  /\bis declared but (?:its value is )?never\b/i,
  /\bassigned (?:a value )?but never used\b/i,
  /\bdefined but not used\b/i,
  /\bset but not used\b/i,
  /\bunnecessary\b/i,
  /\bredundant\b/i,
  /\bdeprecated\b/i,
  /\bline too long\b/i,
  /\bwhitespace\b/i,
  /\btrailing\b.*\b(?:space|newline)/i,
  /\bblank line/i,
  /\bnaming convention\b/i,
  /\bdocstring\b/i,
  /\bcould be (?:simplified|final|static|private)\b/i,
  /\bcan be (?:simplified|replaced|made)\b/i,
  /\bconsider (?:using|adding|replacing)\b/i,
  /\bserializable class\b.*\bserialVersionUID\b/i,
  /\bresource leak\b/i,
  /\braw type\b/i,
  /\bmissing (?:module|class|function) docstring\b/i
];

/** Style-only linter codes (pycodestyle / flake8 / pylint conventions). */
const STYLE_CODE_PATTERN = /^(?:E[1-3]\d\d|E50\d|W[1-6]\d\d|C\d{4}|R\d{4}|D\d{3})$/;

/**
 * Returns true when a warning represents a genuine correctness problem
 * (for example an undefined name or an unsafe operation).
 */
export function isMeaningfulDiagnostic(input: DiagnosticInput): boolean {
  if (input.isError) {
    return true;
  }

  if (input.isUnnecessary || input.isDeprecated) {
    return false;
  }

  if (input.code && STYLE_CODE_PATTERN.test(input.code)) {
    return false;
  }

  return !NON_CORRECTNESS_PATTERNS.some(pattern =>
    pattern.test(input.message)
  );
}

/**
 * Diagnostics that usually describe the real mistake when a parser
 * loses track (unclosed delimiter, unterminated string, unexpected EOF).
 */
const ROOT_DELIMITER_PATTERNS: RegExp[] = [
  /was (?:never|not) closed/i,
  /\bunclosed\b/i,
  /\bunmatched\b/i,
  /\bunbalanced\b/i,
  /missing (?:closing|terminating|matching)/i,
  /reached end of file while parsing/i,
  /\bend of input\b/i,
  /unexpected (?:end of file|EOF)/i,
  /\bEOF\b.*\b(?:while|in)\b/i,
  /expected ['"`]?[)\]}]['"`]?/i
];

const ROOT_STRING_PATTERNS: RegExp[] = [
  /\bunterminated\b/i,
  /missing terminating ['"]/i,
  /\bEOL while scanning\b/i,
  /\bunclosed (?:string|character|char) literal\b/i
];

/**
 * Generic parser messages that commonly appear *because of* an earlier
 * syntax error rather than as an independent mistake. Indentation errors,
 * undefined names, and type errors are deliberately NOT listed: they are
 * kept as independent root causes.
 */
const CASCADE_PATTERNS: RegExp[] = [
  /^expected expression\b/i,
  /^expected an expression\b/i,
  /statements must be separated by newlines or semicolons/i,
  /^unexpected token\b/i,
  /^expected declaration or statement at end of input/i,
  /^expected (?:member name|declaration)\b/i,
  /class, interface, enum,? or record expected/i,
  /^illegal start of (?:expression|type)/i,
  /^not a statement$/i,
  /^invalid syntax\.?$/i,
  /^syntax error[,:]? (?:insert|delete)\b/i,
  /^expression expected\b/i,
  /^declaration expected\b/i
];

const STRING_CASCADE_WINDOW = 3;
const DELIMITER_CASCADE_WINDOW = 10;

function normalizeMessage(message: string): string {
  return message.trim().toLowerCase().replace(/\s+/g, ' ');
}

interface GroupedDiagnostic {
  message: string;
  line: number;
  character: number;
  isError: boolean;
  related: RelatedDiagnostic[];
  rootWindow: number;
}

/**
 * Groups cascading parser diagnostics under the root mistake that caused
 * them and removes duplicates reported by several providers. Independent
 * mistakes — even on nearby lines — are kept as separate entries.
 */
export function groupDiagnostics(
  inputs: DiagnosticInput[]
): GroupedDiagnostic[] {
  const sorted = [...inputs].sort((a, b) =>
    a.line - b.line ||
    a.character - b.character ||
    a.message.localeCompare(b.message)
  );

  const kept: GroupedDiagnostic[] = [];

  for (const input of sorted) {
    const normalized = normalizeMessage(input.message);

    // Duplicate of an already kept diagnostic at the same position,
    // possibly reported by another provider with slightly different text.
    const duplicate = kept.find(item => {
      if (item.line !== input.line) {
        return false;
      }

      const other = normalizeMessage(item.message);

      return other === normalized ||
        (
          item.character === input.character &&
          (other.includes(normalized) || normalized.includes(other))
        );
    });

    if (duplicate) {
      continue;
    }

    const isCascade = CASCADE_PATTERNS.some(pattern =>
      pattern.test(input.message.trim())
    );

    if (isCascade) {
      // Attach to the nearest preceding root syntax error whose influence
      // window covers this line.
      const root = [...kept].reverse().find(item =>
        item.rootWindow > 0 &&
        input.line >= item.line &&
        input.line - item.line <= item.rootWindow
      );

      if (root) {
        if (root.related.length < MAX_RELATED_DIAGNOSTICS) {
          root.related.push({
            message: input.message,
            lineNumber: input.line
          });
        }
        continue;
      }
    }

    const rootWindow = ROOT_STRING_PATTERNS.some(pattern =>
      pattern.test(input.message)
    )
      ? STRING_CASCADE_WINDOW
      : ROOT_DELIMITER_PATTERNS.some(pattern =>
          pattern.test(input.message)
        )
        ? DELIMITER_CASCADE_WINDOW
        : 0;

    kept.push({
      message: input.message,
      line: input.line,
      character: input.character,
      isError: input.isError,
      related: [],
      rootWindow
    });
  }

  return kept;
}

/**
 * Limits cascade floods from compilers while keeping errors before
 * warnings and earlier root errors first.
 */
function limitErrors(
  errors: GroupedDiagnostic[]
): GroupedDiagnostic[] {
  if (errors.length <= MAX_EXTRACTED_ERRORS) {
    return errors;
  }

  return [...errors]
    .sort((a, b) =>
      Number(b.isError) - Number(a.isError) ||
      a.line - b.line ||
      a.character - b.character
    )
    .slice(0, MAX_EXTRACTED_ERRORS);
}

function toDiagnosticInput(
  diagnostic: vscode.Diagnostic
): DiagnosticInput {
  const code = diagnostic.code;
  const codeValue =
    typeof code === 'string' || typeof code === 'number'
      ? String(code)
      : code && typeof code === 'object'
        ? String(code.value)
        : undefined;

  return {
    message: diagnostic.message,
    line: diagnostic.range.start.line,
    character: diagnostic.range.start.character,
    isError:
      diagnostic.severity === vscode.DiagnosticSeverity.Error,
    isUnnecessary:
      diagnostic.tags?.includes(vscode.DiagnosticTag.Unnecessary) ??
      false,
    isDeprecated:
      diagnostic.tags?.includes(vscode.DiagnosticTag.Deprecated) ??
      false,
    source: diagnostic.source,
    code: codeValue
  };
}

/**
 * Collects the meaningful problems of one document.
 *
 * - Uses the document's latest in-memory text (including unsaved edits).
 * - Uses compiler/language-server diagnostics as the primary source,
 *   keeping errors and correctness warnings, dropping style/unused hints.
 * - Groups cascading parser diagnostics under their root cause.
 * - Uses delimiter heuristics only when no diagnostics exist.
 *
 * Returns null for unsupported or empty documents. A supported document
 * with no diagnostics returns an empty list: whole-source AI analysis
 * still runs for it.
 */
export function extractError(
  document: vscode.TextDocument | undefined =
    vscode.window.activeTextEditor?.document
): ExtractedError | null {
  if (!document) {
    return null;
  }

  const code = document.getText();
  const language = document.languageId;

  if (
    !SUPPORTED_LANGUAGE_IDS.includes(language) ||
    !code.trim()
  ) {
    return null;
  }

  const fileName = document.fileName.split(/[\\/]/).pop();

  // 1. Collect actual VS Code diagnostics for this document only.
  const diagnostics = vscode.languages
    .getDiagnostics(document.uri)
    .filter(diagnostic =>
      diagnostic.severity === vscode.DiagnosticSeverity.Error ||
      diagnostic.severity === vscode.DiagnosticSeverity.Warning
    )
    .map(toDiagnosticInput)
    .filter(isMeaningfulDiagnostic);

  const grouped = limitErrors(groupDiagnostics(diagnostics));

  const compilerErrors = grouped.map(item =>
    withErrorIdentity(
      {
        errorMessage: item.message,
        lineNumber: item.line,
        errorType: 'diagnostic',
        relatedDiagnostics: item.related
      },
      fileName
    )
  );

  // 2. Only use delimiter heuristics when the language server reported
  // nothing, so they never override reliable compiler diagnostics.
  const syntaxErrors =
    diagnostics.length === 0
      ? detectUnclosedBraces(code, language)
          .slice(0, MAX_EXTRACTED_ERRORS)
          .map(error =>
            withErrorIdentity(
              {
                errorMessage: error.errorMessage,
                lineNumber: error.lineNumber,
                errorType: 'diagnostic'
              },
              fileName
            )
          )
      : [];

  // 3. Remove identical IDs and sort deterministically by line.
  const seenIds = new Set<string>();
  const errors = [...compilerErrors, ...syntaxErrors]
    .filter(item => {
      if (seenIds.has(item.id)) {
        return false;
      }
      seenIds.add(item.id);
      return true;
    })
    .sort((a, b) =>
      a.lineNumber - b.lineNumber ||
      a.errorMessage.localeCompare(b.errorMessage)
    );

  return {
    errorMessage: errors[0]?.errorMessage ?? '',
    code,
    language,
    lineNumber: errors[0]?.lineNumber ?? 0,
    isStaticAnalysis: compilerErrors.length === 0,
    errors
  };
}
