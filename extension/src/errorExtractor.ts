import * as vscode from 'vscode';

/**
 * Extracts the first error diagnostic and nearby code from the active editor.
 */
export function extractError(): {
  errorMessage: string;
  code: string;
  language: string;
  lineNumber: number;
} | null {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return null;
  }

  const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
  const errorDiagnostics = diagnostics.filter(
    (diagnostic) => diagnostic.severity === vscode.DiagnosticSeverity.Error
  );

  if (errorDiagnostics.length === 0) {
    return null;
  }

  const diagnostic = errorDiagnostics[0];
  const errorLine = diagnostic.range.start.line;
  const startLine = 0;
  const endLine = editor.document.lineCount - 1;

  const codeLines: string[] = [];
  for (let line = startLine; line <= endLine; line += 1) {
    codeLines.push(editor.document.lineAt(line).text);
  }

  const errorMessage = diagnostic.message;
  const code = codeLines.join('\n');
  const language = editor.document.languageId;
  const lineNumber = diagnostic.range.start.line;

  return { errorMessage, code, language, lineNumber };
}
