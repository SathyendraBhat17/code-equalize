
// import * as vscode from 'vscode';
// import { extractError } from './errorExtractor';
// import { sendToBackend } from './apiService';
// import { showPanel } from './panelView';
// import {
//   registerRuntimeErrorObserver,
//   RuntimeError
// } from './runtimeErrorService';

// // All 11 supported explanation languages
// const SUPPORTED_EXPLANATION_LANGUAGES = [
//   'English',
//   'Hindi',
//   'Bengali',
//   'Marathi',
//   'Telugu',
//   'Tamil',
//   'Gujarati',
//   'Urdu',
//   'Kannada',
//   'Odia',
//   'Malayalam'
// ];

// // Normalize programming language names
// const PROGRAMMING_LANGUAGE_MAP: Record<string, string> = {
//   java: 'Java',
//   python: 'Python',
//   c: 'C',
//   cpp: 'C++',
//   'c++': 'C++'
// };

// // Generate an explanation for a diagnostic or runtime error
// async function explainError(
//   error: {
//     errorMessage: string;
//     code: string;
//     language: string;
//     lineNumber?: number;
//     fileName?: string;
//   },
//   errorType: 'diagnostic' | 'runtime',
//   extensionUri: vscode.Uri
// ): Promise<void> {

//   console.log('[Code Equalize] explainError entered', {
//     errorType,
//     language: error.language
//   });

//   const language =
//     PROGRAMMING_LANGUAGE_MAP[error.language.toLowerCase()] ??
//     error.language;

//   console.log('[Code Equalize] Showing explanation language picker');

//   const targetLanguage = await vscode.window.showQuickPick(
//     SUPPORTED_EXPLANATION_LANGUAGES,
//     {
//       placeHolder: 'Select explanation language',
//       ignoreFocusOut: true
//     }
//   );

//   console.log(
//     '[Code Equalize] Explanation language selected:',
//     targetLanguage
//   );

//   if (!targetLanguage) {
//     console.log(
//       '[Code Equalize] Explanation language selection cancelled'
//     );
//     return;
//   }

//   try {
//     await vscode.window.withProgress(
//       {
//         location: vscode.ProgressLocation.Notification,
//         title: 'Generating explanation...',
//         cancellable: false
//       },
//       async () => {

//         console.log(
//           '[Code Equalize] Sending runtime/diagnostic error to backend',
//           {
//             errorType,
//             language,
//             targetLanguage
//           }
//         );

//         const result = await sendToBackend({
//           ...error,
//           language,
//           targetLanguage,
//           errorType
//         });

//         console.log('[Code Equalize] Backend explanation received', {
//           source: result?.source,
//           matchedError: result?.matchedError
//         });

//         console.log('[Code Equalize] Opening Code Equalize panel');

//         showPanel(
//           {
//             ...result,
//             errorType,
//             fileName: error.fileName,
//             lineNumber: error.lineNumber,
//             targetLanguage
//           },
//           extensionUri
//         );

//         console.log('[Code Equalize] Code Equalize panel opened');
//       }
//     );

//   } catch (error) {
//     console.error(
//       '[Code Equalize] Explanation pipeline failed:',
//       error
//     );
//     throw error;
//   }
// }

// // Handle runtime exceptions
// async function explainRuntimeError(
//   error: RuntimeError,
//   extensionUri: vscode.Uri
// ): Promise<void> {

//   console.log('[Code Equalize] Runtime exception received', {
//     language: error.language,
//     hasLocation: Boolean(error.file && error.line)
//   });

//   try {
//     const errorMessage = error.message
//       ? `${error.error}: ${error.message}`
//       : error.error;

//     const fileName = error.file
//       ? error.file.split(/[\\/]/).pop()
//       : undefined;

//     console.log(
//       '[Code Equalize] Calling explainError for runtime error'
//     );

//     await explainError(
//       {
//         errorMessage,
//         code: error.code,
//         language: error.language,
//         lineNumber: error.line
//           ? error.line - 1
//           : undefined,
//         fileName
//       },
//       'runtime',
//       extensionUri
//     );

//   } catch (error) {
//     const message =
//       error instanceof Error
//         ? error.message
//         : 'Something went wrong';

//     console.error('Runtime explanation error:', error);

//     vscode.window.showErrorMessage(
//       `Code Equalize failed: ${message}`
//     );
//   }
// }

// // Extension activation
// export function activate(context: vscode.ExtensionContext) {

//   console.log('[Code Equalize] Extension activated');

//   // Register runtime error observer with extension URI
//   registerRuntimeErrorObserver(
//     context,
//     (error: RuntimeError) =>
//       explainRuntimeError(error, context.extensionUri)
//   );

//   // Register the Explain Error command
//   const commandDisposable = vscode.commands.registerCommand(
//     'code-equalize.explain',
//     async () => {

//       try {
//         // 1. Extract error from active editor
//         const extractedError = extractError();

//         if (!extractedError) {
//           console.log(
//             '[Code Equalize] No compiler diagnostics in active file'
//           );

//           vscode.window.showWarningMessage(
//             'No compiler errors in this file. Start a Java or Python debug session with Uncaught Exceptions enabled — Code Equalize will open the language picker when a runtime exception stops the debugger.'
//           );

//           return;
//         }

//         // 2. Validate supported programming languages
//         const supportedLanguages = [
//           'java',
//           'python',
//           'c',
//           'cpp',
//           'c++'
//         ];

//         if (
//           !supportedLanguages.includes(
//             extractedError.language.toLowerCase()
//           )
//         ) {
//           vscode.window.showWarningMessage(
//             'Code Equalize currently supports Java, Python, C, and C++.'
//           );
//           return;
//         }

//         // 3. Get active document information
//         const activeDoc =
//           vscode.window.activeTextEditor?.document;

//         const enrichedError = {
//           ...extractedError,
//           fileName: activeDoc
//             ? activeDoc.fileName.split(/[\\/]/).pop()
//             : undefined
//         };

//         // 4. Generate explanation
//         await explainError(
//           enrichedError,
//           'diagnostic',
//           context.extensionUri
//         );

//       } catch (error) {
//         const message =
//           error instanceof Error
//             ? error.message
//             : 'Something went wrong';

//         console.error('[Code Equalize] Extension error:', error);

//         vscode.window.showErrorMessage(
//           `Code Equalize failed: ${message}`
//         );
//       }
//     }
//   );

//   context.subscriptions.push(commandDisposable);
// }

// // Extension deactivation
// export function deactivate() {
//   console.log('[Code Equalize] Extension deactivated');
// }



import * as vscode from 'vscode';

import { extractError } from './errorExtractor';
import { sendToBackend } from './apiService';
import { showPanel, PanelData } from './panelView';

import {
  registerRuntimeErrorObserver,
  RuntimeError
} from './runtimeErrorService';

// All 11 supported explanation languages
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

// Normalize programming language names
const PROGRAMMING_LANGUAGE_MAP: Record<string, string> = {
  java: 'Java',
  python: 'Python',
  c: 'C',
  cpp: 'C++',
  'c++': 'C++'
};

type ExplanationError = {
  errorMessage: string;
  code: string;
  language: string;
  lineNumber?: number;
  fileName?: string;
};

// Generate an explanation for a diagnostic or runtime error
async function explainError(
  error: ExplanationError,
  errorType: 'diagnostic' | 'runtime',
  extensionUri: vscode.Uri
): Promise<void> {

  const language =
    PROGRAMMING_LANGUAGE_MAP[error.language.toLowerCase()] ??
    error.language;

  const targetLanguage = await vscode.window.showQuickPick(
    SUPPORTED_EXPLANATION_LANGUAGES,
    {
      placeHolder: 'Select explanation language',
      ignoreFocusOut: true
    }
  );

  if (!targetLanguage) {
    return;
  }

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Generating explanation...',
        cancellable: false
      },
      async () => {

        // Generate the initial explanation
        const result = await sendToBackend({
          errorMessage: error.errorMessage,
          code: error.code,
          language,
          targetLanguage,
          errorType
        });

        const initialData: PanelData = {
          ...result,
          errorType,
          fileName: error.fileName,
          lineNumber: error.lineNumber,
          targetLanguage
        };

        // Regenerate explanation when the panel language changes
        const onLanguageChange = async (
          nextLanguage: string
        ): Promise<PanelData> => {

          if (!SUPPORTED_EXPLANATION_LANGUAGES.includes(nextLanguage)) {
            throw new Error('Unsupported explanation language.');
          }

          const updatedResult = await sendToBackend({
            errorMessage: error.errorMessage,
            code: error.code,
            language,
            targetLanguage: nextLanguage,
            errorType
          });

          return {
            ...updatedResult,
            errorType,
            fileName: error.fileName,
            lineNumber: error.lineNumber,
            targetLanguage: nextLanguage
          };
        };

        // Open the panel with its language-change handler and extension URI
        showPanel(
          initialData,
          onLanguageChange,
          extensionUri
        );
      }
    );

  } catch (error) {
    const message =
      error instanceof Error
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

// Handle runtime exceptions
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

    await explainError(
      {
        errorMessage,
        code: error.code,
        language: error.language,
        lineNumber: error.line
          ? error.line - 1
          : undefined,
        fileName
      },
      'runtime',
      extensionUri
    );

  } catch (error) {
    const message =
      error instanceof Error
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

// Extension activation
export function activate(context: vscode.ExtensionContext): void {

  console.log('[Code Equalize] Extension activated');

  // Register runtime error observer
  registerRuntimeErrorObserver(
    context,
    (error: RuntimeError) =>
      explainRuntimeError(error, context.extensionUri)
  );

  // Register Explain Error command
  const commandDisposable = vscode.commands.registerCommand(
    'code-equalize.explain',
    async () => {

      try {
        // Extract error from active editor
        const extractedError = extractError();

        if (!extractedError) {
          vscode.window.showWarningMessage(
            'No compiler errors in this file. Start a Java or Python debug session with Uncaught Exceptions enabled — Code Equalize will open the language picker when a runtime exception stops the debugger.'
          );

          return;
        }

        // Validate supported programming languages
        const supportedLanguages = [
          'java',
          'python',
          'c',
          'cpp',
          'c++'
        ];

        if (
          !supportedLanguages.includes(
            extractedError.language.toLowerCase()
          )
        ) {
          vscode.window.showWarningMessage(
            'Code Equalize currently supports Java, Python, C, and C++.'
          );

          return;
        }

        // Get active document information
        const activeDoc =
          vscode.window.activeTextEditor?.document;

        const enrichedError: ExplanationError = {
          ...extractedError,
          fileName: activeDoc
            ? activeDoc.fileName.split(/[\\/]/).pop()
            : undefined
        };

        // Generate explanation
        await explainError(
          enrichedError,
          'diagnostic',
          context.extensionUri
        );

      } catch (error) {
        const message =
          error instanceof Error
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

// Extension deactivation
export function deactivate(): void {
  console.log('[Code Equalize] Extension deactivated');
}
