// import * as vscode from 'vscode';
// import { extractError } from './errorExtractor';
// import { sendToBackend } from './apiService';
// import { showPanel } from './panelView';
// import { registerRuntimeErrorObserver, RuntimeError } from './runtimeErrorService';

// async function explainError(
//   error: { errorMessage: string; code: string; language: string },
//   errorType: 'diagnostic' | 'runtime'
// ): Promise<void> {
//   console.log('[Code Equalize] explainError entered', {
//     errorType,
//     language: error.language
//   });

//   const languageMap: Record<string, string> = {
//     java: 'Java',
//     python: 'Python',
//     c: 'C',
//     cpp: 'C++',
//     'c++': 'C++'
//   };

//   const language = languageMap[error.language.toLowerCase()] ?? error.language;

//   console.log('[Code Equalize] Showing explanation language picker');
//   const targetLanguage = await vscode.window.showQuickPick(
//     ['English', 'Hindi', 'Bengali', 'Marathi', 'Telugu', 'Tamil', 'Gujarati', 'Urdu', 'Kannada', 'Odia', 'Malayalam'],
//     {
//       placeHolder: 'Select explanation language',
//       ignoreFocusOut: true
//     }
//   );
//   console.log('[Code Equalize] Explanation language selected:', targetLanguage);
//   if (!targetLanguage) {
//     console.log('[Code Equalize] Explanation language selection cancelled');
//     return;
//   }
//   try {
//     await vscode.window.withProgress(
//       { location: vscode.ProgressLocation.Notification, title: 'Generating explanation...', cancellable: false },
//       async () => {
//         console.log('[Code Equalize] Sending runtime/diagnostic error to backend', {
//           errorType,
//           language,
//           targetLanguage
//         });
//         const result = await sendToBackend({ ...error, language, targetLanguage, errorType });
//         console.log('[Code Equalize] Backend explanation received', {
//           source: result?.source,
//           matchedError: result?.matchedError
//         });
//         console.log('[Code Equalize] Opening Code Equalize panel');
//         showPanel({ ...result, errorType });
//         console.log('[Code Equalize] Code Equalize panel opened');
//       }
//     );
//   } catch (error) {
//     console.error('[Code Equalize] Explanation pipeline failed:', error);
//     throw error;
//   }
// }

// async function explainRuntimeError(error: RuntimeError): Promise<void> {
//   console.log('[Code Equalize] Runtime exception received', {
//     language: error.language,
//     hasLocation: Boolean(error.file && error.line)
//   });
//   try {
//     const errorMessage = error.message ? `${error.error}: ${error.message}` : error.error;
//     console.log('[Code Equalize] Calling explainError for runtime error');
//     await explainError({ errorMessage, code: error.code, language: error.language }, 'runtime');
//   } catch (error) {
//     const message = error instanceof Error ? error.message : 'Something went wrong';
//     console.error('Runtime explanation error:', error);
//     vscode.window.showErrorMessage(`Code Equalize failed: ${message}`);
//   }
// }

// export function activate(context: vscode.ExtensionContext) {
//   registerRuntimeErrorObserver(context, explainRuntimeError);
//   const commandDisposable = vscode.commands.registerCommand(
//     'code-equalize.explain',
//     async () => {
//       try {
//         // 1. Extract error from active editor
//         const extractedError = extractError();

//         if (!extractedError) {
//           console.log(
//             '[Code Equalize] code-equalize.explain: no compiler diagnostics in active file'
//           );
//           vscode.window.showWarningMessage(
//             'No compiler errors in this file. Start a Java or Python debug session with Uncaught Exceptions enabled — Code Equalize will open the language picker when a runtime exception stops the debugger.'
//           );
//           return;
//         }

//         // 2. Validate supported languages
//         const supportedLanguages = ['java', 'python', 'c', 'cpp', 'c++'];

//         if (!supportedLanguages.includes(extractedError.language.toLowerCase())) {
//           vscode.window.showWarningMessage(
//             'Code Equalize currently supports Java, Python, C, and C++.'
//           );
//           return;
//         }

//         await explainError(extractedError, 'diagnostic');
//       } catch (error) {
//         const message =
//           error instanceof Error ? error.message : 'Something went wrong';

//         console.error('Extension error:', error);
//         vscode.window.showErrorMessage(
//           `Code Equalize failed: ${message}`
//         );
//       }
//     }
//   );

//   context.subscriptions.push(commandDisposable);
// }

// export function deactivate() {}


import * as vscode from 'vscode';
import { extractError } from './errorExtractor';
import { sendToBackend } from './apiService';
import { showPanel } from './panelView';
import { registerRuntimeErrorObserver, RuntimeError } from './runtimeErrorService';

async function explainError(
  error: { errorMessage: string; code: string; language: string; lineNumber?: number; fileName?: string },
  errorType: 'diagnostic' | 'runtime'
): Promise<void> {
  console.log('[Code Equalize] explainError entered', {
    errorType,
    language: error.language
  });

  const languageMap: Record<string, string> = {
    java: 'Java',
    python: 'Python',
    c: 'C',
    cpp: 'C++',
    'c++': 'C++'
  };

  const language = languageMap[error.language.toLowerCase()] ?? error.language;

  console.log('[Code Equalize] Showing explanation language picker');
  const targetLanguage = await vscode.window.showQuickPick(
    ['Kannada', 'Hindi', 'English'],
    {
      placeHolder: 'Select explanation language',
      ignoreFocusOut: true
    }
  );
  console.log('[Code Equalize] Explanation language selected:', targetLanguage);
  if (!targetLanguage) {
    console.log('[Code Equalize] Explanation language selection cancelled');
    return;
  }
  try {
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Generating explanation...', cancellable: false },
      async () => {
        console.log('[Code Equalize] Sending runtime/diagnostic error to backend', {
          errorType,
          language,
          targetLanguage
        });
        const result = await sendToBackend({ ...error, language, targetLanguage, errorType });
        console.log('[Code Equalize] Backend explanation received', {
          source: result?.source,
          matchedError: result?.matchedError
        });
        console.log('[Code Equalize] Opening Code Equalize panel');
        showPanel({
          ...result,
          errorType,
          fileName: error.fileName,
          lineNumber: error.lineNumber,
          targetLanguage
        });
        console.log('[Code Equalize] Code Equalize panel opened');
      }
    );
  } catch (error) {
    console.error('[Code Equalize] Explanation pipeline failed:', error);
    throw error;
  }
}

async function explainRuntimeError(error: RuntimeError): Promise<void> {
  console.log('[Code Equalize] Runtime exception received', {
    language: error.language,
    hasLocation: Boolean(error.file && error.line)
  });
  try {
    const errorMessage = error.message ? `${error.error}: ${error.message}` : error.error;
    const fileName = error.file ? error.file.split(/[\\/]/).pop() : undefined;
    console.log('[Code Equalize] Calling explainError for runtime error');
    await explainError({
      errorMessage, code: error.code, language: error.language,
      lineNumber: error.line ? error.line - 1 : undefined,
      fileName
    }, 'runtime');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong';
    console.error('Runtime explanation error:', error);
    vscode.window.showErrorMessage(`Code Equalize failed: ${message}`);
  }
}

export function activate(context: vscode.ExtensionContext) {
  registerRuntimeErrorObserver(context, explainRuntimeError);
  const commandDisposable = vscode.commands.registerCommand(
    'code-equalize.explain',
    async () => {
      try {
        // 1. Extract error from active editor
        const extractedError = extractError();

        if (!extractedError) {
          console.log(
            '[Code Equalize] code-equalize.explain: no compiler diagnostics in active file'
          );
          vscode.window.showWarningMessage(
            'No compiler errors in this file. Start a Java or Python debug session with Uncaught Exceptions enabled — Code Equalize will open the language picker when a runtime exception stops the debugger.'
          );
          return;
        }

        // 2. Validate supported languages
        const supportedLanguages = ['java', 'python', 'c', 'cpp', 'c++'];

        if (!supportedLanguages.includes(extractedError.language.toLowerCase())) {
          vscode.window.showWarningMessage(
            'Code Equalize currently supports Java, Python, C, and C++.'
          );
          return;
        }

        // Pass fileName from the active document
        const activeDoc = vscode.window.activeTextEditor?.document;
        const enrichedError = {
          ...extractedError,
          fileName: activeDoc ? activeDoc.fileName.split(/[\\/]/).pop() : undefined,
        };
        await explainError(enrichedError, 'diagnostic');
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Something went wrong';

        console.error('Extension error:', error);
        vscode.window.showErrorMessage(
          `Code Equalize failed: ${message}`
        );
      }
    }
  );

  context.subscriptions.push(commandDisposable);
}

export function deactivate() {}