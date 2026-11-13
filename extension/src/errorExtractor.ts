
import * as vscode from 'vscode';

export type ExtractedErrorType =
  | 'diagnostic'
  | 'runtime'
  | 'potential';

export interface ExtractedDiagnostic {
  id: string;
  errorMessage: string;
  lineNumber: number;
  errorType: ExtractedErrorType;
  fileName?: string;
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

const MAX_EXTRACTED_ERRORS = 12;

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
    fileName: error.fileName ?? fileName
  };
}

/**
 * Removes exact duplicates and obvious same-line cascade noise.
 */
function removeDuplicateFindings(
  errors: ExtractedDiagnostic[]
): ExtractedDiagnostic[] {
  const seenExact = new Set<string>();
  const seenLineMessages = new Set<string>();
  const result: ExtractedDiagnostic[] = [];

  for (const error of errors) {
    const exactKey = [
      error.lineNumber,
      error.errorType,
      error.errorMessage.trim().toLowerCase()
    ].join('|');

    if (seenExact.has(exactKey)) {
      continue;
    }

    const lineMessageKey = [
      error.lineNumber,
      error.errorMessage.trim().toLowerCase()
    ].join('|');

    // Drop same-line repeats even when classification differs.
    if (seenLineMessages.has(lineMessageKey)) {
      continue;
    }

    seenExact.add(exactKey);
    seenLineMessages.add(lineMessageKey);
    result.push(error);
  }

  return result;
}

/**
 * Limits cascade floods from compilers while keeping earlier root errors.
 */
function limitCascadeErrors(
  errors: ExtractedDiagnostic[]
): ExtractedDiagnostic[] {
  if (errors.length <= MAX_EXTRACTED_ERRORS) {
    return errors;
  }

  return errors.slice(0, MAX_EXTRACTED_ERRORS);
}

/**
 * Main error extraction function.
 *
 * Uses compiler/language-server diagnostics as the primary source.
 * Keeps brace/delimiter heuristics only when no diagnostics exist,
 * to avoid duplicating compiler cascade noise.
 * Does not use speculative regex "possible runtime" scanners.
 */
export function extractError(): ExtractedError | null {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    return null;
  }

  const document = editor.document;
  const code = document.getText();
  const language = document.languageId;

  const supported = [
    'java',
    'python',
    'c',
    'cpp'
  ];

  if (
    !supported.includes(language) ||
    !code.trim()
  ) {
    return null;
  }

  const fileName = document.fileName.split(/[\\/]/).pop();

  // 1. Collect actual VS Code error diagnostics.
  const diagnostics =
    vscode.languages.getDiagnostics(document.uri);

  const compilerErrors = diagnostics
  .filter(
    diagnostic =>
      diagnostic.severity ===
        vscode.DiagnosticSeverity.Error ||
      diagnostic.severity ===
        vscode.DiagnosticSeverity.Warning
  )
  .sort((a, b) => {
    const priorityA =
      a.severity === vscode.DiagnosticSeverity.Error ? 0 : 1;

    const priorityB =
      b.severity === vscode.DiagnosticSeverity.Error ? 0 : 1;

    return (
      priorityA - priorityB ||
      a.range.start.line - b.range.start.line ||
      a.message.localeCompare(b.message)
    );
  })
  .map(diagnostic =>
    withErrorIdentity(
      {
        errorMessage: diagnostic.message,
        lineNumber: diagnostic.range.start.line,
        errorType: 'diagnostic'
      },
      fileName
    )
  );

  // 2. Only use delimiter heuristics when the language server
  // reported nothing, to avoid duplicating compiler cascades.
  const syntaxErrors =
    compilerErrors.length === 0
      ? detectUnclosedBraces(code, language).map(error =>
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

  // 3. Combine, deduplicate, sort, and limit cascade floods.
  const selectedErrors = limitCascadeErrors(
  removeDuplicateFindings([
    ...compilerErrors,
    ...syntaxErrors
  ])
);

const errors = selectedErrors.sort((a, b) =>
  a.lineNumber - b.lineNumber ||
  a.errorType.localeCompare(b.errorType) ||
  a.errorMessage.localeCompare(b.errorMessage)
);

  if (errors.length === 0) {
    return null;
  }

  return {
    errorMessage: errors[0].errorMessage,
    code,
    language,
    lineNumber: errors[0].lineNumber,
    isStaticAnalysis: compilerErrors.length === 0,
    errors
  };
}
