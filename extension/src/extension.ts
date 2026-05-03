import * as vscode from 'vscode';
import { extractError } from './errorExtractor';
import { sendToBackend } from './apiService';
import { showPanel } from './panelView';

export function activate(context: vscode.ExtensionContext) {
  const commandDisposable = vscode.commands.registerCommand(
    'code-equalize.explain',
    async () => {
      try {
        // 1. Extract error from active editor
        const extractedError = extractError();

        if (!extractedError) {
          vscode.window.showWarningMessage('No errors found in active file');
          return;
        }

        // 2. Validate supported languages
        if (
          extractedError.language !== 'java' &&
          extractedError.language !== 'python'
        ) {
          vscode.window.showWarningMessage(
            'Currently only Java and Python are supported'
          );
          return;
        }

        // Normalize language for backend
        const normalizedLang =
          extractedError.language === 'java'
            ? 'Java'
            : extractedError.language === 'python'
            ? 'Python'
            : extractedError.language;

        // 3. Ask user for target language
        const targetLanguage = await vscode.window.showQuickPick(
          ['Kannada', 'Hindi'],
          {
            placeHolder: 'Select explanation language'
          }
        );

        if (!targetLanguage) {
          return;
        }

        // 4. Show loading while calling backend
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Generating explanation...',
            cancellable: false
          },
          async () => {
            // 5. Call backend
            const result = await sendToBackend({
              errorMessage: extractedError.errorMessage,
              code: extractedError.code,
              language: normalizedLang,
              targetLanguage
            });

            // 6. Show result in panel
            showPanel(result);
          }
        );
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