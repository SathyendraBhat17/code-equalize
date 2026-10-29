import * as vscode from 'vscode';

/**
 * Guesses a likely runtime exception from common source patterns.
 * This is a heuristic, not proof that the exception will occur.
 */
function detectRuntimeErrorPattern(
  code: string,
  language: string
): string | undefined {
  if (language === 'java') {
    if (/\bnull\b/.test(code) && /\.\s*\w+\s*\(/.test(code)) {
      return 'Possible NullPointerException';
    }
    if (/\/\s*0\b|%\s*0\b/.test(code)) {
      return 'Possible ArithmeticException (divide by zero)';
    }
    if (/Integer\.parseInt|Long\.parseLong/.test(code)) {
      return 'Possible NumberFormatException';
    }
  }

  if (language === 'python') {
    if (/\bNone\b/.test(code) && /\.\w+\s*\(/.test(code)) {
      return 'Possible AttributeError';
    }
    if (/\/\s*0\b/.test(code)) {
      return 'Possible ZeroDivisionError';
    }
    if (/\bint\s*\(|\bfloat\s*\(/.test(code)) {
      return 'Possible ValueError';
    }
    if (/\bopen\s*\(/.test(code)) {
      return 'Possible file-related error';
    }
  }

  if (language === 'c' || language === 'cpp') {
    if (/NULL|nullptr/.test(code) && /->|\*/.test(code)) {
      return 'Possible null pointer dereference';
    }
    if (/\/\s*0\b|%\s*0\b/.test(code)) {
      return 'Possible division by zero';
    }
    if (/malloc|calloc|realloc/.test(code) && !/free\s*\(/.test(code)) {
      return 'Possible memory leak';
    }
    if (/scanf|gets\s*\(/.test(code)) {
      return 'Possible buffer overflow';
    }
  }

  return undefined;
}

/**
 * Extracts the first error diagnostic and nearby code from the active editor.
 * If no diagnostics are found, falls back to sending the full file for
 * static / runtime-pattern analysis by the backend AI.
 */
export function extractError(): {
  errorMessage: string;
  code: string;
  language: string;
  lineNumber: number;
  isStaticAnalysis?: boolean;
} | null {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return null;
  }

  const document = editor.document;
  const diagnostics = vscode.languages.getDiagnostics(document.uri);
  const errorDiagnostics = diagnostics.filter(
    (d) => d.severity === vscode.DiagnosticSeverity.Error
  );

  // ── Path 1: VS Code found a compile-time / lint error ─────────────────────
  if (errorDiagnostics.length > 0) {
    const diagnostic = errorDiagnostics[0];
    const code = document.getText();
    return {
      errorMessage: diagnostic.message,
      code,
      language: document.languageId,
      lineNumber: diagnostic.range.start.line,
      isStaticAnalysis: false,
    };
  }

  // ── Path 2: No diagnostics — fall back to full-file static analysis ────────
  const lang = document.languageId;
  const supported = ['java', 'python', 'c', 'cpp'];
  if (!supported.includes(lang)) {
    return null;
  }

  const code = document.getText();
  if (!code.trim()) {
    return null;
  }

  const detected = detectRuntimeErrorPattern(code, lang);
  const errorMessage =
    detected ?? 'Analyse this code for potential runtime errors and bugs.';

  return {
    errorMessage,
    code,
    language: lang,
    lineNumber: 0,
    isStaticAnalysis: true,
  };
}