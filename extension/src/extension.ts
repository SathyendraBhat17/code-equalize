
import * as vscode from 'vscode';

import {
  extractError,
  buildErrorId
} from './errorExtractor';

import {
  sendExplainAll,
  BatchExplainResponse,
  ErrorType
} from './apiService';

import {
  showPanel,
  PanelData
} from './panelView';

import {
  registerRuntimeErrorObserver,
  RuntimeError
} from './runtimeErrorService';

const SUPPORTED_EXPLANATION_LANGUAGES = [
  'English',
  'Hindi',
  'Bengali',
  'Marathi',
  'Telugu',
  'Tamil',
  'Gujarati',
  'Urdu',
  'Kannada',
  'Odia',
  'Malayalam'
];

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
  fileName?: string;
  lineNumber?: number;
  errorType: ErrorType;
};

type ExplanationRequest = {
  code: string;
  language: string;
  sourceLanguage: string;
  fileName?: string;
  errors: DetectedError[];
};

/**
 * Sort errors by source line while preserving their original
 * order when line numbers are equal or unavailable.
 */
function sortErrorsByLine(
  errors: DetectedError[]
): DetectedError[] {
  return [...errors].sort((a, b) => {
    const lineA = a.lineNumber ?? Number.MAX_SAFE_INTEGER;
    const lineB = b.lineNumber ?? Number.MAX_SAFE_INTEGER;

    return lineA - lineB;
  });
}

/**
 * Converts the batch backend response into the panel format.
 */
function toPanelData(
  result: BatchExplainResponse,
  request: ExplanationRequest,
  targetLanguage: string
): PanelData {
  const sortedErrors = sortErrorsByLine(request.errors);

  const explanations = result.explanations
    .map(item => {
      const original = sortedErrors.find(
        error => error.id === item.id
      );

      return {
        id: item.id,
        errorMessage: item.error,
        fileName: original?.fileName ?? request.fileName,
        lineNumber: item.lineNumber ?? original?.lineNumber,
        errorType: item.errorType,
        explanation: item.explanation,
        source: item.source,
        matchedError: item.matchedError,
        distance: item.distance
      };
    })
    .sort((a, b) => {
      const lineA = a.lineNumber ?? Number.MAX_SAFE_INTEGER;
      const lineB = b.lineNumber ?? Number.MAX_SAFE_INTEGER;

      return lineA - lineB;
    });

  return {
    explanations,
    fix: result.fix,
    remember: result.remember,
    source: result.source,
    targetLanguage,
    sourceLanguage: request.sourceLanguage,
    fileName: request.fileName,
    errors: explanations.map(item => ({
      id: item.id,
      errorMessage: item.errorMessage,
      fileName: item.fileName,
      lineNumber: item.lineNumber,
      errorType: item.errorType
    }))
  };
}

/**
 * Sends all detected errors together for batch processing.
 */
async function generateBatchExplanation(
  request: ExplanationRequest,
  targetLanguage: string
): Promise<PanelData> {
  const sortedErrors = sortErrorsByLine(request.errors);

  const result = await sendExplainAll({
    code: request.code,
    language: request.language,
    targetLanguage,
    errors: sortedErrors.map(item => ({
      id: item.id,
      error: item.errorMessage,
      lineNumber: item.lineNumber,
      errorType: item.errorType
    }))
  });

  return toPanelData(result, request, targetLanguage);
}

/**
 * Runs the explanation workflow and opens the result panel.
 */
async function explainDetectedErrors(
  request: ExplanationRequest,
  extensionUri: vscode.Uri
): Promise<void> {
  if (request.errors.length === 0) {
    vscode.window.showWarningMessage(
      'No errors were provided for explanation.'
    );
    return;
  }

  // English is the default explanation language; the panel supports
  // changing it after the first result is displayed.
  const targetLanguage = 'English';

  const sortedRequest: ExplanationRequest = {
    ...request,
    errors: sortErrorsByLine(request.errors)
  };

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Generating explanations for detected errors...',
        cancellable: false
      },
      async () => {
        const panelData = await generateBatchExplanation(
          sortedRequest,
          targetLanguage
        );

        let latestLanguage = targetLanguage;
        let latestLanguageRequestSequence = 0;

        const onLanguageChange = async (
          nextLanguage: string,
          requestId: string
        ): Promise<PanelData> => {
          if (
            !SUPPORTED_EXPLANATION_LANGUAGES.includes(nextLanguage)
          ) {
            throw new Error('Unsupported explanation language.');
          }

          const sequenceMatch = requestId.match(
            /-language-([1-9]\d*)$/
          );
          const requestSequence = sequenceMatch
            ? Number(sequenceMatch[1])
            : Number.NaN;

          if (
            !Number.isSafeInteger(requestSequence) ||
            requestSequence <= latestLanguageRequestSequence
          ) {
            throw new Error('This explanation request is no longer active.');
          }

          latestLanguageRequestSequence = requestSequence;

          const updated = await generateBatchExplanation(
            sortedRequest,
            nextLanguage
          );

          if (updated.targetLanguage !== nextLanguage) {
            throw new Error(
              'The explanation service returned data for a different language.'
            );
          }

          if (
            requestSequence === latestLanguageRequestSequence
          ) {
            latestLanguage = nextLanguage;
          }

          return updated;
        };

        console.log(
          '[Code Equalize] Batch explanation completed:',
          {
            detectedErrors: sortedRequest.errors.length,
            targetLanguage: latestLanguage
          }
        );

        showPanel(
          panelData,
          onLanguageChange,
          extensionUri,
          () => latestLanguage
        );
      }
    );
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : 'Something went wrong';

    console.error(
      '[Code Equalize] Explanation pipeline failed:',
      error
    );

    vscode.window.showErrorMessage(
      `Code Equalize failed: ${message}`
    );
  }
}

/**
 * Handles runtime errors received from the Debug Adapter observer.
 */
async function explainRuntimeError(
  error: RuntimeError,
  extensionUri: vscode.Uri
): Promise<void> {
  try {
    const errorMessage = error.message
      ? `${error.error}: ${error.message}`
      : error.error;

    const fileName = error.file
      ? error.file.split(/[\\/]/).pop()
      : undefined;

    const lineNumber =
      typeof error.line === 'number' && error.line > 0
        ? error.line - 1
        : undefined;

    const language =
      PROGRAMMING_LANGUAGE_MAP[error.language.toLowerCase()] ??
      error.language;

    const detected: DetectedError = {
      id: buildErrorId(
        errorMessage,
        lineNumber ?? 0,
        'runtime'
      ),
      errorMessage,
      fileName,
      lineNumber,
      errorType: 'runtime'
    };

    const sourceUri = error.file
      ? vscode.Uri.file(error.file)
      : undefined;
    const diagnostics = sourceUri
      ? vscode.languages.getDiagnostics(sourceUri)
      : [];
    const relatedErrors: DetectedError[] = diagnostics
      .filter(item =>
        item.severity === vscode.DiagnosticSeverity.Error ||
        item.severity === vscode.DiagnosticSeverity.Warning
      )
      .map(item => ({
        id: buildErrorId(item.message, item.range.start.line, 'diagnostic'),
        errorMessage: item.message,
        fileName,
        lineNumber: item.range.start.line,
        errorType: 'diagnostic'
      }));

    const errors = [
      ...relatedErrors.filter(item =>
        item.lineNumber !== detected.lineNumber ||
        item.errorMessage !== detected.errorMessage
      ),
      detected
    ];

    await explainDetectedErrors(
      {
        code: error.code,
        language,
        sourceLanguage: language,
        fileName,
        errors
      },
      extensionUri
    );
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : 'Something went wrong';

    console.error(
      '[Code Equalize] Runtime explanation error:',
      error
    );

    vscode.window.showErrorMessage(
      `Code Equalize failed: ${message}`
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

  registerRuntimeErrorObserver(
    context,
    (error: RuntimeError) =>
      explainRuntimeError(error, context.extensionUri)
  );

  const commandDisposable = vscode.commands.registerCommand(
    'code-equalize.explain',
    async () => {
      try {
        const activeDoc = vscode.window.activeTextEditor?.document;

        if (!activeDoc) {
          vscode.window.showWarningMessage(
            'Open a Java, Python, C, or C++ file before running Code Equalize.'
          );
          return;
        }

        const detectedLanguage = activeDoc.languageId.toLowerCase();

        const language =
          getSupportedProgrammingLanguage(detectedLanguage);

        if (!language) {
          vscode.window.showWarningMessage(
            `Code Equalize does not support the active source language "${activeDoc.languageId}" yet. Supported languages are Java, Python, C, and C++.`
          );
          return;
        }

        const extractedError = extractError();

        if (
          !extractedError ||
          extractedError.errors.length === 0
        ) {
          vscode.window.showWarningMessage(
            'No errors or potential issues were detected in this file.'
          );
          return;
        }

        const fileName = activeDoc.fileName.split(/[\\/]/).pop();

        const errors: DetectedError[] =
          extractedError.errors.map(item => ({
            id: item.id,
            errorMessage: item.errorMessage,
            fileName: item.fileName ?? fileName,
            lineNumber: item.lineNumber,
            errorType: item.errorType
          }));

        const sortedErrors = sortErrorsByLine(errors);

        console.log(
          '[Code Equalize] Extracted errors:',
          {
            count: sortedErrors.length,
            errors: sortedErrors
          }
        );

        await explainDetectedErrors(
          {
            code: extractedError.code,
            language,
            sourceLanguage: language,
            fileName,
            errors: sortedErrors
          },
          context.extensionUri
        );
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : 'Something went wrong';

        console.error(
          '[Code Equalize] Extension error:',
          error
        );

        vscode.window.showErrorMessage(
          `Code Equalize failed: ${message}`
        );
      }
    }
  );

  context.subscriptions.push(commandDisposable);
}

/**
 * Extension deactivation.
 */
export function deactivate(): void {
  console.log('[Code Equalize] Extension deactivated');
}
