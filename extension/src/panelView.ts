import * as vscode from "vscode";

type PanelData = {
  explanation: string;
  fix: string;
  source: "AI" | "ChromaDB" | string;
};

/**
 * Opens the Code Equalize result panel.
 */
export function showPanel(data: PanelData): void {
  const panel = vscode.window.createWebviewPanel(
    "codeEqualize",
    "Code Equalize",
    vscode.ViewColumn.Beside,
    { enableScripts: false },
  );

  panel.webview.html = getWebviewContent(data);
}

/**
 * Builds static HTML content for the webview panel.
 */
function getWebviewContent(data: PanelData): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Code Equalize</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            color: var(--vscode-editor-foreground);
            background-color: var(--vscode-editor-background);
            line-height: 1.5;
          }
          h1 {
            margin: 0 0 12px 0;
          }
          h2 {
            margin: 20px 0 8px 0;
            font-size: 18px;
          }
          p {
            margin: 0;
            white-space: pre-wrap;
          }
          .badge {
            display: inline-block;
            margin-bottom: 12px;
            padding: 4px 10px;
            border-radius: 999px;
            background: #e5e7eb;
            font-size: 12px;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <h1>Code Equalize</h1>
        <div class="badge">Source: ${data.source}</div>

        <h2>Error Explanation</h2>
        <p>${data.explanation}</p>

        <h2>Fix</h2>
        <p>${data.fix}</p>
      </body>
    </html>
  `;
}
