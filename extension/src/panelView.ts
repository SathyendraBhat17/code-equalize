import * as vscode from 'vscode';

export type PanelErrorType =
  | 'diagnostic'
  | 'runtime'
  | 'potential';

export interface PanelError {
  id?: string;
  errorMessage: string;
  fileName?: string;
  lineNumber?: number;
  errorType?: PanelErrorType;
}

export interface PanelExplanation extends PanelError {
  id: string;
  explanation: string;
  source?: string;
  matchedError?: string;
  distance?: number | null;
  failureMessage?: string;
}

export interface PanelData {
  explanations: PanelExplanation[];
  fix: string;
  remember: string;
  source?: string;
  fileName?: string;
  targetLanguage: string;
  sourceLanguage: string;
  errors?: PanelError[];
}

type LanguageChangeHandler = (
  language: string,
  requestId: string
) => Promise<PanelData>;

let currentPanel: vscode.WebviewPanel | undefined;
let messageListener: vscode.Disposable | undefined;
let panelSessionSequence = 0;

const SUPPORTED_LANGUAGES = [
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

/**
 * Escapes dynamic values before inserting them into HTML.
 */
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value);
}

function isValidPanelErrorType(
  value: unknown
): value is PanelErrorType | undefined {
  return (
    value === undefined ||
    value === 'diagnostic' ||
    value === 'runtime' ||
    value === 'potential'
  );
}

function isValidLineNumber(
  value: unknown
): value is number | undefined {
  return value === undefined ||
    (
      typeof value === 'number' &&
      Number.isFinite(value) &&
      Number.isInteger(value) &&
      value >= 0
    );
}

function isValidPanelError(value: unknown): value is PanelError {
  return isRecord(value) &&
    typeof value.errorMessage === 'string' &&
    (value.id === undefined || typeof value.id === 'string') &&
    (value.fileName === undefined || typeof value.fileName === 'string') &&
    isValidLineNumber(value.lineNumber) &&
    isValidPanelErrorType(value.errorType);
}

function isValidPanelExplanation(
  value: unknown
): value is PanelExplanation {
  return isRecord(value) &&
    isValidPanelError(value) &&
    typeof value.id === 'string' &&
    value.id.trim().length > 0 &&
    typeof value.explanation === 'string' &&
    (value.source === undefined || typeof value.source === 'string') &&
    (value.matchedError === undefined ||
      typeof value.matchedError === 'string') &&
    (value.distance === undefined ||
      value.distance === null ||
      (typeof value.distance === 'number' &&
        Number.isFinite(value.distance))) &&
    (value.failureMessage === undefined ||
      typeof value.failureMessage === 'string');
}

function isValidPanelData(value: unknown): value is PanelData {
  return isRecord(value) &&
    typeof value.targetLanguage === 'string' &&
    SUPPORTED_LANGUAGES.includes(value.targetLanguage) &&
    typeof value.sourceLanguage === 'string' &&
    Array.isArray(value.explanations) &&
    value.explanations.every(isValidPanelExplanation) &&
    typeof value.fix === 'string' &&
    typeof value.remember === 'string' &&
    (value.source === undefined || typeof value.source === 'string') &&
    (value.fileName === undefined || typeof value.fileName === 'string') &&
    (value.errors === undefined ||
      (Array.isArray(value.errors) &&
        value.errors.every(isValidPanelError)));
}

function getInvalidPanelHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  nonce: string
): string {
  const logo = webview.asWebviewUri(
    vscode.Uri.joinPath(
      extensionUri,
      'media',
      'code-equalize-logo.png'
    )
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta
  http-equiv="Content-Security-Policy"
  content="
    default-src 'none';
    img-src ${webview.cspSource} data:;
    style-src 'nonce-${nonce}';
    script-src 'nonce-${nonce}';
  "
>
<title>Code Equalize</title>
<style nonce="${nonce}">
body {
  margin: 0;
  padding: 22px 24px;
  background: var(--vscode-editor-background);
  color: var(--vscode-foreground);
  font-family: var(--vscode-font-family);
  font-size: 13px;
}

main {
  max-width: 700px;
  margin: 0 auto;
  padding: 18px;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  background: var(--vscode-sideBar-background);
}

header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

img {
  width: 40px;
  height: 40px;
  object-fit: contain;
}
</style>
</head>
<body>
<main>
  <header>
    <img src="${logo}" alt="Code Equalize logo">
    <h1>Code Equalize</h1>
  </header>
  <p role="alert">Unable to display this panel because its data is invalid.</p>
</main>
</body>
</html>`;
}

function renderMarkdownHtml(value: unknown): string {
  const escaped = escapeHtml(value);
  const fence = String.fromCharCode(96).repeat(3);
  const blocks = escaped.split(fence);

  return blocks.map((block, index) => {
    // Fenced code blocks
    if (index % 2 === 1) {
      const hasInfoString = !/^\r?\n/.test(block);
      const lines = block
        .replace(/^\r?\n|\r?\n$/g, '')
        .split(/\r?\n/);
      const infoString = hasInfoString
        ? lines[0]?.trim() || ''
        : '';
      const infoMatch = infoString.match(
        /^(?:\{\.([^\s}]+)(?:\s[^}]*)?\}|([^\s]+))/
      );
      const language = (infoMatch?.[1] || infoMatch?.[2] || '')
        .replace(/^(?:language|lang)-/i, '')
        .replace(/^\./, '')
        .toLowerCase();

      const supportedCodeLanguages = new Set([
        'python', 'py',
        'javascript', 'js',
        'typescript', 'ts',
        'java',
        'c', 'cpp', 'c++',
        'csharp', 'cs',
        'html', 'css',
        'json',
        'bash', 'shell',
        'sql',
        'text', 'plaintext'
      ]);

      const hasLanguage = supportedCodeLanguages.has(language);
      const code = (hasLanguage ? lines.slice(1) : lines).join('\n');

      return `<pre class="markdown-code"><code>${code}</code></pre>`;
    }

    const inlineCode: string[] = [];
    let placeholderPrefix = '\u0000CE_INLINE_CODE_';

    while (block.includes(placeholderPrefix)) {
      placeholderPrefix += '_';
    }

    const renderInline = (value: string): string => {
      let html = value.replace(/`([^`\n]+)`/g, (_, code) => {
        const placeholder =
          `${placeholderPrefix}${inlineCode.length}\u0000`;
        inlineCode.push(
          `<code class="markdown-inline-code">${code}</code>`
        );
        return placeholder;
      });

      html = html
        .replace(
          /(^|[^\w*])\*\*(\S(?:.*?\S)?)\*\*(?![\w*])/g,
          '$1<strong>$2</strong>'
        )
        .replace(
          /(^|[\W])__(\S(?:.*?\S)?)__(?![\w_])/g,
          '$1<strong>$2</strong>'
        )
        .replace(
          /(^|[^\w*])\*(\S(?:[^*\n]*?\S)?)\*(?![\w*])/g,
          '$1<em>$2</em>'
        )
        .replace(
          /(^|[\W])_(\S(?:[^_\n]*?\S)?)_(?![\w_])/g,
          '$1<em>$2</em>'
        );

      inlineCode.forEach((code, codeIndex) => {
        html = html.replace(
          `${placeholderPrefix}${codeIndex}\u0000`,
          code
        );
      });

      return html;
    };

    const lines = block.split(/\r?\n/);
    const renderedBlocks: string[] = [];
    let paragraphLines: string[] = [];
    let listTag: 'ul' | 'ol' | undefined;
    let listItems: string[] = [];

    const flushParagraph = (): void => {
      if (paragraphLines.length === 0) {
        return;
      }

      renderedBlocks.push(
        `<p>${renderInline(paragraphLines.join('\n')).replace(/\n/g, '<br>')}</p>`
      );
      paragraphLines = [];
    };

    const flushList = (): void => {
      if (!listTag || listItems.length === 0) {
        return;
      }

      renderedBlocks.push(
        `<${listTag}>${listItems.map(item => `<li>${renderInline(item)}</li>`).join('')}</${listTag}>`
      );
      listTag = undefined;
      listItems = [];
    };

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        flushParagraph();
        flushList();
        continue;
      }

      const heading = trimmed.match(
        /^(#{1,3})\s+(.+?)(?:\s+#+\s*)?$/
      );

      if (heading) {
        flushParagraph();
        flushList();

        const level = heading[1].length + 1;
        renderedBlocks.push(
          `<h${level}>${renderInline(heading[2])}</h${level}>`
        );
        continue;
      }

      const bullet = trimmed.match(/^[-*]\s+(.+)$/);
      const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);
      const item = bullet || numbered;

      if (item) {
        flushParagraph();

        const nextListTag = bullet ? 'ul' : 'ol';

        if (listTag && listTag !== nextListTag) {
          flushList();
        }

        listTag = nextListTag;
        listItems.push(item[1]);
        continue;
      }

      flushList();
      paragraphLines.push(trimmed);
    }

    flushParagraph();
    flushList();

    return renderedBlocks.join('');
  }).join('');
}


/**
 * Generates a secure nonce for the webview CSP.
 */
function getNonce(): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  return Array.from(
    { length: 32 },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

/**
 * Sorts errors by their original zero-based source line.
 * Errors without a line number appear last.
 */
function sortByLine<T extends PanelError>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const lineA =
      typeof a.lineNumber === 'number' &&
      isValidLineNumber(a.lineNumber)
        ? a.lineNumber
        : Number.MAX_SAFE_INTEGER;

    const lineB =
      typeof b.lineNumber === 'number' &&
      isValidLineNumber(b.lineNumber)
        ? b.lineNumber
        : Number.MAX_SAFE_INTEGER;

    return lineA - lineB;
  });
}

/**
 * Returns the complete detected-error list.
 */
function getErrors(data: PanelData): PanelError[] {
  if (data.errors?.length) {
    return sortByLine(data.errors);
  }

  return sortByLine(data.explanations);
}

function getErrorTypeLabel(type?: string): string {
  switch (type) {
    case 'runtime':
      return 'Runtime Error';

    case 'potential':
      return 'Potential Issue';

    default:
      return 'Diagnostic Error';
  }
}

function getErrorTypeTooltip(type?: string): string {
  switch (type) {
    case 'runtime':
      return 'Runtime Error: An error reported by the debugger while the program was executing.';

    case 'potential':
      return 'Potential Issue: A high-confidence static concern that may cause a runtime problem.';

    default:
      return 'Diagnostic Error: An issue reported by a language analyzer, compiler, or editor diagnostic provider.';
  }
}

function getCombinedErrorType(errors: PanelError[]): string {
  const types = new Set(
    errors.map(error => error.errorType || 'diagnostic')
  );

  const labels: string[] = [];

  if (types.has('runtime')) {
    labels.push('Runtime');
  }

  if (types.has('diagnostic')) {
    labels.push('Diagnostic');
  }

  if (types.has('potential')) {
    labels.push('Potential');
  }

  if (labels.length === 0) {
    return 'Diagnostic Error';
  }

  if (labels.length === 1) {
    return labels[0] === 'Potential'
      ? 'Potential Issue'
      : `${labels[0]} Error`;
  }

  return `${labels.join(' & ')} Errors`;
}

function getCombinedErrorTooltip(errors: PanelError[]): string {
  const types = new Set(
    errors.map(error => error.errorType || 'diagnostic')
  );

  const descriptions: string[] = [];

  if (types.has('runtime')) {
    descriptions.push(getErrorTypeTooltip('runtime'));
  }

  if (types.has('diagnostic')) {
    descriptions.push(getErrorTypeTooltip('diagnostic'));
  }

  if (types.has('potential')) {
    descriptions.push(getErrorTypeTooltip('potential'));
  }

  return descriptions.join('\n\n');
}


function getSourceTooltip(source?: string): string {
  const normalizedSource = source?.toLowerCase();

  if (normalizedSource === 'mixed') {
    return (
      'Mixed: Some errors had accepted matching examples from ChromaDB, ' +
      'while others required AI generation. Groq generated the current ' +
      'explanations and consolidated fix.'
    );
  }

  if (normalizedSource === 'chromadb') {
    return (
      'ChromaDB: Similar programming-error examples were retrieved ' +
      'from the knowledge base as supporting context. Groq generated ' +
      'the current explanations and consolidated fix.'
    );
  }

  if (normalizedSource === 'ai') {
    return (
      'AI: Groq generated this response without accepted matching ' +
      'examples from the ChromaDB knowledge base.'
    );
  }

  return 'Explanation source information is unavailable.';
}


/**
 * Renders the detected-error table.
 */
function renderErrorRows(data: PanelData): string {
  return getErrors(data).map((error, index) => `
    <tr class="error-row">
      <td class="index-cell">${index + 1}</td>

      <td class="line-cell">
        ${
          typeof error.lineNumber === 'number' &&
          isValidLineNumber(error.lineNumber)
            ? error.lineNumber + 1
            : '—'
        }
      </td>

      <td>
        <span
          class="error-badge"
          title="${escapeHtml(
            getErrorTypeTooltip(error.errorType)
          )}"
        >
          ${escapeHtml(getErrorTypeLabel(error.errorType))}
        </span>
      </td>

      <td class="error-message">
        ${escapeHtml(error.errorMessage)}
      </td>

      <td class="file-cell">
        ${escapeHtml(
          error.fileName || data.fileName || '—'
        )}
      </td>
    </tr>
  `).join('');
}

/**
 * Renders each error explanation separately.
 */
function renderExplanationCards(data: PanelData): string {
  const ordered = [...data.explanations].sort((a, b) => {
    const lineA =
      typeof a.lineNumber === 'number' &&
      isValidLineNumber(a.lineNumber)
        ? a.lineNumber
        : Number.MAX_SAFE_INTEGER;
    const lineB =
      typeof b.lineNumber === 'number' &&
      isValidLineNumber(b.lineNumber)
        ? b.lineNumber
        : Number.MAX_SAFE_INTEGER;

    return lineA - lineB;
  });

  return ordered.map((item, index) => `
    <article
      class="explanation-card-block"
      data-explanation-id="${escapeHtml(item.id)}"
    >
      <div class="explanation-card-header">

        <div class="explanation-card-title">

          <span class="explanation-index">
            Error ${index + 1}
          </span>

          <span
            class="error-badge"
            title="${escapeHtml(
              getErrorTypeTooltip(item.errorType)
            )}"
          >
            ${escapeHtml(
              getErrorTypeLabel(item.errorType)
            )}
          </span>

          <span class="explanation-line">
            Line ${
              typeof item.lineNumber === 'number' &&
              isValidLineNumber(item.lineNumber)
                ? item.lineNumber + 1
                : '—'
            }
          </span>

          ${
            item.source
              ? `<span class="individual-source">
                  ${escapeHtml(item.source)}
                </span>`
              : ''
          }

        </div>

        <div class="matched-error">
          ${escapeHtml(
            item.matchedError || item.errorMessage
          )}
        </div>

      </div>

      <div class="content-card explanation-card">
  <div class="explanation-text">
    ${renderMarkdownHtml(
      item.failureMessage
        ? `Explanation unavailable: ${item.failureMessage}`
        : item.explanation
    )}
  </div>
</div>

    </article>
  `).join('');
}

/**
 * Builds the complete VS Code webview HTML.
 */
function getHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  data: PanelData,
  nonce: string
): string {
  if (!isValidPanelData(data)) {
    return getInvalidPanelHtml(webview, extensionUri, nonce);
  }

  const logo = webview.asWebviewUri(
    vscode.Uri.joinPath(
      extensionUri,
      'media',
      'code-equalize-logo.png'
    )
  );

  const loader = webview.asWebviewUri(
    vscode.Uri.joinPath(
      extensionUri,
      'media',
      'code-equalize-loader.png'
    )
  );

  const languageOptions = SUPPORTED_LANGUAGES.map(language => `
    <option
      value="${escapeHtml(language)}"
      ${language === data.targetLanguage ? 'selected' : ''}
    >
      ${escapeHtml(language)}
    </option>
  `).join('');

  const detectedErrors = getErrors(data);
  const errors = renderErrorRows(data);
  const explanationCards = renderExplanationCards(data);

  const errorCount = detectedErrors.length;

  const sourceLabel =
  data.source?.toLowerCase() === 'mixed'
    ? 'Mixed'
    : data.source?.toLowerCase() === 'chromadb'
      ? 'ChromaDB'
      : data.source || 'Backend';

  const combinedErrorType =
    getCombinedErrorType(detectedErrors);

  const combinedErrorTooltip =
    getCombinedErrorTooltip(detectedErrors);

  const sourceTooltip =
    getSourceTooltip(data.source);

  const cspSource = webview.cspSource;

  return `<!DOCTYPE html>
<html lang="en">

<head>
<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<meta
  http-equiv="Content-Security-Policy"
  content="
    default-src 'none';
    img-src ${cspSource} data:;
    style-src 'nonce-${nonce}';
    script-src 'nonce-${nonce}';
  "
>

<title>Code Equalize</title>

<style nonce="${nonce}">

:root {
  color-scheme: dark;

  --background: var(--vscode-editor-background);
  --surface: var(--vscode-sideBar-background);
  --surface-alt: var(--vscode-editorWidget-background);
  --border: var(--vscode-panel-border);
  --text: var(--vscode-foreground);
  --muted: var(--vscode-descriptionForeground);

  --blue: #89b4fa;
  --green: #a6e3a1;
  --orange: #fab387;
  --red: #f38ba8;
}

* {
  box-sizing: border-box;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

body {
  margin: 0;
  padding: 22px 24px;

  background: var(--background);
  color: var(--text);

  font-family: var(--vscode-font-family);
  font-size: 13px;
  line-height: 1.65;
}

.container {
  width: 100%;
  max-width: 1050px;
  margin: 0 auto;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;

  padding-bottom: 17px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 17px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
}

.logo {
  width: 43px;
  height: 43px;
  object-fit: contain;
  flex-shrink: 0;
}

.brand-name {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.2px;
  line-height: 1.4;
}

.brand-subtitle {
  color: var(--muted);
  font-size: 11px;
  letter-spacing: 0.15px;
  line-height: 1.5;
}

.status-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 7px;

  padding: 6px 11px;

  border: 1px solid var(--border);
  border-radius: 7px;

  background: var(--surface);
  color: var(--muted);

  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  cursor: help;
}

.status-indicator {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--blue);
}

.status-indicator.green {
  background: var(--green);
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 8px;

  padding: 7px 11px;

  border-radius: 5px;
  background: var(--surface);
  border: 1px solid var(--border);

  font-size: 12px;
}

.file-name {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.language-area {
  display: flex;
  align-items: center;
  gap: 10px;
}

.language-label {
  color: var(--muted);
  font-size: 12px;
}

select {
  min-width: 125px;
  padding: 8px 10px;

  border: 1px solid var(--vscode-dropdown-border);
  border-radius: 5px;

  background: var(--vscode-dropdown-background);
  color: var(--vscode-dropdown-foreground);

  font: inherit;
  font-size: 12px;
  outline: none;
}

select:focus {
  border-color: var(--vscode-focusBorder);
}

select:focus-visible,
.fix-toggle:focus-visible,
.copy-button:focus-visible {
  outline: 2px solid var(--vscode-focusBorder);
  outline-offset: 2px;
}

select:disabled {
  opacity: 0.6;
  cursor: wait;
}

.error-panel {
  margin-bottom: 17px;

  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;

  background: var(--surface);
}

.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  padding: 11px 13px;
  border-bottom: 1px solid var(--border);

  font-size: 12px;
  letter-spacing: 0.2px;
  font-weight: 600;
}

.heading-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.heading-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.red-dot {
  background: var(--red);
}

.count-label {
  color: var(--muted);
  font-size: 10px;
  font-weight: 400;
}

.table-wrapper {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  min-width: 520px;
}

thead {
  background: var(--vscode-editor-background);
}

th {
  color: var(--muted);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.65px;
}

th,
td {
  padding: 9px 11px;
  border-bottom: 1px solid var(--border);
}

tbody tr:last-child td {
  border-bottom: none;
}

.error-row {
  cursor: default;
}

td {
  font-size: 11px;
}

.index-cell {
  color: var(--muted);
  width: 38px;
}

.line-cell {
  color: var(--orange);
  font-weight: 600;
  white-space: nowrap;
}

.error-badge {
  display: inline-block;
  padding: 3px 8px;

  color: var(--red);
  background: rgba(237, 115, 125, .12);

  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.15px;
  white-space: nowrap;
  cursor: help;
}

.error-message {
  min-width: 150px;
  overflow-wrap: anywhere;
  font-size: 12px;
  line-height: 1.55;
}

.file-cell {
  color: var(--muted);
  white-space: nowrap;
}

.content-section {
  margin-bottom: 17px;
}

.section-heading {
  display: flex;
  align-items: center;
  gap: 8px;

  padding: 0 0 11px;
  margin-bottom: 10px;

  border-bottom: 1px solid var(--border);

  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.8px;
  text-transform: uppercase;
}

.section-icon {
  color: var(--blue);
}

.explanation-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.explanation-card-block {
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--surface);
}

.explanation-card-header {
  padding: 12px 15px 0;
}

.explanation-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.explanation-index {
  font-weight: 700;
  font-size: 12px;
}

.explanation-line {
  color: var(--orange);
  font-size: 11px;
  font-weight: 600;
}

.individual-source {
  color: var(--muted);
  font-size: 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2px 6px;
}

.matched-error {
  color: var(--muted);
  font-size: 12px;
  margin-bottom: 10px;
  overflow-wrap: anywhere;
}

.content-card {
  padding: 17px 19px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.9;
}

.explanation-card,
.remember-card {
  border-radius: 8px;
}


/* Markdown formatting inside explanations */

.explanation-text h2,
.explanation-text h3,
.explanation-text h4 {
  margin: 16px 0 8px;
  color: var(--text);
  font-weight: 700;
  line-height: 1.5;
}

.explanation-text h2 {
  font-size: 16px;
}

.explanation-text h3 {
  font-size: 14px;
}

.explanation-text h4 {
  font-size: 13px;
}

.explanation-text p {
  margin: 0 0 12px;
}

.explanation-text p:last-child {
  margin-bottom: 0;
}

.explanation-text ul,
.explanation-text ol {
  margin: 8px 0 12px;
  padding-left: 24px;
}

.explanation-text li {
  margin-bottom: 5px;
  padding-left: 3px;
}

.explanation-text strong {
  color: var(--blue);
  font-weight: 700;
}

.explanation-text em {
  font-style: italic;
}

.explanation-text .markdown-inline-code {
  padding: 2px 5px;
  border-radius: 4px;
  background: var(--vscode-textCodeBlock-background);
  color: var(--orange);
  font-family: var(--vscode-editor-font-family);
  font-size: 0.92em;
}

.explanation-text .markdown-code {
  margin: 12px 0;
  padding: 13px;
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--vscode-editor-background);
}

.explanation-text .markdown-code code {
  font-family: var(--vscode-editor-font-family);
  font-size: 12px;
  line-height: 1.8;
  white-space: pre;
}


.fix-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px;
  background: var(--surface);
}

.fix-controls {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
  color: var(--muted);
  font-size: 12px;
}

.fix-toggle {
  width: 100%;

  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;

  padding: 10px 12px;

  border: 1px solid var(--border);
  border-radius: 7px;

  background: var(--surface-alt);
  color: var(--text);

  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.fix-toggle:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.fix-content {
  display: none;
  margin-top: 12px;
}

.fix-content.visible {
  display: block;
}

.fix-description {
  color: var(--muted);
  margin: 0 0 10px;
}

.code-block {
  position: relative;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--vscode-editor-background);
  overflow: hidden;
}

.code-block pre {
  margin: 0;
  padding: 14px;
  overflow-x: auto;

  font-family: var(--vscode-editor-font-family);
  font-size: 12px;
  line-height: 1.8;
  white-space: pre;
}

.code-actions {
  display: flex;
  justify-content: flex-end;
  padding: 8px 10px;
  border-top: 1px solid var(--border);
}

.copy-button {
  border: 1px solid var(--border);
  border-radius: 5px;

  background: var(--surface);
  color: var(--text);

  padding: 6px 10px;
  font: inherit;
  cursor: pointer;
}

.copy-button:disabled {
  opacity: 0.6;
  cursor: wait;
}

.remember-card {
  border: 1px solid var(--border);
  background: var(--surface);
}

.footer {
  display: flex;
  align-items: center;
  gap: 10px;

  margin-top: 24px;
  padding-top: 14px;

  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 11px;
}

.footer-logo {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.loader-overlay {
  position: fixed;
  inset: 0;

  display: none;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 14px;

  background: color-mix(in srgb, var(--background) 82%, black);
  z-index: 20;
}

.loader-overlay.visible {
  display: flex;
}

.loader-image {
  width: 54px;
  height: 54px;
  object-fit: contain;
}

.loader-text {
  color: var(--muted);
  font-size: 12px;
}

@media (max-width: 650px) {
  body {
    padding: 14px;
  }

  .header {
    align-items: flex-start;
    flex-direction: column;
  }

  .status-group {
    justify-content: flex-start;
  }

  .toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .language-area {
    width: 100%;
    justify-content: space-between;
  }
}

</style>
</head>

<body>

<div class="loader-overlay" id="loader">
  <img
    class="loader-image"
    src="${loader}"
    alt="Loading"
  >
  <div class="loader-text" role="status" aria-live="polite">
    Generating your explanation...
  </div>
</div>

<div class="container">

  <header class="header">

    <div class="brand">

      <img
        class="logo"
        src="${logo}"
        alt="Code Equalize logo"
      >

      <div>
        <div class="brand-name">
          Code Equalize
        </div>

        <div class="brand-subtitle">
          Understand errors. Learn better. Code confidently.
        </div>
      </div>

    </div>

    <div class="status-group">

      <div
        class="status status-error"
        id="error-type-status"
        title="${escapeHtml(combinedErrorTooltip)}"
        aria-label="${escapeHtml(combinedErrorTooltip)}"
      >
        <span class="status-indicator"></span>

        <span id="error-type-label">
          ${escapeHtml(combinedErrorType)}
        </span>
      </div>

      <div
        class="status status-source"
        id="source-status"
        title="${escapeHtml(sourceTooltip)}"
      >
        <span class="status-indicator green"></span>

        <span id="source-label">
          ${escapeHtml(sourceLabel)}
        </span>
      </div>

    </div>

  </header>

  <div class="toolbar">

    <div class="file-info">

      <span>▤</span>

      <span class="file-name" id="file-name">
        ${escapeHtml(data.fileName || 'Current File')}
      </span>

      <span style="color:var(--muted)">·</span>

      <span id="file-language" aria-label="Source programming language">
        ${escapeHtml(data.sourceLanguage || 'Source language unavailable')}
      </span>

    </div>

    <div class="language-area">

      <label class="language-label" for="language">
        Explanation language
      </label>

      <select id="language" aria-label="Explanation language">
        ${languageOptions}
      </select>

    </div>

  </div>

  <section class="error-panel">

    <div class="panel-heading">

      <span class="heading-left">
        <span class="heading-dot red-dot"></span>
        Detected Errors
      </span>

      <span class="count-label" id="error-count">
        ${errorCount} error${errorCount === 1 ? '' : 's'} detected
      </span>

    </div>

    <div class="table-wrapper">

      <table>

        <thead>
          <tr>
            <th>#</th>
            <th>Line</th>
            <th>Type</th>
            <th>Error</th>
            <th>File</th>
          </tr>
        </thead>

        <tbody id="error-rows">
          ${errors}
        </tbody>

      </table>

    </div>

  </section>

  <section class="content-section">

    <div class="section-heading explanation-heading">
      <span class="section-icon">ⓘ</span>
      WHY THIS HAPPENED
    </div>

    <div
      class="explanation-list"
      id="explanation-list"
    >
      ${explanationCards}
    </div>

  </section>

  <section class="content-section">

    <div class="section-heading fix-heading">
      <span class="section-icon">⚒</span>
      HOW TO FIX IT
    </div>

    <div class="fix-card">

      <div class="fix-controls">

        <span
          class="fix-status"
          id="fix-status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          Your suggested fix unlocks in 15 seconds.
        </span>

        <span class="fix-status" id="fix-countdown" aria-live="off">
          15s
        </span>

      </div>

      <button
        class="fix-toggle"
        id="fix-toggle"
        type="button"
        aria-label="Show or hide the consolidated code fix"
        aria-expanded="false"
        aria-controls="fix-content"
        disabled
      >
        <span id="fix-toggle-label">
          ✓ Show Code Fix
        </span>

        <span id="fix-arrow">⌄</span>
      </button>

      <div class="fix-content" id="fix-content">

        <p class="fix-description">
          Consolidated correction for the entire source file.
        </p>

        <div class="code-block">

          <pre id="fix-code">${escapeHtml(data.fix)}</pre>

          <div class="code-actions">

            <button
              class="copy-button"
              id="copy-button"
              type="button"
              aria-label="Copy the consolidated code fix"
            >
              Copy
            </button>

            <span
              class="sr-only"
              id="copy-status"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            ></span>

          </div>

        </div>

      </div>

    </div>

  </section>

  <section class="content-section">

    <div class="section-heading remember-heading">
      <span class="section-icon">◉</span>
      REMEMBER FOR NEXT TIME
    </div>

    <div class="content-card remember-card">

      <div class="remember-text" id="remember">
        ${escapeHtml(data.remember)}
      </div>

    </div>

  </section>

  <footer class="footer">

    <img
      class="footer-logo"
      src="${logo}"
      alt="Code Equalize"
    >

    <span>
      © 2026 Code Equalize. All rights reserved.
    </span>

  </footer>

</div>

<div
  class="sr-only"
  id="action-status"
  role="status"
  aria-live="polite"
  aria-atomic="true"
></div>

<script nonce="${nonce}">

const vscode = acquireVsCodeApi();

const languageSelect =
  document.getElementById('language');

const loader =
  document.getElementById('loader');

const fixToggle =
  document.getElementById('fix-toggle');

const fixToggleLabel =
  document.getElementById('fix-toggle-label');

const fixArrow =
  document.getElementById('fix-arrow');

const fixContent =
  document.getElementById('fix-content');

const fixStatus =
  document.getElementById('fix-status');

const fixCountdown =
  document.getElementById('fix-countdown');

const copyButton =
  document.getElementById('copy-button');

const copyStatus =
  document.getElementById('copy-status');

const actionStatus =
  document.getElementById('action-status');

const supportedLanguages =
  ${JSON.stringify(SUPPORTED_LANGUAGES)};
const languageRequestPrefix =
  ${JSON.stringify(nonce)} + '-language-';
const copyRequestPrefix =
  ${JSON.stringify(nonce)};

let remaining = 15;
let countdownTimer = null;
let unlocked = false;
let languageRequestSequence = 0;
let activeLanguageRequestId = null;
let activeRequestedLanguage = null;
let copyFeedbackTimer = null;
let copyRequestSequence = 0;
let pendingCopyRequestId = null;

let currentLanguage =
  ${JSON.stringify(data.targetLanguage)};

/**
 * Starts the existing 15-second fix countdown.
 */
function clearFixCountdown() {
  if (countdownTimer !== null) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function startFixCountdown() {
  clearFixCountdown();

  remaining = 15;
  unlocked = false;

  fixToggle.disabled = true;
  fixToggle.setAttribute('aria-expanded', 'false');

  fixToggleLabel.textContent = '✓ Show Code Fix';
  fixArrow.textContent = '⌄';

  fixContent.classList.remove('visible');

  fixStatus.textContent =
    'Your suggested fix unlocks in 15 seconds.';

  fixCountdown.textContent = '15s';

  const timerId = setInterval(() => {
    if (countdownTimer !== timerId || unlocked) {
      return;
    }

    remaining = Math.max(0, remaining - 1);

    fixCountdown.textContent = remaining + 's';

    if (remaining === 0) {
      clearInterval(timerId);
      countdownTimer = null;

      unlocked = true;
      fixToggle.disabled = false;

      fixStatus.textContent =
        'Your suggested fix is ready.';

      fixCountdown.textContent = 'Ready';
    }
  }, 1000);

  countdownTimer = timerId;
}

function getErrorTypeLabel(type) {
  if (type === 'runtime') {
    return 'Runtime Error';
  }

  if (type === 'potential') {
    return 'Potential Issue';
  }

  return 'Diagnostic Error';
}

function getErrorTypeTooltip(type) {
  if (type === 'runtime') {
    return 'Runtime Error: An error reported by the debugger while the program was executing.';
  }

  if (type === 'potential') {
    return 'Potential Issue: A high-confidence static concern that may cause a runtime problem.';
  }

  return 'Diagnostic Error: An issue reported by a language analyzer, compiler, or editor diagnostic provider.';
}

/**
 * Updates the combined error-type and source indicators.
 */
 function updateStatus(data)
 {
  const errors = data.errors?.length
   ? data.errors
    : data.explanations || [];

  const types = new Set(
    errors.map(error => error.errorType || 'diagnostic')
  );

  const labels = [];

  if (types.has('runtime')) {
    labels.push('Runtime');
  }

  if (types.has('diagnostic')) {
    labels.push('Diagnostic');
  }

  if (types.has('potential')) {
    labels.push('Potential');
  }

  const typeLabel =
    document.getElementById('error-type-label');

  const typeStatus =
    document.getElementById('error-type-status');

  if (typeLabel && typeStatus) {
    if (labels.length <= 1) {
      typeLabel.textContent =
        labels[0] === 'Potential'
          ? 'Potential Issue'
          : (labels[0] || 'Diagnostic') + ' Error';
    } else {
      typeLabel.textContent =
        labels.join(' & ') + ' Errors';
    }

    const descriptions = [];

    if (types.has('runtime')) {
      descriptions.push(getErrorTypeTooltip('runtime'));
    }

    if (types.has('diagnostic')) {
      descriptions.push(getErrorTypeTooltip('diagnostic'));
    }

    if (types.has('potential')) {
      descriptions.push(getErrorTypeTooltip('potential'));
    }

    typeStatus.title = descriptions.join('\\n\\n');
  }

  const source = data.source || 'Backend';
const normalizedSource = String(source).toLowerCase();

const sourceLabel =
  document.getElementById('source-label');

const sourceStatus =
  document.getElementById('source-status');

if (sourceLabel && sourceStatus) {
  sourceLabel.textContent =
    normalizedSource === 'chromadb'
      ? 'ChromaDB'
      : source;

  if (normalizedSource === 'mixed') {
    sourceStatus.title =
      'Mixed: Some errors had accepted matching examples from ChromaDB, while others required AI generation. Groq generated the current explanations and consolidated fix.';
  } else if (normalizedSource === 'chromadb') {
    sourceStatus.title =
      'ChromaDB: Similar programming-error examples were retrieved as supporting context. Groq generated the current explanations and consolidated fix.';
  } else if (normalizedSource === 'ai') {
    sourceStatus.title =
      'AI: Groq generated this response without accepted matching examples from the ChromaDB knowledge base.';
  } else {
    sourceStatus.title =
      'Explanation source information is unavailable.';
  }
}
}

/**
 * Renders all errors safely using DOM text nodes.
 */
function renderErrors(data) {
  const rowsContainer =
    document.getElementById('error-rows');

  rowsContainer.replaceChildren();

  const updatedErrors = data.errors?.length
    ? data.errors
    : (data.explanations || []).map(item => ({
        id: item.id,
        errorMessage: item.errorMessage || item.error,
        fileName: item.fileName || data.fileName,
        lineNumber: item.lineNumber,
        errorType: item.errorType
      }));

  updatedErrors
    .slice()
    .sort((a, b) =>
      lineSortValue(a.lineNumber) -
      lineSortValue(b.lineNumber)
    )
    .forEach((error, index) => {
      const row = document.createElement('tr');

      row.className = 'error-row';
      row.dataset.errorIndex = String(index);

      const values = [
        String(index + 1),

        typeof error.lineNumber === 'number' &&
        isValidLineNumber(error.lineNumber)
          ? String(error.lineNumber + 1)
          : '—',

        getErrorTypeLabel(error.errorType || 'diagnostic'),

        error.errorMessage || '',

        error.fileName || data.fileName || '—'
      ];

      values.forEach((value, cellIndex) => {
        const cell = document.createElement('td');

        if (cellIndex === 0) {
          cell.className = 'index-cell';
        } else if (cellIndex === 1) {
          cell.className = 'line-cell';
        } else if (cellIndex === 3) {
          cell.className = 'error-message';
        } else if (cellIndex === 4) {
          cell.className = 'file-cell';
        }

        if (cellIndex === 2) {
          const badge = document.createElement('span');

          badge.className = 'error-badge';

          badge.title = getErrorTypeTooltip(
            error.errorType || 'diagnostic'
          );

          badge.textContent = value;

          cell.appendChild(badge);
        } else {
          cell.textContent = value;
        }

        row.appendChild(cell);
      });

      rowsContainer.appendChild(row);
    });

  document.getElementById('error-count').textContent =
    updatedErrors.length +
    ' error' +
    (updatedErrors.length === 1 ? '' : 's') +
    ' detected';
}

/**
 * Renders individual explanations in line-number order.
 */
function renderExplanations(data) {
  const list =
    document.getElementById('explanation-list');

  list.replaceChildren();

  const explanations = (data.explanations || [])
    .slice()
    .sort((a, b) =>
      lineSortValue(a.lineNumber) -
      lineSortValue(b.lineNumber)
    );

  explanations.forEach((item, index) => {
    const article = document.createElement('article');

    article.className = 'explanation-card-block';

    article.dataset.explanationId =
      item.id || String(index);

    const header = document.createElement('div');

    header.className = 'explanation-card-header';

    const title = document.createElement('div');

    title.className = 'explanation-card-title';

    const indexLabel = document.createElement('span');

    indexLabel.className = 'explanation-index';
    indexLabel.textContent = 'Error ' + (index + 1);

    const badge = document.createElement('span');

    badge.className = 'error-badge';

    badge.title = getErrorTypeTooltip(
      item.errorType || 'diagnostic'
    );

    badge.textContent = getErrorTypeLabel(
      item.errorType || 'diagnostic'
    );

    const line = document.createElement('span');

    line.className = 'explanation-line';

    line.textContent =
      'Line ' +
      (
        typeof item.lineNumber === 'number' &&
        isValidLineNumber(item.lineNumber)
          ? item.lineNumber + 1
          : '—'
      );

    title.appendChild(indexLabel);
    title.appendChild(badge);
    title.appendChild(line);

    if (item.source) {
      const source = document.createElement('span');

      source.className = 'individual-source';
      source.textContent = item.source;

      title.appendChild(source);
    }

    const matched = document.createElement('div');

    matched.className = 'matched-error';

    matched.textContent =
      item.matchedError ||
      item.errorMessage ||
      item.error ||
      '';

    header.appendChild(title);
    header.appendChild(matched);

    const card = document.createElement('div');

    card.className =
      'content-card explanation-card';

    const text = document.createElement('div');

    text.className = 'explanation-text';

    text.innerHTML = renderMarkdownHtml(
  item.failureMessage
    ? 'Explanation unavailable: ' + item.failureMessage
    : item.explanation || ''
);

    card.appendChild(text);

    article.appendChild(header);
    article.appendChild(card);

    list.appendChild(article);
  });
}

/**
 * Validates extension-host data before the webview updates its current content.
 */
function isRecord(value) {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value);
}

function isValidErrorType(value) {
  return (
    value === undefined ||
    value === 'diagnostic' ||
    value === 'runtime' ||
    value === 'potential'
  );
}

function isValidLineNumber(value) {
  return value === undefined ||
    (
      typeof value === 'number' &&
      Number.isFinite(value) &&
      Number.isInteger(value) &&
      value >= 0
    );
}

function lineSortValue(value) {
  return typeof value === 'number' && isValidLineNumber(value)
    ? value
    : Number.MAX_SAFE_INTEGER;
}

function isValidErrorEntry(value) {
  return isRecord(value) &&
    typeof value.errorMessage === 'string' &&
    (value.id === undefined || typeof value.id === 'string') &&
    (value.fileName === undefined || typeof value.fileName === 'string') &&
    isValidLineNumber(value.lineNumber) &&
    isValidErrorType(value.errorType);
}

function isValidExplanation(value) {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    value.id.trim().length > 0 &&
    typeof value.errorMessage === 'string' &&
    typeof value.explanation === 'string' &&
    (value.fileName === undefined || typeof value.fileName === 'string') &&
    isValidLineNumber(value.lineNumber) &&
    isValidErrorType(value.errorType) &&
    (value.source === undefined || typeof value.source === 'string') &&
    (value.matchedError === undefined || typeof value.matchedError === 'string') &&
    (value.distance === undefined ||
      value.distance === null ||
      (typeof value.distance === 'number' && Number.isFinite(value.distance))) &&
    (value.failureMessage === undefined ||
      typeof value.failureMessage === 'string');
}

function isValidPanelData(value) {
  if (
    !isRecord(value) ||
    !supportedLanguages.includes(value.targetLanguage) ||
    typeof value.sourceLanguage !== 'string' ||
    !Array.isArray(value.explanations) ||
    !value.explanations.every(isValidExplanation) ||
    typeof value.fix !== 'string' ||
    typeof value.remember !== 'string' ||
    (value.source !== undefined && typeof value.source !== 'string') ||
    (value.fileName !== undefined && typeof value.fileName !== 'string') ||
    (value.errors !== undefined &&
      (!Array.isArray(value.errors) ||
        !value.errors.every(isValidErrorEntry)))
  ) {
    return false;
  }

  return true;
}

function finishLanguageRequest(requestId, message) {
  if (
    typeof requestId !== 'string' ||
    requestId !== activeLanguageRequestId
  ) {
    return false;
  }

  activeLanguageRequestId = null;
  activeRequestedLanguage = null;
  loader.classList.remove('visible');
  languageSelect.disabled = false;
  languageSelect.value = currentLanguage;
  actionStatus.textContent = message;

  return true;
}

/**
 * Applies a successful language update.
 */
function applyUpdate(data) {
  if (!isValidPanelData(data)) {
    return false;
  }

  const fixCode = document.getElementById('fix-code');
  const fixChanged = fixCode.textContent !== data.fix;

  document.getElementById('file-name').textContent =
    data.fileName || 'Current File';

  renderErrors(data);
  renderExplanations(data);

  fixCode.textContent = data.fix;

  document.getElementById('remember').textContent = data.remember;

  updateStatus(data);

  currentLanguage = data.targetLanguage;
  languageSelect.value = currentLanguage;

  if (fixChanged) {
    startFixCountdown();
  }

  languageSelect.disabled = false;
  loader.classList.remove('visible');
  actionStatus.textContent = 'Explanation updated.';

  return true;
}

/**
 * Starts the initial countdown.
 */
startFixCountdown();

/**
 * Shows or hides the consolidated code fix.
 */
fixToggle.addEventListener('click', () => {
  if (!unlocked) {
    return;
  }

  const visible =
    fixContent.classList.toggle('visible');

  fixToggleLabel.textContent = visible
    ? '✓ Hide Code Fix'
    : '✓ Show Code Fix';

  fixArrow.textContent = visible ? '⌃' : '⌄';
  fixToggle.setAttribute('aria-expanded', String(visible));
});

function showCopyFeedback(label, announcement) {
  if (pendingCopyRequestId !== null) {
    return;
  }

  if (copyFeedbackTimer !== null) {
    clearTimeout(copyFeedbackTimer);
  }

  copyButton.disabled = false;
  copyButton.textContent = label;
  copyStatus.textContent = announcement;

  copyFeedbackTimer = window.setTimeout(() => {
    copyButton.textContent = 'Copy';
    copyStatus.textContent = '';
    copyFeedbackTimer = null;
  }, 1500);
}

/**
 * Copies code through the VS Code extension host.
 * This avoids relying on browser clipboard permissions.
 */
copyButton.addEventListener('click', () => {
  if (copyButton.disabled) {
    return;
  }

  const code =
    document.getElementById('fix-code').textContent || '';

  if (!code.trim()) {
    showCopyFeedback(
      'Nothing to copy',
      'There is no code to copy.'
    );
    return;
  }

  if (copyFeedbackTimer !== null) {
    clearTimeout(copyFeedbackTimer);
    copyFeedbackTimer = null;
  }

  copyStatus.textContent = '';
  copyButton.disabled = true;
  copyButton.textContent = 'Copying...';
  copyStatus.textContent = 'Copying code to the clipboard.';

  const requestId =
    copyRequestPrefix + '-' + String(++copyRequestSequence);

  pendingCopyRequestId = requestId;

  try {
    vscode.postMessage({
      command: 'copyFix',
      text: code,
      requestId
    });
  } catch (error) {
    console.error('[Code Equalize] Could not request code copy:', error);

    if (pendingCopyRequestId === requestId) {
      pendingCopyRequestId = null;
      showCopyFeedback('Copy failed', 'Could not copy the code.');
    }
  }
});

/**
 * Requests explanations in another language.
 */
languageSelect.addEventListener('change', () => {
  const requestedLanguage = languageSelect.value;

  if (!supportedLanguages.includes(requestedLanguage)) {
    languageSelect.value =
      activeRequestedLanguage || currentLanguage;
    return;
  }

  if (requestedLanguage === currentLanguage) {
    languageSelect.value =
      activeRequestedLanguage || currentLanguage;
    return;
  }

  const requestId =
    languageRequestPrefix + String(++languageRequestSequence);

  activeLanguageRequestId = requestId;
  activeRequestedLanguage = requestedLanguage;
  loader.classList.add('visible');
  languageSelect.disabled = true;
  actionStatus.textContent =
    'Changing explanation language to ' + requestedLanguage + '.';

  try {
    vscode.postMessage({
      command: 'changeLanguage',
      language: requestedLanguage,
      requestId
    });
  } catch (error) {
    console.error(
      '[Code Equalize] Could not request language change:',
      error
    );
    finishLanguageRequest(
      requestId,
      'Could not change the explanation language. The previous explanation is still available.'
    );
  }
});

/**
 * Receives updates and copy results from the extension.
 */
window.addEventListener('message', event => {
  const message = event.data;

  if (!isRecord(message) || typeof message.command !== 'string') {
    return;
  }

  if (message.command === 'update') {
    const requestId = message.requestId;

    if (
      typeof requestId !== 'string' ||
      requestId !== activeLanguageRequestId
    ) {
      return;
    }

    if (
      !isValidPanelData(message.data) ||
      message.data.targetLanguage !== activeRequestedLanguage ||
      !applyUpdate(message.data)
    ) {
      finishLanguageRequest(
        requestId,
        'The explanation update was invalid. The previous explanation is still available.'
      );
      return;
    }

    activeLanguageRequestId = null;
    activeRequestedLanguage = null;
    return;
  }

  if (message.command === 'error') {
    const errorMessage =
      typeof message.error === 'string' &&
      message.error.trim()
        ? message.error
        : 'Could not change the explanation language. The previous explanation is still available.';

    finishLanguageRequest(message.requestId, errorMessage);

    return;
  }

  if (message.command === 'copyResult') {
    if (
      typeof message.requestId !== 'string' ||
      message.requestId !== pendingCopyRequestId
    ) {
      return;
    }

    pendingCopyRequestId = null;

    showCopyFeedback(
      message.success === true ? 'Copied!' : 'Copy failed',
      message.success === true
        ? 'Code copied to the clipboard.'
        : 'Could not copy the code.'
    );
  }
});

window.addEventListener('beforeunload', () => {
  clearFixCountdown();

  if (copyFeedbackTimer !== null) {
    clearTimeout(copyFeedbackTimer);
    copyFeedbackTimer = null;
  }
});

window.addEventListener('pagehide', () => {
  clearFixCountdown();

  if (copyFeedbackTimer !== null) {
    clearTimeout(copyFeedbackTimer);
    copyFeedbackTimer = null;
  }
});

</script>

</body>
</html>`;
}

/**
 * Opens the Code Equalize panel and manages webview messages.
 */
export function showPanel(
  data: PanelData,
  onLanguageChange: LanguageChangeHandler,
  extensionUri: vscode.Uri,
  getCurrentLanguage?: () => string
): void {
  const sessionId = ++panelSessionSequence;

  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.Beside);
  } else {
    const panel = vscode.window.createWebviewPanel(
      'codeEqualize',
      'Code Equalize',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,

        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media')
        ]
      }
    );

    currentPanel = panel;

    panel.iconPath = vscode.Uri.joinPath(
      extensionUri,
      'media',
      'code-equalize-icon.png'
    );

    panel.onDidDispose(() => {
      if (currentPanel === panel) {
        messageListener?.dispose();
        messageListener = undefined;
        currentPanel = undefined;
      }
    });
  }

  const panel = currentPanel;
  const webview = panel.webview;

  const nonce = getNonce();
  const requestIdPrefix = `${nonce}-language-`;
  const copyRequestIdPrefix = `${nonce}-`;
  let latestLanguageRequestSequence = 0;
  let latestLanguageRequestId: string | undefined;

  const isCurrentSession = (): boolean =>
    currentPanel === panel &&
    panelSessionSequence === sessionId;

  messageListener?.dispose();
  messageListener = undefined;

  panel.title = 'Code Equalize';

  webview.html = getHtml(
    webview,
    extensionUri,
    data,
    nonce
  );

  messageListener = webview.onDidReceiveMessage(
    async message => {
      if (!isRecord(message) || typeof message.command !== 'string') {
        return;
      }

      /**
       * Handle language changes.
       */
      if (message.command === 'changeLanguage') {
        const requestId = message.requestId;

        if (
          typeof requestId !== 'string' ||
          !requestId.startsWith(requestIdPrefix)
        ) {
          return;
        }

        const sequenceText = requestId.slice(requestIdPrefix.length);
        const requestSequence = Number(sequenceText);

        if (
          !/^[1-9]\d*$/.test(sequenceText) ||
          !Number.isSafeInteger(requestSequence) ||
          requestSequence <= latestLanguageRequestSequence
        ) {
          return;
        }

        latestLanguageRequestSequence = requestSequence;
        latestLanguageRequestId = requestId;

        try {
          if (
            typeof message.language !== 'string' ||
            !SUPPORTED_LANGUAGES.includes(message.language)
          ) {
            throw new Error(
              'Unsupported explanation language.'
            );
          }

          const updatedData =
            await onLanguageChange(message.language, requestId);

          if (
            !isValidPanelData(updatedData) ||
            updatedData.targetLanguage !== message.language
          ) {
            throw new Error(
              'The explanation service returned invalid panel data.'
            );
          }

          if (
            isCurrentSession() &&
            latestLanguageRequestId === requestId
          ) {
            await panel.webview.postMessage({
              command: 'update',
              data: updatedData,
              requestId
            });
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'Could not generate the explanation.';

          if (
            isCurrentSession() &&
            latestLanguageRequestId === requestId
          ) {
            vscode.window.showErrorMessage(
              `Code Equalize: ${errorMessage}`
            );

            await panel.webview.postMessage({
              command: 'error',
              error: errorMessage,
              language:
                getCurrentLanguage?.() ??
                data.targetLanguage,
              requestId
            });
          }
        }

        return;
      }

      /**
       * Handle code copying through VS Code.
       */
      if (message.command === 'copyFix') {
        const requestId = message.requestId;
        const sequenceText =
          typeof requestId === 'string' &&
          requestId.startsWith(copyRequestIdPrefix)
            ? requestId.slice(copyRequestIdPrefix.length)
            : '';
        const requestSequence = Number(sequenceText);

        if (
          !/^[1-9]\d*$/.test(sequenceText) ||
          !Number.isSafeInteger(requestSequence)
        ) {
          return;
        }

        try {
          if (
            typeof message.text !== 'string' ||
            !message.text.trim()
          ) {
            throw new Error('There is no code to copy.');
          }

          await vscode.env.clipboard.writeText(message.text);

          if (isCurrentSession()) {
            await panel.webview.postMessage({
              command: 'copyResult',
              success: true,
              requestId
            });
          }
        } catch (error) {
          console.error(
            '[Code Equalize] Code copy failed:',
            error
          );

          if (isCurrentSession()) {
            await panel.webview.postMessage({
              command: 'copyResult',
              success: false,
              requestId
            });
          }
        }
      }
    }
  );
}
