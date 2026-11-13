import * as vscode from 'vscode';

export type PanelErrorType =
  | 'diagnostic'
  | 'runtime'
  | 'potential';

export interface PanelExplanation {
  id: string;
  errorMessage: string;
  fileName?: string;
  lineNumber?: number;
  errorType?: PanelErrorType;
  /** Understandable name of the problem, e.g. "Division by Zero". */
  issueType?: string;
  /** One-sentence description of why the error occurs. */
  summary?: string;
  explanation: string;
  source?: string;
  matchedError?: string;
  distance?: number | null;
}

export type PanelCorrectionStatus = 'complete' | 'partial' | 'none';

export interface PanelValidation {
  status: 'passed' | 'failed' | 'unavailable';
  tool?: string;
  detail?: string;
}

export interface PanelData {
  /** Identifies one analysis; language switches keep the same id. */
  analysisId: string;
  explanations: PanelExplanation[];
  fix: string;
  whatWasFixed: string;
  remember: string;
  correctionStatus: PanelCorrectionStatus;
  validation: PanelValidation;
  noIssues: boolean;
  source?: string;
  fileName?: string;
  targetLanguage: string;
  sourceLanguage: string;
}

export interface PanelHandlers {
  /** Regenerates the current analysis in another explanation language. */
  onLanguageChange: (language: string) => Promise<PanelData>;
  /** Re-analyses the file shown in this panel. */
  onReanalyze: () => void;
}

export const SUPPORTED_LANGUAGES = [
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

const COUNTDOWN_SECONDS = 15;

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

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isValidPanelExplanation(
  value: unknown
): value is PanelExplanation {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    value.id.trim().length > 0 &&
    typeof value.errorMessage === 'string' &&
    typeof value.explanation === 'string' &&
    value.explanation.trim().length > 0 &&
    isOptionalString(value.fileName) &&
    isValidLineNumber(value.lineNumber) &&
    isValidPanelErrorType(value.errorType) &&
    isOptionalString(value.issueType) &&
    isOptionalString(value.summary) &&
    isOptionalString(value.source) &&
    isOptionalString(value.matchedError) &&
    (value.distance === undefined ||
      value.distance === null ||
      (typeof value.distance === 'number' &&
        Number.isFinite(value.distance)));
}

export function isValidPanelData(value: unknown): value is PanelData {
  if (
    !isRecord(value) ||
    typeof value.analysisId !== 'string' ||
    !value.analysisId ||
    typeof value.targetLanguage !== 'string' ||
    !SUPPORTED_LANGUAGES.includes(value.targetLanguage) ||
    typeof value.sourceLanguage !== 'string' ||
    !Array.isArray(value.explanations) ||
    !value.explanations.every(isValidPanelExplanation) ||
    typeof value.fix !== 'string' ||
    typeof value.whatWasFixed !== 'string' ||
    typeof value.remember !== 'string' ||
    typeof value.noIssues !== 'boolean' ||
    !['complete', 'partial', 'none'].includes(
      value.correctionStatus as string
    ) ||
    !isRecord(value.validation) ||
    !['passed', 'failed', 'unavailable'].includes(
      value.validation.status as string
    ) ||
    !isOptionalString(value.source) ||
    !isOptionalString(value.fileName)
  ) {
    return false;
  }

  const ids = new Set(value.explanations.map(item => item.id));

  if (ids.size !== value.explanations.length) {
    return false;
  }

  // A result with issues must carry every section; a clean result none.
  return value.noIssues
    ? value.explanations.length === 0
    : value.explanations.length > 0 &&
      value.fix.trim().length > 0 &&
      value.whatWasFixed.trim().length > 0 &&
      value.remember.trim().length > 0;
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
  font-family: var(--vscode-font-family, system-ui, sans-serif);
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

/* ------------------------------------------------------------------ */
/* Syntax highlighting                                                 */
/* ------------------------------------------------------------------ */

type CodeLanguage = 'python' | 'java' | 'c' | 'cpp' | 'plain';

const C_KEYWORDS = [
  'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do',
  'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if',
  'inline', 'int', 'long', 'register', 'restrict', 'return', 'short',
  'signed', 'sizeof', 'static', 'struct', 'switch', 'typedef', 'union',
  'unsigned', 'void', 'volatile', 'while', 'bool', 'true', 'false', 'NULL'
];

const KEYWORDS: Record<Exclude<CodeLanguage, 'plain'>, Set<string>> = {
  python: new Set([
    'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
    'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
    'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
    'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try',
    'while', 'with', 'yield', 'match', 'case', 'self'
  ]),
  java: new Set([
    'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch',
    'char', 'class', 'const', 'continue', 'default', 'do', 'double',
    'else', 'enum', 'extends', 'final', 'finally', 'float', 'for', 'goto',
    'if', 'implements', 'import', 'instanceof', 'int', 'interface', 'long',
    'native', 'new', 'package', 'private', 'protected', 'public', 'return',
    'short', 'static', 'strictfp', 'super', 'switch', 'synchronized',
    'this', 'throw', 'throws', 'transient', 'try', 'void', 'volatile',
    'while', 'var', 'record', 'yield', 'true', 'false', 'null'
  ]),
  c: new Set(C_KEYWORDS),
  cpp: new Set([
    ...C_KEYWORDS,
    'alignas', 'alignof', 'and', 'catch', 'class', 'constexpr',
    'const_cast', 'decltype', 'delete', 'dynamic_cast', 'explicit',
    'export', 'friend', 'mutable', 'namespace', 'new', 'noexcept', 'not',
    'nullptr', 'operator', 'or', 'private', 'protected', 'public',
    'reinterpret_cast', 'static_assert', 'static_cast', 'template', 'this',
    'thread_local', 'throw', 'try', 'typeid', 'typename', 'using',
    'virtual', 'override', 'final'
  ])
};

function toCodeLanguage(sourceLanguage: string): CodeLanguage {
  switch (sourceLanguage.toLowerCase()) {
    case 'python':
      return 'python';
    case 'java':
      return 'java';
    case 'c':
      return 'c';
    case 'c++':
    case 'cpp':
      return 'cpp';
    default:
      return 'plain';
  }
}

function isIdentifierStart(char: string): boolean {
  return /[A-Za-z_$]/.test(char);
}

function isIdentifierPart(char: string | undefined): boolean {
  return char !== undefined && /[A-Za-z0-9_$]/.test(char);
}

/**
 * Small single-pass highlighter for Python, Java, C and C++.
 * Returns escaped HTML; the text content is exactly the source code.
 */
export function highlightCode(code: string, sourceLanguage: string): string {
  const language = toCodeLanguage(sourceLanguage);

  if (language === 'plain') {
    return escapeHtml(code);
  }

  const keywords = KEYWORDS[language];
  const isPython = language === 'python';
  const isCFamily = language === 'c' || language === 'cpp';
  const length = code.length;
  let html = '';
  let i = 0;

  const emit = (kind: string | undefined, text: string): void => {
    html += kind
      ? `<span class="tok-${kind}">${escapeHtml(text)}</span>`
      : escapeHtml(text);
  };

  const endOfLine = (from: number): number => {
    const index = code.indexOf('\n', from);
    return index === -1 ? length : index;
  };

  const atLineStart = (index: number): boolean => {
    let j = index - 1;
    while (j >= 0 && (code[j] === ' ' || code[j] === '\t')) {
      j--;
    }
    return j < 0 || code[j] === '\n';
  };

  const readQuoted = (start: number, quote: string): number => {
    let j = start + 1;
    while (j < length && code[j] !== '\n') {
      if (code[j] === '\\') {
        j += 2;
        continue;
      }
      if (code[j] === quote) {
        return j + 1;
      }
      j++;
    }
    return j;
  };

  while (i < length) {
    const char = code[i];
    const next = code[i + 1];

    // Comments.
    if (isPython && char === '#') {
      const end = endOfLine(i);
      emit('comment', code.slice(i, end));
      i = end;
      continue;
    }

    if (!isPython && char === '/' && next === '/') {
      const end = endOfLine(i);
      emit('comment', code.slice(i, end));
      i = end;
      continue;
    }

    if (!isPython && char === '/' && next === '*') {
      const close = code.indexOf('*/', i + 2);
      const end = close === -1 ? length : close + 2;
      emit('comment', code.slice(i, end));
      i = end;
      continue;
    }

    // C/C++ preprocessor directives.
    if (isCFamily && char === '#' && atLineStart(i)) {
      const end = endOfLine(i);
      emit('preproc', code.slice(i, end));
      i = end;
      continue;
    }

    // Python string prefixes (f"", r'', b"", rb"" ...).
    let stringStart = i;
    if (isPython && /[rRbBfFuU]/.test(char) && !isIdentifierPart(code[i - 1])) {
      let j = i;
      while (j < i + 2 && /[rRbBfFuU]/.test(code[j] ?? '')) {
        j++;
      }
      if (code[j] === '"' || code[j] === "'") {
        stringStart = j;
      }
    }

    const quote = code[stringStart];

    if (
      (quote === '"' || quote === "'") &&
      (stringStart !== i || char === quote)
    ) {
      const triple = quote.repeat(3);
      let end: number;

      if (
        (isPython || (language === 'java' && quote === '"')) &&
        code.startsWith(triple, stringStart)
      ) {
        const close = code.indexOf(triple, stringStart + 3);
        end = close === -1 ? length : close + 3;
      } else {
        end = readQuoted(stringStart, quote);
      }

      emit('string', code.slice(i, end));
      i = end;
      continue;
    }

    // Numbers.
    if (
      /[0-9]/.test(char) ||
      (char === '.' && /[0-9]/.test(next ?? '') && !isIdentifierPart(code[i - 1]))
    ) {
      if (!isIdentifierPart(code[i - 1])) {
        let j = i + 1;
        while (j < length) {
          const c = code[j];
          if (/[0-9A-Za-z_.']/.test(c)) {
            j++;
          } else if (
            (c === '+' || c === '-') &&
            /[eEpP]/.test(code[j - 1]) &&
            !/^0[xX]/.test(code.slice(i, j))
          ) {
            j++;
          } else {
            break;
          }
        }
        emit('number', code.slice(i, j));
        i = j;
        continue;
      }
    }

    // Identifiers, keywords and function calls.
    if (isIdentifierStart(char)) {
      let j = i + 1;
      while (isIdentifierPart(code[j])) {
        j++;
      }
      const word = code.slice(i, j);
      let k = j;
      while (code[k] === ' ' || code[k] === '\t') {
        k++;
      }

      if (keywords.has(word)) {
        emit('keyword', word);
      } else if (code[k] === '(') {
        emit('function', word);
      } else if (
        language !== 'python' && /^[A-Z][A-Za-z0-9_]*[a-z][A-Za-z0-9_]*$/.test(word)
      ) {
        emit('type', word);
      } else {
        emit(undefined, word);
      }

      i = j;
      continue;
    }

    emit(undefined, char);
    i++;
  }

  return html;
}

/* ------------------------------------------------------------------ */
/* Content rendering                                                   */
/* ------------------------------------------------------------------ */

const ERROR_TYPE_RANK: Record<PanelErrorType, number> = {
  runtime: 0,
  diagnostic: 1,
  potential: 2
};

/**
 * Sorts issues by source line (ascending); issues without a line come last.
 * Same-line issues use a deterministic order: observed runtime errors,
 * then editor diagnostics, then potential issues, then by id.
 */
export function sortIssues<T extends PanelExplanation>(items: T[]): T[] {
  const lineOf = (item: T): number =>
    typeof item.lineNumber === 'number' &&
    isValidLineNumber(item.lineNumber)
      ? item.lineNumber
      : Number.MAX_SAFE_INTEGER;

  return [...items].sort((a, b) =>
    lineOf(a) - lineOf(b) ||
    ERROR_TYPE_RANK[a.errorType ?? 'diagnostic'] -
      ERROR_TYPE_RANK[b.errorType ?? 'diagnostic'] ||
    a.id.localeCompare(b.id)
  );
}

function getFallbackTypeLabel(type?: string): string {
  switch (type) {
    case 'runtime':
      return 'Runtime Error';

    case 'potential':
      return 'Potential Runtime Issue';

    default:
      return 'Compiler / Editor Error';
  }
}

function getOriginTooltip(type?: string): string {
  switch (type) {
    case 'runtime':
      return 'Observed at runtime: reported by the debugger while the program was executing.';

    case 'potential':
      return 'Potential issue: inferred by analysing the source without running it. Whether it happens can depend on input or the execution path.';

    default:
      return 'Reported by the editor\'s compiler or language analyser for this file.';
  }
}

function renderOriginTag(type?: string): string {
  if (type === 'potential') {
    return `<span class="origin-tag origin-potential" title="${escapeHtml(getOriginTooltip(type))}">Potential</span>`;
  }

  if (type === 'runtime') {
    return `<span class="origin-tag origin-runtime" title="${escapeHtml(getOriginTooltip(type))}">Observed at runtime</span>`;
  }

  return '';
}

function formatLine(lineNumber?: number): string {
  return typeof lineNumber === 'number' && isValidLineNumber(lineNumber)
    ? String(lineNumber + 1)
    : '—';
}

function getCombinedOrigin(items: PanelExplanation[]): string {
  const types = new Set(items.map(item => item.errorType ?? 'diagnostic'));
  const labels: string[] = [];

  if (types.has('runtime')) {
    labels.push('Runtime');
  }
  if (types.has('diagnostic')) {
    labels.push('Compiler');
  }
  if (types.has('potential')) {
    labels.push('Potential');
  }

  return labels.length ? labels.join(' & ') : 'No issues';
}

function getCombinedOriginTooltip(items: PanelExplanation[]): string {
  const types = new Set(items.map(item => item.errorType ?? 'diagnostic'));

  return (['runtime', 'diagnostic', 'potential'] as const)
    .filter(type => types.has(type))
    .map(getOriginTooltip)
    .join('\n\n') || 'No meaningful issues were found.';
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
 * Renders the four-column detected-error table: # | Line | Error Type | Description.
 */
function renderErrorRows(issues: PanelExplanation[]): string {
  if (issues.length === 0) {
    return `
    <tr class="error-row">
      <td colspan="4" class="empty-row">
        No meaningful errors or potential runtime issues were found in this file.
      </td>
    </tr>`;
  }

  return issues.map((item, index) => {
    const typeLabel = item.issueType || getFallbackTypeLabel(item.errorType);
    const description = item.summary || item.errorMessage;
    const showOriginal =
      Boolean(item.summary) &&
      item.errorType !== 'potential' &&
      item.errorMessage.trim() !== item.summary?.trim();

    return `
    <tr class="error-row">
      <td class="index-cell">${index + 1}</td>
      <td class="line-cell">${formatLine(item.lineNumber)}</td>
      <td class="type-cell">
        <span class="error-badge" title="${escapeHtml(getOriginTooltip(item.errorType))}">${escapeHtml(typeLabel)}</span>
        ${renderOriginTag(item.errorType)}
      </td>
      <td class="error-message">
        ${escapeHtml(description)}
        ${showOriginal
          ? `<div class="original-message" title="Original message">${escapeHtml(item.errorMessage)}</div>`
          : ''}
      </td>
    </tr>`;
  }).join('');
}

/**
 * Renders the unified WHY THIS HAPPENED section: one paragraph per issue.
 */
function renderExplanationCards(issues: PanelExplanation[]): string {
  return issues.map((item, index) => `
    <article
      class="explanation-card-block"
      data-explanation-id="${escapeHtml(item.id)}"
    >
      <div class="explanation-card-header">
        <span class="explanation-index">Error ${index + 1}</span>
        <span class="explanation-line">Line ${formatLine(item.lineNumber)}</span>
        <span class="error-badge" title="${escapeHtml(getOriginTooltip(item.errorType))}">${escapeHtml(item.issueType || getFallbackTypeLabel(item.errorType))}</span>
        ${renderOriginTag(item.errorType)}
        ${item.source?.toLowerCase() === 'chromadb'
          ? `<span class="individual-source" title="A similar example from the ChromaDB knowledge base was used as supporting context.">ChromaDB</span>`
          : ''}
      </div>
      <div class="explanation-text">
        ${renderMarkdownHtml(item.explanation)}
      </div>
    </article>
  `).join('');
}

function renderValidation(validation: PanelValidation): string {
  const runtimeNote = 'Runtime behaviour was not executed or verified.';

  if (validation.status === 'passed') {
    return `<span class="validation validation-passed">✓ Syntax checked successfully${validation.tool ? ` (${escapeHtml(validation.tool)})` : ''}.</span> <span class="validation-note">${runtimeNote}</span>`;
  }

  if (validation.status === 'failed') {
    return `<span class="validation validation-failed">⚠ Syntax validation failed${validation.tool ? ` (${escapeHtml(validation.tool)})` : ''}. Review the corrected code before using it.</span>${validation.detail ? `<pre class="validation-detail">${escapeHtml(validation.detail)}</pre>` : ''} <span class="validation-note">${runtimeNote}</span>`;
  }

  return `<span class="validation">Syntax validation unavailable for this file.</span> <span class="validation-note">${runtimeNote}</span>`;
}

/**
 * Builds the complete VS Code webview HTML for one analysis result.
 * Exported for tests.
 */
export function getPanelHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  data: PanelData,
  nonce: string,
  startRevealed: boolean
): string {
  if (!isValidPanelData(data)) {
    return getInvalidPanelHtml(webview, extensionUri, nonce);
  }

  const logo = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'code-equalize-logo.png')
  );

  const loader = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'code-equalize-loader.png')
  );

  const languageOptions = SUPPORTED_LANGUAGES.map(language => `
    <option value="${escapeHtml(language)}" ${language === data.targetLanguage ? 'selected' : ''}>${escapeHtml(language)}</option>
  `).join('');

  const issues = sortIssues(data.explanations);
  const errorCount = issues.length;
  const hasFix = !data.noIssues && data.fix.trim().length > 0;
  const codeLanguage = toCodeLanguage(data.sourceLanguage);

  const sourceLabel =
    data.source?.toLowerCase() === 'mixed'
      ? 'Mixed'
      : data.source?.toLowerCase() === 'chromadb'
        ? 'ChromaDB'
        : data.source || 'Backend';

  const cspSource = webview.cspSource;

  const resultSections = data.noIssues
    ? `
  <section class="content-section">
    <div class="content-card no-issues-card" role="status">
      <strong>No meaningful problems were found.</strong>
      <p>
        Code Equalize analysed the complete source of this file without running it
        and found no errors or likely runtime risks. This static analysis cannot
        guarantee correct behaviour for every possible input.
      </p>
    </div>
  </section>`
    : `
  <section class="content-section" aria-labelledby="why-heading">
    <h2 class="section-heading" id="why-heading">
      <span class="section-icon" aria-hidden="true">ⓘ</span>
      WHY THIS HAPPENED
    </h2>
    <div class="explanation-list" id="explanation-list">
      ${renderExplanationCards(issues)}
    </div>
  </section>

  <section class="content-section" aria-labelledby="fix-heading">
    <h2 class="section-heading" id="fix-heading">
      <span class="section-icon" aria-hidden="true">⚒</span>
      HOW TO FIX IT
    </h2>

    <div class="fix-card">
      <div class="countdown" id="countdown">
        <div class="countdown-ring" aria-hidden="true">
          <svg viewBox="0 0 72 72" width="72" height="72" focusable="false">
            <circle class="track" cx="36" cy="36" r="30"></circle>
            <circle class="progress" id="progress-circle" cx="36" cy="36" r="30"></circle>
          </svg>
          <span class="countdown-number" id="countdown-number">${COUNTDOWN_SECONDS}</span>
        </div>
        <div class="countdown-copy">
          <div class="countdown-title" id="fix-status" role="status" aria-live="polite" aria-atomic="true">
            Take a moment to read WHY THIS HAPPENED. The corrected code unlocks in ${COUNTDOWN_SECONDS} seconds.
          </div>
          <button class="secondary-button" id="reveal-button" type="button">
            Show corrected code now
          </button>
        </div>
      </div>

      <button
        class="fix-toggle"
        id="fix-toggle"
        type="button"
        aria-expanded="false"
        aria-controls="fix-content"
        hidden
      >
        <span id="fix-toggle-label">Hide corrected code</span>
        <span id="fix-arrow" aria-hidden="true">⌃</span>
      </button>

      <div class="fix-content" id="fix-content" hidden>
        ${data.correctionStatus === 'partial'
          ? `<div class="notice notice-warning" role="note">
              Some issues may not be fully corrected automatically, because the right
              fix depends on information that is not in the code. See WHAT WAS FIXED
              below before using this code.
            </div>`
          : ''}

        <p class="fix-description">
          Complete corrected version of ${escapeHtml(data.fileName || 'this file')}.
          Your original file has not been changed.
        </p>

        <div class="code-block">
          <pre class="code-pre"><code id="fix-code" class="language-${codeLanguage}">${highlightCode(data.fix, data.sourceLanguage)}</code></pre>
          <div class="code-actions">
            <span class="validation-line">${renderValidation(data.validation)}</span>
            <button
              class="copy-button"
              id="copy-button"
              type="button"
              aria-label="Copy the complete corrected source code"
            >Copy</button>
            <span class="sr-only" id="copy-status" role="status" aria-live="polite" aria-atomic="true"></span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="content-section" aria-labelledby="fixed-heading">
    <h2 class="section-heading" id="fixed-heading">
      <span class="section-icon" aria-hidden="true">✓</span>
      WHAT WAS FIXED
    </h2>
    <div class="content-card">
      <div class="locked-text" id="what-was-fixed-locked">
        Available when the corrected code is shown.
      </div>
      <div class="explanation-text" id="what-was-fixed" hidden>
        ${renderMarkdownHtml(data.whatWasFixed)}
      </div>
    </div>
  </section>

  <section class="content-section" aria-labelledby="remember-heading">
    <h2 class="section-heading" id="remember-heading">
      <span class="section-icon" aria-hidden="true">◉</span>
      REMEMBER
    </h2>
    <div class="content-card remember-card">
      <div class="explanation-text" id="remember">
        ${renderMarkdownHtml(data.remember)}
      </div>
    </div>
  </section>`;

  return `<!DOCTYPE html>
<html lang="en">

<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
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

/*
 * Theme tokens. VS Code sets body.vscode-light / vscode-dark /
 * vscode-high-contrast and updates them live when the theme changes.
 */
:root {
  --background: var(--vscode-editor-background);
  --surface: var(--vscode-sideBar-background, var(--vscode-editor-background));
  --surface-alt: var(--vscode-editorWidget-background, var(--surface));
  --border: var(--vscode-panel-border, var(--vscode-widget-border, rgba(128, 128, 128, 0.35)));
  --text: var(--vscode-foreground);
  --muted: var(--vscode-descriptionForeground);
  --code-bg: var(--vscode-textCodeBlock-background, var(--surface-alt));

  --ui-font: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", Ubuntu, sans-serif);
  --code-font: var(--vscode-editor-font-family, "Cascadia Code", Consolas, "SF Mono", Menlo, "DejaVu Sans Mono", "Courier New", monospace);

  --blue: #89b4fa;
  --green: #a6e3a1;
  --orange: #fab387;
  --red: #f38ba8;
  --purple: #cba6f7;
  --badge-bg: rgba(243, 139, 168, 0.13);
  --tag-potential-bg: rgba(250, 179, 135, 0.14);
  --tag-runtime-bg: rgba(137, 180, 250, 0.14);
  --overlay: rgba(0, 0, 0, 0.45);
}

body.vscode-dark {
  color-scheme: dark;
}

body.vscode-light {
  color-scheme: light;
  --blue: #1f5fbf;
  --green: #2e7d32;
  --orange: #b4530a;
  --red: #c4314b;
  --purple: #8e2bb5;
  --badge-bg: rgba(196, 49, 75, 0.09);
  --tag-potential-bg: rgba(180, 83, 10, 0.1);
  --tag-runtime-bg: rgba(31, 95, 191, 0.1);
  --overlay: rgba(255, 255, 255, 0.6);
}

body.vscode-high-contrast,
body.vscode-high-contrast-light {
  --blue: var(--vscode-textLink-foreground);
  --green: var(--vscode-testing-iconPassed, var(--vscode-foreground));
  --orange: var(--vscode-editorWarning-foreground, var(--vscode-foreground));
  --red: var(--vscode-errorForeground);
  --purple: var(--vscode-foreground);
  --badge-bg: transparent;
  --tag-potential-bg: transparent;
  --tag-runtime-bg: transparent;
  --border: var(--vscode-contrastBorder, var(--vscode-panel-border));
}

body.vscode-high-contrast {
  color-scheme: dark;
}

body.vscode-high-contrast-light {
  color-scheme: light;
  --overlay: rgba(255, 255, 255, 0.7);
}

* {
  box-sizing: border-box;
}

[hidden] {
  display: none !important;
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
  font-family: var(--ui-font);
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
  min-width: 0;
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

.muted {
  color: var(--muted);
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.language-label {
  color: var(--muted);
  font-size: 12px;
}

select {
  min-width: 125px;
  padding: 7px 10px;
  border: 1px solid var(--vscode-dropdown-border, var(--border));
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
button:focus-visible {
  outline: 2px solid var(--vscode-focusBorder);
  outline-offset: 2px;
}

select:disabled,
button:disabled {
  opacity: 0.6;
  cursor: wait;
}

.secondary-button,
.copy-button {
  border: 1px solid var(--vscode-button-border, var(--border));
  border-radius: 5px;
  background: var(--vscode-button-secondaryBackground, var(--surface-alt));
  color: var(--vscode-button-secondaryForeground, var(--text));
  padding: 6px 11px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.secondary-button:hover:not(:disabled),
.copy-button:hover:not(:disabled) {
  background: var(--vscode-button-secondaryHoverBackground, var(--surface));
}

.banner {
  margin-bottom: 14px;
  padding: 10px 12px;
  border: 1px solid var(--red);
  border-radius: 6px;
  background: var(--badge-bg);
  color: var(--text);
  font-size: 12px;
  overflow-wrap: anywhere;
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
  background: var(--red);
}

.heading-dot.clean {
  background: var(--green);
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
  min-width: 420px;
}

thead {
  background: var(--background);
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
  vertical-align: top;
}

tbody tr:last-child td {
  border-bottom: none;
}

td {
  font-size: 12px;
}

.index-cell {
  color: var(--muted);
  width: 38px;
}

.line-cell {
  color: var(--orange);
  font-weight: 600;
  white-space: nowrap;
  width: 56px;
  font-variant-numeric: tabular-nums;
}

.type-cell {
  width: 1%;
  white-space: nowrap;
}

.error-badge {
  display: inline-block;
  padding: 2px 8px;
  color: var(--red);
  background: var(--badge-bg);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.15px;
  white-space: nowrap;
  cursor: help;
}

.origin-tag {
  display: inline-block;
  margin-left: 4px;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
  cursor: help;
}

.origin-potential {
  color: var(--orange);
  background: var(--tag-potential-bg);
  border: 1px solid transparent;
}

.origin-runtime {
  color: var(--blue);
  background: var(--tag-runtime-bg);
  border: 1px solid transparent;
}

body.vscode-high-contrast .origin-tag,
body.vscode-high-contrast-light .origin-tag,
body.vscode-high-contrast .error-badge,
body.vscode-high-contrast-light .error-badge {
  border: 1px solid currentColor;
}

.error-message {
  min-width: 150px;
  overflow-wrap: anywhere;
  line-height: 1.55;
}

.original-message {
  margin-top: 3px;
  color: var(--muted);
  font-family: var(--code-font);
  font-size: 11px;
}

.empty-row {
  color: var(--muted);
  text-align: center;
  padding: 16px;
}

.content-section {
  margin-bottom: 17px;
}

.section-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 0 11px;
  margin: 0 0 10px;
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
  gap: 12px;
}

.explanation-card-block {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  padding: 12px 16px 14px;
}

.explanation-card-header {
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
  padding: 1px 6px;
}

.content-card {
  padding: 15px 18px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  font-size: 13px;
  line-height: 1.8;
}

.no-issues-card strong {
  color: var(--green);
}

.no-issues-card p {
  margin: 6px 0 0;
  color: var(--muted);
}

.locked-text {
  color: var(--muted);
  font-style: italic;
}

/* Markdown formatting inside explanations */

.explanation-text {
  font-size: 13px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}

.explanation-text h2,
.explanation-text h3,
.explanation-text h4 {
  margin: 14px 0 6px;
  color: var(--text);
  font-weight: 700;
  line-height: 1.5;
}

.explanation-text h2 {
  font-size: 15px;
}

.explanation-text h3 {
  font-size: 14px;
}

.explanation-text h4 {
  font-size: 13px;
}

.explanation-text p {
  margin: 0 0 10px;
}

.explanation-text p:last-child {
  margin-bottom: 0;
}

.explanation-text ul,
.explanation-text ol {
  margin: 4px 0 8px;
  padding-left: 22px;
}

.explanation-text li {
  margin-bottom: 4px;
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
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--code-bg);
  color: var(--orange);
  font-family: var(--code-font);
  font-size: 0.92em;
}

.explanation-text .markdown-code {
  margin: 10px 0;
  padding: 12px;
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--background);
}

.explanation-text .markdown-code code {
  font-family: var(--code-font);
  font-size: 12px;
  line-height: 1.7;
  white-space: pre;
}

.fix-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px;
  background: var(--surface);
}

/* Circular 15-second countdown */

.countdown {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.countdown-ring {
  position: relative;
  width: 72px;
  height: 72px;
  flex-shrink: 0;
}

.countdown-ring svg {
  transform: rotate(-90deg);
  display: block;
}

.countdown-ring .track {
  fill: none;
  stroke: var(--border);
  stroke-width: 5;
}

.countdown-ring .progress {
  fill: none;
  stroke: hsl(0, 75%, 52%);
  stroke-width: 5;
  stroke-linecap: round;
  stroke-dasharray: 188.5;
  stroke-dashoffset: 0;
  transition: stroke-dashoffset 1s linear, stroke 1s linear;
}

.countdown-number {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.countdown-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
  flex: 1 1 220px;
}

.countdown-title {
  color: var(--muted);
  font-size: 12px;
}

.fix-toggle {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--surface-alt);
  color: var(--text);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.fix-content {
  margin-top: 12px;
}

.fix-description {
  color: var(--muted);
  margin: 0 0 10px;
  font-size: 12px;
}

.notice {
  margin: 0 0 10px;
  padding: 9px 12px;
  border-radius: 6px;
  font-size: 12px;
}

.notice-warning {
  border: 1px solid var(--orange);
  background: var(--tag-potential-bg);
}

.code-block {
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--background);
  overflow: hidden;
}

.code-pre {
  margin: 0;
  padding: 14px;
  overflow-x: auto;
  font-family: var(--code-font);
  font-size: var(--vscode-editor-font-size, 12px);
  line-height: 1.7;
  white-space: pre;
  tab-size: 4;
}

.code-pre code {
  font-family: inherit;
}

.tok-keyword { color: var(--purple); }
.tok-string { color: var(--green); }
.tok-comment { color: var(--muted); font-style: italic; }
.tok-number { color: var(--orange); }
.tok-function { color: var(--blue); }
.tok-type { color: var(--orange); }
.tok-preproc { color: var(--red); }

.code-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-top: 1px solid var(--border);
  flex-wrap: wrap;
}

.validation-line {
  color: var(--muted);
  font-size: 11px;
  min-width: 0;
  flex: 1 1 260px;
}

.validation-passed {
  color: var(--green);
}

.validation-failed {
  color: var(--red);
}

.validation-detail {
  margin: 4px 0;
  white-space: pre-wrap;
  font-family: var(--code-font);
  font-size: 11px;
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
  background: var(--overlay);
  backdrop-filter: blur(1px);
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
  color: var(--text);
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 5px;
  background: var(--surface);
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
    align-items: stretch;
    flex-direction: column;
  }

  .toolbar-actions {
    justify-content: space-between;
  }
}

@media (prefers-reduced-motion: reduce) {
  .countdown-ring .progress {
    transition: none;
  }
}

</style>
</head>

<body>

<div class="loader-overlay" id="loader">
  <img class="loader-image" src="${loader}" alt="">
  <div class="loader-text" id="loader-text" role="status" aria-live="polite">
    Generating your explanation...
  </div>
</div>

<div class="container">

  <header class="header">
    <div class="brand">
      <img class="logo" src="${logo}" alt="Code Equalize logo">
      <div>
        <div class="brand-name">Code Equalize</div>
        <div class="brand-subtitle">Understand errors. Learn better. Code confidently.</div>
      </div>
    </div>

    <div class="status-group">
      <div
        class="status status-error"
        title="${escapeHtml(getCombinedOriginTooltip(issues))}"
        aria-label="${escapeHtml(getCombinedOriginTooltip(issues))}"
      >
        <span class="status-indicator"></span>
        <span>${escapeHtml(getCombinedOrigin(issues))}</span>
      </div>

      <div class="status status-source" title="${escapeHtml(getSourceTooltip(data.source))}">
        <span class="status-indicator green"></span>
        <span>${escapeHtml(sourceLabel)}</span>
      </div>
    </div>
  </header>

  <div class="toolbar">
    <div class="file-info">
      <span aria-hidden="true">▤</span>
      <span class="file-name">${escapeHtml(data.fileName || 'Current File')}</span>
      <span class="muted" aria-hidden="true">·</span>
      <span aria-label="Source programming language">${escapeHtml(data.sourceLanguage || 'Source language unavailable')}</span>
    </div>

    <div class="toolbar-actions">
      <label class="language-label" for="language">Explanation language</label>
      <select id="language" aria-label="Explanation language">
        ${languageOptions}
      </select>
      <button
        class="secondary-button"
        id="reanalyze-button"
        type="button"
        title="Analyse the latest content of this file again"
      >↻ Re-analyse</button>
    </div>
  </div>

  <div class="banner" id="banner" role="alert" hidden></div>

  <section class="error-panel" aria-labelledby="errors-heading">
    <div class="panel-heading">
      <span class="heading-left" id="errors-heading">
        <span class="heading-dot${errorCount === 0 ? ' clean' : ''}"></span>
        Detected Errors
      </span>
      <span class="count-label">
        ${errorCount} issue${errorCount === 1 ? '' : 's'} detected
      </span>
    </div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Line</th>
            <th scope="col">Error Type</th>
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          ${renderErrorRows(issues)}
        </tbody>
      </table>
    </div>
  </section>

  ${resultSections}

  <footer class="footer">
    <img class="footer-logo" src="${logo}" alt="Code Equalize">
    <span>© 2026 Code Equalize. All rights reserved.</span>
  </footer>

</div>

<div class="sr-only" id="action-status" role="status" aria-live="polite" aria-atomic="true"></div>

<script nonce="${nonce}">
(function () {
  const vscode = acquireVsCodeApi();

  const TOKEN = ${JSON.stringify(nonce)};
  const COUNTDOWN_SECONDS = ${COUNTDOWN_SECONDS};
  const CIRCUMFERENCE = 2 * Math.PI * 30;
  const HAS_FIX = ${hasFix ? 'true' : 'false'};
  const START_REVEALED = ${startRevealed ? 'true' : 'false'};
  const SUPPORTED = ${JSON.stringify(SUPPORTED_LANGUAGES)};

  let currentLanguage = ${JSON.stringify(data.targetLanguage)};

  const byId = function (id) { return document.getElementById(id); };

  const languageSelect = byId('language');
  const reanalyzeButton = byId('reanalyze-button');
  const loader = byId('loader');
  const loaderText = byId('loader-text');
  const banner = byId('banner');
  const actionStatus = byId('action-status');

  const countdownBox = byId('countdown');
  const countdownNumber = byId('countdown-number');
  const progressCircle = byId('progress-circle');
  const fixStatus = byId('fix-status');
  const revealButton = byId('reveal-button');
  const fixToggle = byId('fix-toggle');
  const fixToggleLabel = byId('fix-toggle-label');
  const fixArrow = byId('fix-arrow');
  const fixContent = byId('fix-content');
  const copyButton = byId('copy-button');
  const copyStatus = byId('copy-status');
  const whatWasFixed = byId('what-was-fixed');
  const whatWasFixedLocked = byId('what-was-fixed-locked');

  let countdownTimer = null;
  let remaining = COUNTDOWN_SECONDS;
  let unlocked = false;
  let languageSequence = 0;
  let activeLanguageRequestId = null;
  let copySequence = 0;
  let pendingCopyRequestId = null;
  let copyFeedbackTimer = null;

  function post(message) {
    message.token = TOKEN;
    vscode.postMessage(message);
  }

  function showBanner(text) {
    banner.textContent = text;
    banner.hidden = !text;
  }

  function setBusy(busy, text) {
    loader.classList.toggle('visible', busy);
    if (text) {
      loaderText.textContent = text;
    }
    languageSelect.disabled = busy;
    reanalyzeButton.disabled = busy;
  }

  /* ---------- Countdown and reveal ---------- */

  function clearCountdown() {
    if (countdownTimer !== null) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  function drawRing(secondsLeft) {
    const fraction = secondsLeft / COUNTDOWN_SECONDS;
    // Red (0) -> yellow (60) -> green (120) as the countdown progresses.
    const hue = Math.round(120 * (1 - fraction));
    progressCircle.style.strokeDashoffset =
      String(CIRCUMFERENCE * (1 - fraction));
    progressCircle.style.stroke = 'hsl(' + hue + ', 75%, 48%)';
    countdownNumber.textContent = String(secondsLeft);
  }

  function setFixVisible(visible) {
    fixContent.hidden = !visible;
    fixToggle.setAttribute('aria-expanded', String(visible));
    fixToggleLabel.textContent = visible
      ? 'Hide corrected code'
      : 'Show corrected code';
    fixArrow.textContent = visible ? '⌃' : '⌄';
  }

  function unlock(announce) {
    if (unlocked) {
      return;
    }

    clearCountdown();
    unlocked = true;

    countdownBox.hidden = true;
    fixToggle.hidden = false;
    setFixVisible(true);

    whatWasFixed.hidden = false;
    whatWasFixedLocked.hidden = true;

    if (announce) {
      actionStatus.textContent = 'The corrected code is now shown.';
    }

    post({ command: 'revealed' });
  }

  function startCountdown() {
    clearCountdown();
    remaining = COUNTDOWN_SECONDS;
    drawRing(remaining);

    countdownTimer = setInterval(function () {
      if (unlocked) {
        clearCountdown();
        return;
      }

      remaining = Math.max(0, remaining - 1);
      drawRing(remaining);

      if (remaining === 5) {
        fixStatus.textContent = 'The corrected code unlocks in 5 seconds.';
      }

      if (remaining === 0) {
        unlock(true);
      }
    }, 1000);
  }

  if (HAS_FIX) {
    revealButton.addEventListener('click', function () {
      unlock(true);
      copyButton.focus();
    });

    fixToggle.addEventListener('click', function () {
      if (unlocked) {
        setFixVisible(fixContent.hidden);
      }
    });

    if (START_REVEALED) {
      unlock(false);
    } else {
      startCountdown();
    }
  }

  /* ---------- Copy ---------- */

  function showCopyFeedback(label, announcement) {
    if (copyFeedbackTimer !== null) {
      clearTimeout(copyFeedbackTimer);
    }

    copyButton.disabled = false;
    copyButton.textContent = label;
    copyStatus.textContent = announcement;

    copyFeedbackTimer = setTimeout(function () {
      copyButton.textContent = 'Copy';
      copyStatus.textContent = '';
      copyFeedbackTimer = null;
    }, 1800);
  }

  if (copyButton) {
    copyButton.addEventListener('click', function () {
      if (!unlocked || copyButton.disabled) {
        return;
      }

      const requestId = TOKEN + '-copy-' + String(++copySequence);
      pendingCopyRequestId = requestId;
      copyButton.disabled = true;
      copyButton.textContent = 'Copying...';

      try {
        post({ command: 'copyFix', requestId: requestId });
      } catch (error) {
        pendingCopyRequestId = null;
        showCopyFeedback('Copy failed', 'Could not copy the code.');
      }
    });
  }

  /* ---------- Language and re-analysis ---------- */

  function finishLanguageRequest(requestId, message) {
    if (requestId !== activeLanguageRequestId) {
      return false;
    }

    activeLanguageRequestId = null;
    setBusy(false);
    languageSelect.value = currentLanguage;
    showBanner(message);
    actionStatus.textContent = message;
    return true;
  }

  languageSelect.addEventListener('change', function () {
    const requested = languageSelect.value;

    if (
      SUPPORTED.indexOf(requested) === -1 ||
      requested === currentLanguage ||
      activeLanguageRequestId !== null
    ) {
      languageSelect.value = currentLanguage;
      return;
    }

    const requestId = TOKEN + '-language-' + String(++languageSequence);
    activeLanguageRequestId = requestId;
    showBanner('');
    setBusy(true, 'Generating explanations in ' + requested + '...');

    try {
      post({ command: 'changeLanguage', language: requested, requestId: requestId });
    } catch (error) {
      finishLanguageRequest(
        requestId,
        'Could not change the explanation language. The previous explanation is still shown.'
      );
    }
  });

  reanalyzeButton.addEventListener('click', function () {
    if (reanalyzeButton.disabled) {
      return;
    }
    showBanner('');
    post({ command: 'reanalyze' });
  });

  /* ---------- Messages from the extension ---------- */

  window.addEventListener('message', function (event) {
    const message = event.data;

    if (!message || typeof message !== 'object' || typeof message.command !== 'string') {
      return;
    }

    if (message.command === 'loading') {
      showBanner('');
      setBusy(true, typeof message.text === 'string' ? message.text : 'Analysing...');
      return;
    }

    if (message.command === 'analysisError') {
      setBusy(false);
      const text = typeof message.error === 'string' && message.error.trim()
        ? message.error
        : 'The analysis failed. The previous results are still shown.';
      showBanner(text);
      actionStatus.textContent = text;
      return;
    }

    if (message.command === 'error') {
      const text = typeof message.error === 'string' && message.error.trim()
        ? message.error
        : 'Could not change the explanation language. The previous explanation is still shown.';
      finishLanguageRequest(message.requestId, text);
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
          ? 'Corrected code copied to the clipboard.'
          : 'Could not copy the code.'
      );
    }
  });

  window.addEventListener('pagehide', function () {
    clearCountdown();
    if (copyFeedbackTimer !== null) {
      clearTimeout(copyFeedbackTimer);
      copyFeedbackTimer = null;
    }
  });
})();
</script>

</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/* Panel controller: one panel per analysed file                        */
/* ------------------------------------------------------------------ */

/**
 * One Code Equalize panel bound to one document URI. Each panel keeps its
 * own results, language, countdown and request identity, so analysing a
 * second file never overwrites the first file's panel.
 */
export class CodeEqualizePanel {
  private static readonly panels = new Map<string, CodeEqualizePanel>();

  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];
  private nonce = '';
  private data: PanelData | undefined;
  private handlers: PanelHandlers | undefined;
  private revealedAnalysisId: string | undefined;
  private latestLanguageSequence = 0;
  private latestLanguageRequestId: string | undefined;
  private disposed = false;

  static get(key: string): CodeEqualizePanel | undefined {
    return CodeEqualizePanel.panels.get(key);
  }

  static getOrCreate(
    key: string,
    fileName: string,
    extensionUri: vscode.Uri
  ): CodeEqualizePanel {
    const existing = CodeEqualizePanel.panels.get(key);

    if (existing && !existing.disposed) {
      return existing;
    }

    const created = new CodeEqualizePanel(key, fileName, extensionUri);
    CodeEqualizePanel.panels.set(key, created);
    return created;
  }

  private constructor(
    private readonly key: string,
    fileName: string,
    private readonly extensionUri: vscode.Uri
  ) {
    this.panel = vscode.window.createWebviewPanel(
      'codeEqualize',
      `Code Equalize: ${fileName}`,
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false },
      {
        enableScripts: true,
        // Keeps each panel's countdown, reveal and language state while
        // the tab is in the background.
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media')
        ]
      }
    );

    this.panel.iconPath = vscode.Uri.joinPath(
      extensionUri,
      'media',
      'code-equalize-icon.png'
    );

    this.disposables.push(
      this.panel.onDidDispose(() => this.handleDispose()),
      this.panel.webview.onDidReceiveMessage(message =>
        this.handleMessage(message)
      )
    );
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  get currentData(): PanelData | undefined {
    return this.data;
  }

  reveal(): void {
    if (!this.disposed) {
      this.panel.reveal(this.panel.viewColumn ?? vscode.ViewColumn.Beside);
    }
  }

  /**
   * Shows a complete analysis result. A new nonce invalidates every
   * message, timer and pending request that belonged to the previous page.
   */
  render(data: PanelData, handlers: PanelHandlers): void {
    if (this.disposed) {
      return;
    }

    this.data = data;
    this.handlers = handlers;
    this.nonce = getNonce();
    this.latestLanguageSequence = 0;
    this.latestLanguageRequestId = undefined;

    if (data.fileName) {
      this.panel.title = `Code Equalize: ${data.fileName}`;
    }

    this.panel.webview.html = getPanelHtml(
      this.panel.webview,
      this.extensionUri,
      data,
      this.nonce,
      this.revealedAnalysisId === data.analysisId
    );
  }

  /** Shows the loading overlay over the current results. */
  showLoading(text: string): void {
    if (!this.disposed && this.data) {
      void this.panel.webview.postMessage({ command: 'loading', text });
    }
  }

  /** Ends a loading state with an error; previous results stay visible. */
  showAnalysisError(message: string): void {
    if (!this.disposed && this.data) {
      void this.panel.webview.postMessage({
        command: 'analysisError',
        error: message
      });
    }
  }

  private isCurrentToken(message: Record<string, unknown>): boolean {
    return typeof message.token === 'string' &&
      message.token === this.nonce;
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (
      this.disposed ||
      !isRecord(message) ||
      typeof message.command !== 'string' ||
      !this.isCurrentToken(message)
    ) {
      return;
    }

    switch (message.command) {
      case 'changeLanguage':
        await this.handleLanguageChange(message);
        return;

      case 'copyFix':
        await this.handleCopy(message);
        return;

      case 'revealed':
        if (this.data) {
          this.revealedAnalysisId = this.data.analysisId;
        }
        return;

      case 'reanalyze':
        this.handlers?.onReanalyze();
        return;

      default:
        return;
    }
  }

  private async handleLanguageChange(
    message: Record<string, unknown>
  ): Promise<void> {
    const requestId = message.requestId;
    const prefix = `${this.nonce}-language-`;

    if (
      typeof requestId !== 'string' ||
      !requestId.startsWith(prefix)
    ) {
      return;
    }

    const sequenceText = requestId.slice(prefix.length);
    const sequence = Number(sequenceText);

    if (
      !/^[1-9]\d*$/.test(sequenceText) ||
      !Number.isSafeInteger(sequence) ||
      sequence <= this.latestLanguageSequence
    ) {
      return;
    }

    this.latestLanguageSequence = sequence;
    this.latestLanguageRequestId = requestId;

    const nonceAtRequest = this.nonce;
    const handlers = this.handlers;
    const isStillCurrent = (): boolean =>
      !this.disposed &&
      this.nonce === nonceAtRequest &&
      this.latestLanguageRequestId === requestId;

    try {
      if (
        typeof message.language !== 'string' ||
        !SUPPORTED_LANGUAGES.includes(message.language) ||
        !handlers
      ) {
        throw new Error('Unsupported explanation language.');
      }

      const updated = await handlers.onLanguageChange(message.language);

      if (!isStillCurrent()) {
        return;
      }

      if (
        !isValidPanelData(updated) ||
        updated.targetLanguage !== message.language ||
        updated.analysisId !== this.data?.analysisId
      ) {
        throw new Error(
          'The explanation service returned invalid data for this language.'
        );
      }

      this.render(updated, handlers);
    } catch (error) {
      if (!isStillCurrent()) {
        return;
      }

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Could not generate the explanation.';

      await this.panel.webview.postMessage({
        command: 'error',
        error: `Could not switch the explanation language: ${errorMessage} The previous explanation is still shown.`,
        requestId
      });
    }
  }

  private async handleCopy(
    message: Record<string, unknown>
  ): Promise<void> {
    const requestId = message.requestId;

    if (
      typeof requestId !== 'string' ||
      !requestId.startsWith(`${this.nonce}-copy-`)
    ) {
      return;
    }

    // Copy the authoritative corrected source held by the extension for
    // the analysis currently shown — never text scraped from the page.
    const code = this.data?.fix ?? '';
    let success = false;

    try {
      if (!code.trim()) {
        throw new Error('There is no code to copy.');
      }

      await vscode.env.clipboard.writeText(code);
      success = true;
    } catch (error) {
      console.error('[Code Equalize] Code copy failed:', error);
    }

    if (!this.disposed) {
      await this.panel.webview.postMessage({
        command: 'copyResult',
        success,
        requestId
      });
    }
  }

  private handleDispose(): void {
    this.disposed = true;
    this.data = undefined;
    this.handlers = undefined;

    if (CodeEqualizePanel.panels.get(this.key) === this) {
      CodeEqualizePanel.panels.delete(this.key);
    }

    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
  }
}
