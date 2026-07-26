import * as vscode from "vscode";

type PanelData = {
  explanation: string;
  fix: string;
  source: "AI" | "ChromaDB" | string;
  matchedError?: string;
  similarity?: number | null;
};

export function showPanel(data: PanelData): void {
  const panel = vscode.window.createWebviewPanel(
    "codeEqualize",
    "Code Equalize",
    vscode.ViewColumn.Beside,
    {
      enableScripts: false,
    }
  );

  panel.webview.html = getWebviewContent(data);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderMarkdown(text: string): string {
  if (!text) return "";

  const escaped = escapeHtml(text);

  return escaped
    .replace(
      /```[\w]*\n?([\s\S]*?)```/g,
      "<pre><code>$1</code></pre>"
    )
    .replace(/\n/g, "<br>");
}

function getWebviewContent(data: PanelData): string {
  const isChroma = data.source === "ChromaDB";

  const badgeColor = isChroma ? "#27C93F" : "#007ACC";

  const badgeLabel = isChroma
    ? "📚 ChromaDB"
    : "🤖 AI Generated";

  const similarityHtml =
    isChroma &&
    data.similarity !== null &&
    data.similarity !== undefined
      ? `
      <div class="similarity">
        <div><strong>🎯 Matched Error:</strong> ${
          data.matchedError || "Similar Error"
        }</div>
        <div><strong>📈 Confidence:</strong> ${data.similarity}%</div>
      </div>
      `
      : "";

  return `
<!DOCTYPE html>
<html lang="en">

<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<style>

body{
    font-family:var(--vscode-font-family);
    background:var(--vscode-editor-background);
    color:var(--vscode-editor-foreground);
    padding:20px;
    line-height:1.7;
    font-size:14px;
}

h1{
    font-size:24px;
    margin-bottom:18px;
    font-weight:700;
}

h2{
    margin-top:20px;
    margin-bottom:8px;
    font-size:13px;
    letter-spacing:.08em;
    text-transform:uppercase;
    opacity:.65;
}

.badge{
    display:inline-block;
    padding:6px 14px;
    border-radius:999px;
    background:${badgeColor}22;
    color:${badgeColor};
    border:1px solid ${badgeColor}55;
    font-size:12px;
    font-weight:600;
    margin-bottom:14px;
}

.similarity{
    margin-bottom:18px;
    padding:10px 14px;
    border-left:4px solid ${badgeColor};
    background:rgba(255,255,255,.05);
    border-radius:6px;
    font-size:13px;
}

.card{
    background:rgba(255,255,255,.03);
    border:1px solid rgba(255,255,255,.08);
    border-radius:10px;
    padding:16px;
    margin-bottom:18px;
}

pre{
    background:rgba(255,255,255,.06);
    padding:12px;
    border-radius:8px;
    overflow-x:auto;
}

code{
    font-family:var(--vscode-editor-font-family);
    font-size:13px;
}

.divider{
    height:1px;
    background:rgba(255,255,255,.08);
    margin:18px 0;
}

.footer{
    margin-top:25px;
    text-align:center;
    opacity:.45;
    font-size:11px;
}

</style>

</head>

<body>

<h1>Code Equalize</h1>

<div class="badge">
${badgeLabel}
</div>

${similarityHtml}

<div class="divider"></div>

<h2>Error Explanation</h2>

<div class="card">
${renderMarkdown(data.explanation)}
</div>

<h2>Suggested Fix</h2>

<div class="card">
${renderMarkdown(data.fix)}
</div>

<div class="footer">
Powered by ChromaDB + Groq AI
</div>

</body>

</html>
`;
}