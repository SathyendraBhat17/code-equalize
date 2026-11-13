import * as vscode from 'vscode';

import {
  extractError,
  buildErrorId,
  RelatedDiagnostic
} from './errorExtractor';

import {
  sendExplainAll,
  BatchExplainResponse,
  BatchErrorInput,
  ErrorType
} from './apiService';

import {
  CodeEqualizePanel,
  PanelData,
  PanelExplanation,
  SUPPORTED_LANGUAGES
} from './panelView';

import {
  registerRuntimeErrorObserver,
  RuntimeError
} from './runtimeErrorService';

const DEFAULT_EXPLANATION_LANGUAGE = 'English';
const LANGUAGE_STATE_KEY = 'codeEqualize.explanationLanguageByFile';

const PROGRAMMING_LANGUAGE_MAP: Record<string, string> = {
  java: 'Java',
  python: 'Python',
  c: 'C',
  cpp: 'C++',
  'c++': 'C++'
};

export function getSupportedProgrammingLanguage(
  languageId: string
): string | undefined {
  return PROGRAMMING_LANGUAGE_MAP[languageId.toLowerCase()];
}

type DetectedError = {
  id: string;
  errorMessage: string;
  lineNumber?: number;
  errorType: ErrorType;
  relatedDiagnostics?: RelatedDiagnostic[];
};

/**
 * Everything needed to regenerate one analysis in another explanation
 * language without re-reading (possibly edited) source.
 */
type AnalysisSnapshot = {
  analysisId: string;
  generation: number;
  code: string;
  language: string;
  fileName: string;
  lineCount: number;
  /** All issues shown in the panel, including source-inferred ones. */
  issues: BatchErrorInput[];
  noIssues: boolean;
};

/** Per-file analysis identity; the document URI is the key. */
type FileState = {
  generation: number;
};

const fileStates = new Map<string, FileState>();
let extensionContext: vscode.ExtensionContext | undefined;
let lastActiveDocumentUri: string | undefined;

function getFileState(key: string): FileState {
  let state = fileStates.get(key);

  if (!state) {
    state = { generation: 0 };
    fileStates.set(key, state);
  }

  return state;
}

/* ------------------------------------------------------------------ */
/* Per-file explanation-language preference                            */
/* ------------------------------------------------------------------ */

function getPreferredLanguage(key: string): string {
  const stored = extensionContext?.workspaceState.get<
    Record<string, string>
  >(LANGUAGE_STATE_KEY)?.[key];

  return stored && SUPPORTED_LANGUAGES.includes(stored)
    ? stored
    : DEFAULT_EXPLANATION_LANGUAGE;
}

async function setPreferredLanguage(
  key: string,
  language: string
): Promise<void> {
  if (!extensionContext || !SUPPORTED_LANGUAGES.includes(language)) {
    return;
  }

  const current = extensionContext.workspaceState.get<
    Record<string, string>
  >(LANGUAGE_STATE_KEY) ?? {};

  if (current[key] === language) {
    return;
  }

  await extensionContext.workspaceState.update(LANGUAGE_STATE_KEY, {
    ...current,
    [key]: language
  });
}

/* ------------------------------------------------------------------ */
/* Response mapping                                                    */
/* ------------------------------------------------------------------ */

function toPanelData(
  result: BatchExplainResponse,
  snapshot: Omit<AnalysisSnapshot, 'issues' | 'noIssues'>,
  targetLanguage: string
): PanelData {
  const explanations: PanelExplanation[] = result.explanations.map(item => ({
    id: item.id,
    errorMessage: item.error,
    fileName: snapshot.fileName,
    // Never show a line that does not exist in the analysed source.
    lineNumber:
      typeof item.lineNumber === 'number' &&
      item.lineNumber < snapshot.lineCount
        ? item.lineNumber
        : undefined,
    errorType: item.errorType,
    issueType: item.issueType,
    summary: item.summary,
    explanation: item.explanation,
    source: item.source,
    matchedError: item.matchedError,
    distance: item.distance
  }));

  return {
    analysisId: snapshot.analysisId,
    explanations,
    fix: result.fix,
    whatWasFixed: result.whatWasFixed,
    remember: result.remember,
    correctionStatus: result.correctionStatus,
    validation: result.validation,
    noIssues: result.noIssues,
    source: result.source,
    fileName: snapshot.fileName,
    targetLanguage,
    sourceLanguage: snapshot.language
  };
}

function toBatchErrors(errors: DetectedError[]): BatchErrorInput[] {
  return errors.map(item => ({
    id: item.id,
    error: item.errorMessage,
    lineNumber: item.lineNumber,
    errorType: item.errorType,
    ...(item.relatedDiagnostics?.length
      ? { relatedDiagnostics: item.relatedDiagnostics }
      : {})
  }));
}

function errorMessageOf(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Something went wrong.';
}

/* ------------------------------------------------------------------ */
/* Analysis workflow                                                   */
/* ------------------------------------------------------------------ */

/**
 * Builds the language-change and re-analysis handlers for one analysis.
 * Responses that belong to an older analysis of the same file are
 * rejected, so they can never overwrite newer results.
 */
function createHandlers(
  key: string,
  snapshot: AnalysisSnapshot,
  baseData: PanelData,
  extensionUri: vscode.Uri
) {
  const isCurrent = (): boolean =>
    getFileState(key).generation === snapshot.generation;

  return {
    onLanguageChange: async (language: string): Promise<PanelData> => {
      if (!SUPPORTED_LANGUAGES.includes(language)) {
        throw new Error('Unsupported explanation language.');
      }

      if (!isCurrent()) {
        throw new Error('This analysis has been replaced by a newer one.');
      }

      if (snapshot.noIssues) {
        await setPreferredLanguage(key, language);
        return { ...baseData, targetLanguage: language };
      }

      // Regenerate the same issues (same IDs) in the new language. The
      // issue list is fixed, so the table does not change on a switch.
      const result = await sendExplainAll({
        code: snapshot.code,
        language: snapshot.language,
        targetLanguage: language,
        fileName: snapshot.fileName,
        analyzeSource: false,
        errors: snapshot.issues
      });

      if (!isCurrent()) {
        throw new Error('This analysis has been replaced by a newer one.');
      }

      const updated = toPanelData(result, snapshot, language);
      await setPreferredLanguage(key, language);

      console.log('[Code Equalize] Explanation language changed:', {
        language,
        issues: updated.explanations.length
      });

      return updated;
    },

    onReanalyze: (): void => {
      void reanalyzeByKey(key, extensionUri);
    }
  };
}

/**
 * Analyses one document: its latest in-memory text (including unsaved
 * edits), its editor diagnostics, and — through Groq — the complete source
 * for further problems and potential runtime risks. The result is shown in
 * that document's own panel.
 */
async function analyzeDocument(
  document: vscode.TextDocument,
  extensionUri: vscode.Uri,
  runtimeError?: DetectedError
): Promise<void> {
  const language = getSupportedProgrammingLanguage(document.languageId);

  if (!language) {
    vscode.window.showWarningMessage(
      `Code Equalize does not support the language "${document.languageId}" yet. Supported languages are Java, Python, C, and C++.`
    );
    return;
  }

  const extracted = extractError(document);

  if (!extracted) {
    vscode.window.showWarningMessage(
      'This file is empty. Add some code before running Code Equalize.'
    );
    return;
  }

  const key = document.uri.toString();
  const fileName =
    document.fileName.split(/[\\/]/).pop() || 'Current File';
  const state = getFileState(key);
  const generation = ++state.generation;
  const targetLanguage = getPreferredLanguage(key);

  const errors: DetectedError[] = extracted.errors.map(item => ({
    id: item.id,
    errorMessage: item.errorMessage,
    lineNumber: item.lineNumber,
    errorType: item.errorType,
    relatedDiagnostics: item.relatedDiagnostics
  }));

  if (runtimeError) {
    const duplicate = errors.some(item =>
      item.lineNumber === runtimeError.lineNumber &&
      item.errorMessage === runtimeError.errorMessage
    );

    if (!duplicate) {
      errors.push(runtimeError);
    }
  }

  console.log('[Code Equalize] Analysis started:', {
    language,
    diagnostics: errors.length,
    targetLanguage
  });

  const existingPanel = CodeEqualizePanel.get(key);

  if (existingPanel) {
    existingPanel.reveal();
    existingPanel.showLoading(`Analysing ${fileName}...`);
  }

  const snapshotBase = {
    analysisId: `${key}#${generation}`,
    generation,
    code: extracted.code,
    language,
    fileName,
    lineCount: document.lineCount
  };

  try {
    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Code Equalize: analysing ${fileName}...`,
        cancellable: false
      },
      () => sendExplainAll({
        code: extracted.code,
        language,
        targetLanguage,
        fileName,
        analyzeSource: true,
        errors: toBatchErrors(errors)
      })
    );

    if (state.generation !== generation) {
      // A newer analysis of this file has started; drop this result.
      return;
    }

    const panelData = toPanelData(result, snapshotBase, targetLanguage);

    const relatedById = new Map(
      errors.map(item => [item.id, item.relatedDiagnostics])
    );

    const snapshot: AnalysisSnapshot = {
      ...snapshotBase,
      noIssues: panelData.noIssues,
      issues: panelData.explanations.map(item => ({
        id: item.id,
        error: item.errorMessage,
        lineNumber: item.lineNumber,
        errorType: item.errorType ?? 'diagnostic',
        ...(relatedById.get(item.id)?.length
          ? { relatedDiagnostics: relatedById.get(item.id) }
          : {})
      }))
    };

    const panel = CodeEqualizePanel.getOrCreate(key, fileName, extensionUri);

    panel.render(
      panelData,
      createHandlers(key, snapshot, panelData, extensionUri)
    );
    panel.reveal();

    console.log('[Code Equalize] Analysis completed:', {
      issues: panelData.explanations.length,
      correctionStatus: panelData.correctionStatus,
      validation: panelData.validation.status
    });
  } catch (error) {
    if (state.generation !== generation) {
      return;
    }

    const message = errorMessageOf(error);

    console.error('[Code Equalize] Analysis failed:', message);

    CodeEqualizePanel.get(key)?.showAnalysisError(
      `Analysis failed: ${message} The previous results are still shown.`
    );

    vscode.window.showErrorMessage(`Code Equalize failed: ${message}`);
  }
}

async function reanalyzeByKey(
  key: string,
  extensionUri: vscode.Uri
): Promise<void> {
  try {
    const document =
      vscode.workspace.textDocuments.find(
        item => item.uri.toString() === key
      ) ??
      await vscode.workspace.openTextDocument(vscode.Uri.parse(key));

    await analyzeDocument(document, extensionUri);
  } catch (error) {
    const message = errorMessageOf(error);

    CodeEqualizePanel.get(key)?.showAnalysisError(
      `This file can no longer be opened for analysis: ${message}`
    );
  }
}

/**
 * Resolves the document to analyse: the right-clicked editor, else the
 * active editor, else (when a Code Equalize panel has focus) the editor
 * that was active immediately before.
 */
function resolveTargetDocument(
  uri?: unknown
): vscode.TextDocument | undefined {
  if (uri instanceof vscode.Uri) {
    const visible = vscode.window.visibleTextEditors.find(
      editor => editor.document.uri.toString() === uri.toString()
    );

    if (visible) {
      return visible.document;
    }
  }

  const active = vscode.window.activeTextEditor?.document;

  if (active) {
    return active;
  }

  if (lastActiveDocumentUri) {
    return vscode.window.visibleTextEditors.find(
      editor => editor.document.uri.toString() === lastActiveDocumentUri
    )?.document;
  }

  return undefined;
}

/**
 * Handles runtime errors observed by the Debug Adapter observer. These are
 * actual runtime evidence and are labelled "runtime"; they are analysed
 * together with the file's diagnostics and whole-source analysis.
 */
async function explainRuntimeError(
  error: RuntimeError,
  extensionUri: vscode.Uri
): Promise<void> {
  try {
    if (!error.file) {
      return;
    }

    const uri = vscode.Uri.file(error.file);
    const document =
      vscode.workspace.textDocuments.find(
        item => item.uri.toString() === uri.toString()
      ) ??
      await vscode.workspace.openTextDocument(uri);

    const errorMessage = error.message
      ? `${error.error}: ${error.message}`
      : error.error;

    const lineNumber =
      typeof error.line === 'number' &&
      error.line > 0 &&
      error.line <= document.lineCount
        ? error.line - 1
        : undefined;

    await analyzeDocument(document, extensionUri, {
      id: buildErrorId(errorMessage, lineNumber ?? 0, 'runtime'),
      errorMessage,
      lineNumber,
      errorType: 'runtime'
    });
  } catch (error) {
    console.error(
      '[Code Equalize] Runtime explanation error:',
      errorMessageOf(error)
    );

    vscode.window.showErrorMessage(
      `Code Equalize failed: ${errorMessageOf(error)}`
    );
  }
}

/**
 * Extension activation.
 */
export function activate(
  context: vscode.ExtensionContext
): void {
  console.log('[Code Equalize] Extension activated');

  extensionContext = context;
  lastActiveDocumentUri =
    vscode.window.activeTextEditor?.document.uri.toString();

  registerRuntimeErrorObserver(
    context,
    (error: RuntimeError) =>
      explainRuntimeError(error, context.extensionUri)
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        lastActiveDocumentUri = editor.document.uri.toString();
      }
    }),

    vscode.workspace.onDidCloseTextDocument(document => {
      const key = document.uri.toString();

      if (!CodeEqualizePanel.get(key)) {
        fileStates.delete(key);
      }
    }),

    vscode.commands.registerCommand('code-equalize.explain', explainCommand),
    vscode.commands.registerCommand(
      'code-equalize.explainFromEditor',
      explainCommand
    )
  );
}

/**
 * Shared handler for the Command Palette command and the editor
 * right-click menu entry.
 */
async function explainCommand(uri?: unknown): Promise<void> {
  try {
    const document = resolveTargetDocument(uri);

    if (!document) {
      vscode.window.showWarningMessage(
        'Open a Java, Python, C, or C++ file before running Code Equalize.'
      );
      return;
    }

    if (!extensionContext) {
      return;
    }

    await analyzeDocument(document, extensionContext.extensionUri);
  } catch (error) {
    console.error(
      '[Code Equalize] Extension error:',
      errorMessageOf(error)
    );

    vscode.window.showErrorMessage(
      `Code Equalize failed: ${errorMessageOf(error)}`
    );
  }
}

/**
 * Extension deactivation.
 */
export function deactivate(): void {
  console.log('[Code Equalize] Extension deactivated');
}
