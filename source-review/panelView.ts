// import * as vscode from "vscode";

// type PanelData = {
//   explanation: string;
//   fix: string;
//   remember?: string | null;
//   source: "AI" | "ChromaDB" | string;
//   matchedError?: string;
//   similarity?: number | null;
//   errorType?: 'diagnostic' | 'runtime';
// };

// export function showPanel(data: PanelData): void {
//   const panel = vscode.window.createWebviewPanel(
//     "codeEqualize",
//     "Code Equalize",
//     vscode.ViewColumn.Beside,
//     { enableScripts: true }
//   );
//   panel.webview.html = getWebviewContent(data);
// }

// function escapeHtml(text: string): string {
//   return text
//     .replace(/&/g, "&amp;")
//     .replace(/</g, "&lt;")
//     .replace(/>/g, "&gt;");
// }

// /**
//  * Renders markdown to HTML.
//  * Code blocks (``` ... ```) get a copy button injected.
//  */
// function renderMarkdown(text: string): string {
//   if (!text) return "";

//   // We'll process code blocks separately (before escaping the rest)
//   // Split on fenced code blocks first
//   const parts: string[] = [];
//   let codeBlockIndex = 0;
//   const codeBlockRegex = /```[\w]*\n?([\s\S]*?)```/g;
//   let lastIndex = 0;
//   let match: RegExpExecArray | null;

//   while ((match = codeBlockRegex.exec(text)) !== null) {
//     // plain text before this block
//     const before = text.slice(lastIndex, match.index);
//     parts.push({ type: 'text', content: before } as any);
//     parts.push({ type: 'code', content: match[1], index: codeBlockIndex++ } as any);
//     lastIndex = match.index + match[0].length;
//   }
//   // remaining text
//   parts.push({ type: 'text', content: text.slice(lastIndex) } as any);

//   return (parts as any[]).map((part) => {
//     if (part.type === 'code') {
//       const escaped = escapeHtml(part.content.trimEnd());
//       // Encode for data attribute (base64-safe via encodeURIComponent)
//       const encoded = encodeURIComponent(part.content.trimEnd());
//       return `<div class="code-block-wrap">
//   <button class="copy-btn" onclick="copyCode(this, '${encoded}')" title="Copy code">
//     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
//       <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
//     </svg>
//     Copy
//   </button>
//   <pre><code>${escaped}</code></pre>
// </div>`;
//     } else {
//       // normal text: escape then light markdown
//       const escaped = escapeHtml(part.content);
//       return escaped
//         .replace(/`([^`]+)`/g, "<code class=\"inline\">$1</code>")
//         .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
//         .replace(/\n/g, "<br>");
//     }
//   }).join('').trim();
// }

// function getWebviewContent(data: PanelData): string {
//   const isChroma = data.source === "ChromaDB";
//   const isRuntime = data.errorType === "runtime";

//   const errorTypeTooltip = isRuntime
//     ? "Runtime Error: occurs while the program is running — e.g. null pointer, division by zero, stack overflow."
//     : "Diagnostic Error: caught by the language server before your code runs — e.g. syntax error or type mismatch.";

//   const sourceTooltip = isChroma
//     ? "ChromaDB: explanation retrieved from the local error knowledge base using vector similarity search. A past solution matched your error."
//     : "AI Generated: no close match in the knowledge base, so Groq AI (LLaMA) generated this explanation fresh from your code.";

//   const errorTypeBadge = isRuntime
//     ? `<span class="badge badge-runtime" data-tooltip="${errorTypeTooltip}">⚡ Runtime Error</span>`
//     : `<span class="badge badge-diagnostic" data-tooltip="${errorTypeTooltip}">🔍 Diagnostic Error</span>`;

//   const sourceBadge = isChroma
//     ? `<span class="badge badge-chroma" data-tooltip="${sourceTooltip}">📚 ChromaDB</span>`
//     : `<span class="badge badge-ai" data-tooltip="${sourceTooltip}">🤖 AI Generated</span>`;

//   const matchedHtml = isChroma && data.matchedError
//     ? `<div class="matched-bar">
//         <span class="matched-dot"></span>
//         <span class="matched-label">Matched:</span>
//         <code class="matched-value">${escapeHtml(data.matchedError)}</code>
//        </div>`
//     : "";

//   const rememberHtml = data.remember
//     ? `<div class="section">
//         <div class="section-label amber-label">
//           <span class="label-icon">💡</span>
//           <span>Remember for Next Time</span>
//         </div>
//         <div class="card card-remember">${renderMarkdown(data.remember)}</div>
//        </div>`
//     : "";

//   const fixHtml = renderMarkdown(data.fix);

//   return `<!DOCTYPE html>
// <html lang="en">
// <head>
// <meta charset="UTF-8">
// <meta name="viewport" content="width=device-width, initial-scale=1.0">
// <style>
//   :root {
//     --bg:             var(--vscode-editor-background);
//     --fg:             var(--vscode-editor-foreground);
//     --fg-muted:       var(--vscode-descriptionForeground, #8b949e);
//     --border:         var(--vscode-panel-border, rgba(128,128,128,.18));
//     --surface:        var(--vscode-editorWidget-background, rgba(128,128,128,.06));
//     --code-bg:        var(--vscode-textCodeBlock-background, rgba(0,0,0,.22));
//     --blue:           #4FC1FF;
//     --blue-dim:       rgba(79,193,255,.10);
//     --blue-border:    rgba(79,193,255,.28);
//     --blue-label:     rgba(79,193,255,.15);
//     --green:          #4EC994;
//     --green-dim:      rgba(78,201,148,.10);
//     --green-border:   rgba(78,201,148,.28);
//     --green-label:    rgba(78,201,148,.15);
//     --amber:          #E5A11C;
//     --amber-dim:      rgba(229,161,28,.10);
//     --amber-border:   rgba(229,161,28,.28);
//     --amber-label:    rgba(229,161,28,.15);
//     --purple:         #C586C0;
//     --purple-dim:     rgba(197,134,192,.10);
//     --purple-border:  rgba(197,134,192,.28);
//     --radius:         9px;
//     --font-ui:        var(--vscode-font-family, -apple-system, "Segoe UI", sans-serif);
//     --font-mono:      var(--vscode-editor-font-family, "Cascadia Code", Consolas, monospace);
//   }

//   * { box-sizing: border-box; margin: 0; padding: 0; }
//   body {
//     font-family: var(--font-ui);
//     font-size: 13.5px;
//     background: var(--bg);
//     color: var(--fg);
//     line-height: 1.75;
//     padding-bottom: 48px;
//   }

//   /* ── Header ── */
//   .header {
//     padding: 18px 20px 16px;
//     border-bottom: 1px solid var(--border);
//     background: linear-gradient(135deg,
//       rgba(79,193,255,.06) 0%,
//       rgba(78,201,148,.04) 60%,
//       transparent 100%);
//   }
//   .header-top {
//     display: flex;
//     align-items: center;
//     justify-content: space-between;
//     gap: 10px; flex-wrap: wrap;
//     margin-bottom: 12px;
//   }
//   .header-title {
//     display: flex; align-items: center; gap: 10px;
//     font-size: 16px; font-weight: 700; letter-spacing: -.025em;
//   }
//   .logo-icon {
//     width: 32px; height: 32px; border-radius: 8px;
//     background: linear-gradient(135deg, var(--blue-dim), var(--green-dim));
//     border: 1px solid var(--blue-border);
//     display: flex; align-items: center; justify-content: center;
//     font-size: 16px; flex-shrink: 0;
//   }
//   .header-badges { display: flex; gap: 7px; flex-wrap: wrap; }

//   /* ── Badges ── */
//   .badge {
//     position: relative;
//     display: inline-flex; align-items: center; gap: 5px;
//     padding: 4px 11px; border-radius: 99px;
//     font-size: 11px; font-weight: 600; letter-spacing: .03em;
//     border: 1px solid transparent;
//     cursor: default;
//     transition: filter .15s, transform .15s;
//     user-select: none;
//   }
//   .badge:hover { filter: brightness(1.15); transform: translateY(-1px); }
//   .badge-runtime    { color: var(--amber);  background: var(--amber-dim);  border-color: var(--amber-border); }
//   .badge-diagnostic { color: var(--blue);   background: var(--blue-dim);   border-color: var(--blue-border); }
//   .badge-chroma     { color: var(--green);  background: var(--green-dim);  border-color: var(--green-border); }
//   .badge-ai         { color: var(--purple); background: var(--purple-dim); border-color: var(--purple-border); }

//   /* tooltip */
//   .badge::after {
//     content: attr(data-tooltip);
//     position: absolute; top: calc(100% + 7px); right: 0;
//     width: 230px;
//     background: var(--vscode-editorHoverWidget-background, #1e1e2e);
//     color: var(--fg); border: 1px solid var(--border);
//     border-radius: 7px; padding: 9px 12px;
//     font-size: 11.5px; font-weight: 400; line-height: 1.55;
//     letter-spacing: 0; white-space: normal;
//     z-index: 99; opacity: 0; pointer-events: none;
//     transform: translateY(4px);
//     transition: opacity .18s, transform .18s;
//     box-shadow: 0 4px 18px rgba(0,0,0,.35);
//   }
//   .badge:hover::after { opacity: 1; transform: translateY(0); }

//   /* ── Matched bar ── */
//   .matched-bar {
//     display: flex; align-items: center; gap: 8px;
//     padding: 8px 13px; border-radius: var(--radius);
//     background: var(--green-dim); border: 1px solid var(--green-border);
//     font-size: 12px;
//   }
//   .matched-dot {
//     width: 7px; height: 7px; border-radius: 50%;
//     background: var(--green); box-shadow: 0 0 6px var(--green); flex-shrink: 0;
//   }
//   .matched-label { color: var(--fg-muted); font-weight: 600; flex-shrink: 0; }
//   .matched-value {
//     font-family: var(--font-mono); font-size: 11.5px; color: var(--green);
//     background: none; border: none; padding: 0;
//   }

//   /* ── Body ── */
//   .body { padding: 20px 20px 0; display: flex; flex-direction: column; gap: 20px; }

//   /* ── Section label pills ── */
//   .section-label {
//     display: flex; align-items: center; gap: 8px;
//     margin-bottom: 9px;
//     font-size: 10.5px; font-weight: 700; letter-spacing: .1em;
//     text-transform: uppercase;
//     padding: 5px 10px; border-radius: 6px; width: fit-content;
//     color: var(--fg-muted);
//     background: var(--surface); border: 1px solid var(--border);
//   }
//   .blue-label  { color: var(--blue);  background: var(--blue-label);  border-color: var(--blue-border); }
//   .green-label { color: var(--green); background: var(--green-label); border-color: var(--green-border); }
//   .amber-label { color: var(--amber); background: var(--amber-label); border-color: var(--amber-border); }
//   .label-icon { font-size: 13px; }

//   /* ── Cards ── */
//   .card {
//     background: var(--surface); border: 1px solid var(--border);
//     border-radius: var(--radius); padding: 15px 18px;
//     font-size: 13.5px; line-height: 1.8;
//     transition: border-color .2s;
//   }
//   .card:hover { border-color: rgba(128,128,128,.32); }
//   .card-explanation {
//     border-left: 3px solid var(--blue);
//     background: var(--blue-dim); border-color: var(--blue-border);
//   }
//   .card-fix {
//     border-left: 3px solid var(--green);
//     background: var(--green-dim); border-color: var(--green-border);
//   }
//   .card-remember {
//     border-left: 3px solid var(--amber);
//     background: var(--amber-dim); border-color: var(--amber-border);
//   }

//   /* ── Code blocks with copy button ── */
//   .code-block-wrap {
//     position: relative;
//     margin: 12px 0 4px;
//   }
//   .code-block-wrap pre {
//     margin: 0;
//     background: var(--code-bg);
//     border: 1px solid var(--border);
//     border-radius: var(--radius);
//     padding: 13px 15px;
//     overflow-x: auto;
//     font-size: 12.5px; line-height: 1.6;
//     padding-top: 38px; /* room for copy button */
//   }
//   .copy-btn {
//     position: absolute;
//     top: 8px; right: 8px;
//     display: inline-flex; align-items: center; gap: 5px;
//     padding: 4px 10px;
//     background: var(--surface);
//     border: 1px solid var(--border);
//     border-radius: 5px;
//     color: var(--fg-muted);
//     font-family: var(--font-ui);
//     font-size: 11px; font-weight: 600;
//     cursor: pointer;
//     transition: background .15s, color .15s, border-color .15s;
//     z-index: 2;
//   }
//   .copy-btn:hover {
//     background: var(--green-dim);
//     color: var(--green);
//     border-color: var(--green-border);
//   }
//   .copy-btn.copied {
//     background: var(--green-dim);
//     color: var(--green);
//     border-color: var(--green-border);
//   }

//   code { font-family: var(--font-mono); font-size: 12.5px; }
//   code.inline {
//     background: rgba(128,128,128,.14);
//     padding: 2px 6px; border-radius: 4px;
//     font-size: 12px; border: 1px solid var(--border);
//   }
//   pre code { background: none; border: none; padding: 0; }

//   /* ── Fix locked state ── */
//   .fix-locked {
//     border-radius: var(--radius);
//     border: 1px dashed var(--border);
//     background: var(--surface);
//     padding: 26px 20px 22px; text-align: center;
//   }
//   .countdown-ring {
//     position: relative; width: 72px; height: 72px; margin: 0 auto 14px;
//   }
//   .countdown-ring svg { transform: rotate(-90deg); }
//   .countdown-ring .track { fill: none; stroke: var(--border); stroke-width: 4; }
//   .countdown-ring .progress {
//     fill: none; stroke: var(--green); stroke-width: 4;
//     stroke-linecap: round; stroke-dasharray: 188.5; stroke-dashoffset: 0;
//     transition: stroke-dashoffset 1s linear, stroke .4s;
//   }
//   .countdown-number {
//     position: absolute; inset: 0;
//     display: flex; align-items: center; justify-content: center;
//     font-size: 21px; font-weight: 700; color: var(--green);
//     font-variant-numeric: tabular-nums; transition: color .4s;
//   }
//   .fix-locked-title { font-size: 13.5px; font-weight: 600; margin-bottom: 5px; }
//   .fix-locked-sub {
//     font-size: 12px; color: var(--fg-muted); line-height: 1.6;
//     max-width: 270px; margin: 0 auto;
//   }
//   .fix-progress-bar {
//     height: 2px; border-radius: 99px;
//     background: var(--border); margin-top: 16px; overflow: hidden;
//   }
//   .fix-progress-fill {
//     height: 100%; width: 100%;
//     background: linear-gradient(90deg, var(--blue), var(--green));
//     border-radius: 99px; transform-origin: left; transform: scaleX(1);
//     transition: transform 1s linear;
//   }

//   /* ── Toggle dropdown button (shown after timer) ── */
//   .fix-toggle-btn {
//     display: none;
//     width: 100%;
//     align-items: center;
//     justify-content: space-between;
//     padding: 12px 18px;
//     border-radius: var(--radius);
//     border: 1px solid var(--green-border);
//     background: var(--green-dim);
//     color: var(--green);
//     font-family: var(--font-ui);
//     font-size: 13.5px; font-weight: 600;
//     cursor: pointer;
//     transition: background .2s, box-shadow .2s;
//     letter-spacing: .01em;
//   }
//   .fix-toggle-btn:hover {
//     background: rgba(78,201,148,.2);
//     box-shadow: 0 0 14px rgba(78,201,148,.18);
//   }
//   .fix-toggle-btn.visible { display: flex; }
//   .fix-toggle-left { display: flex; align-items: center; gap: 8px; }
//   .fix-toggle-chevron {
//     display: inline-flex;
//     transition: transform .3s ease;
//     flex-shrink: 0;
//   }
//   .fix-toggle-chevron.open { transform: rotate(180deg); }

//   /* ── Fix card collapsible wrapper ── */
//   .fix-collapse {
//     display: grid;
//     grid-template-rows: 0fr;
//     transition: grid-template-rows .3s ease;
//     margin-top: 8px;
//   }
//   .fix-collapse.open { grid-template-rows: 1fr; }
//   .fix-collapse-inner { overflow: hidden; }

//   /* ── Footer ── */
//   .footer {
//     margin-top: 28px; padding: 13px 20px 0;
//     border-top: 1px solid var(--border);
//     display: flex; align-items: center; justify-content: center;
//     gap: 8px; font-size: 11px; color: var(--fg-muted);
//     opacity: .5; letter-spacing: .05em;
//   }
// </style>
// </head>
// <body>

// <div class="header">
//   <div class="header-top">
//     <div class="header-title">
//       <div class="logo-icon">⚖️</div>
//       Code Equalize
//     </div>
//     <div class="header-badges">
//       ${errorTypeBadge}
//       ${sourceBadge}
//     </div>
//   </div>
//   ${matchedHtml}
// </div>

// <div class="body">

//   <!-- Why This Happened -->
//   <div class="section">
//     <div class="section-label blue-label">
//       <span class="label-icon">🤔</span>
//       <span>Why This Happened</span>
//     </div>
//     <div class="card card-explanation">${renderMarkdown(data.explanation)}</div>
//   </div>

//   <!-- How to Fix It -->
//   <div class="section">
//     <div class="section-label green-label">
//       <span class="label-icon">🛠️</span>
//       <span>How to Fix It</span>
//     </div>

//     <!-- Locked (countdown) -->
//     <div class="fix-locked" id="fixLocked">
//       <div class="countdown-ring">
//         <svg width="72" height="72" viewBox="0 0 72 72">
//           <circle class="track"    cx="36" cy="36" r="30"/>
//           <circle class="progress" id="progressCircle" cx="36" cy="36" r="30"/>
//         </svg>
//         <div class="countdown-number" id="countdownNum">15</div>
//       </div>
//       <div class="fix-locked-title">Code Fix is locked 🔒</div>
//       <div class="fix-locked-sub">Read the explanation above first.<br>The fix unlocks in a moment.</div>
//       <div class="fix-progress-bar">
//         <div class="fix-progress-fill" id="progressBar"></div>
//       </div>
//     </div>

//     <!-- Toggle dropdown button -->
//     <button class="fix-toggle-btn" id="toggleBtn" onclick="toggleFix()">
//       <span class="fix-toggle-left">
//         <span id="toggleLabel">✅ Show Code Fix</span>
//       </span>
//       <span class="fix-toggle-chevron" id="toggleChevron">
//         <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
//              stroke="currentColor" stroke-width="2.5"
//              stroke-linecap="round" stroke-linejoin="round">
//           <polyline points="6 9 12 15 18 9"/>
//         </svg>
//       </span>
//     </button>

//     <!-- Collapsible fix content -->
//     <div class="fix-collapse" id="fixCollapse">
//       <div class="fix-collapse-inner">
//         <div class="card card-fix">
//           ${fixHtml}
//         </div>
//       </div>
//     </div>
//   </div>

//   <!-- Remember -->
//   ${rememberHtml}

// </div>

// <div class="footer">⚖️ &nbsp;The compiler complained. We explained.</div>

// <script>
//   /* ── Countdown ── */
//   const TOTAL = 15;
//   let remaining = TOTAL;
//   const circle   = document.getElementById('progressCircle');
//   const numEl    = document.getElementById('countdownNum');
//   const barEl    = document.getElementById('progressBar');
//   const lockedEl = document.getElementById('fixLocked');
//   const toggleBtn = document.getElementById('toggleBtn');
//   const CIRCUMFERENCE = 2 * Math.PI * 30;

//   circle.style.strokeDashoffset = '0';

//   const timer = setInterval(() => {
//     remaining--;
//     const frac = remaining / TOTAL;
//     circle.style.strokeDashoffset = CIRCUMFERENCE * (1 - frac);
//     numEl.textContent = remaining;
//     if (remaining <= 5) {
//       circle.style.stroke = 'var(--amber)';
//       numEl.style.color   = 'var(--amber)';
//     }
//     barEl.style.transform = 'scaleX(' + frac + ')';
//     if (remaining <= 0) {
//       clearInterval(timer);
//       lockedEl.style.display = 'none';
//       toggleBtn.classList.add('visible');
//     }
//   }, 1000);

//   /* ── Toggle fix dropdown ── */
//   let fixOpen = false;
//   function toggleFix() {
//     fixOpen = !fixOpen;
//     const collapse  = document.getElementById('fixCollapse');
//     const chevron   = document.getElementById('toggleChevron');
//     const label     = document.getElementById('toggleLabel');
//     collapse.classList.toggle('open', fixOpen);
//     chevron.classList.toggle('open', fixOpen);
//     label.textContent = fixOpen ? '🔼 Hide Code Fix' : '✅ Show Code Fix';
//   }

//   /* ── Per-block copy buttons ── */
//   function copyCode(btn, encoded) {
//     const text = decodeURIComponent(encoded);
//     navigator.clipboard.writeText(text).then(() => {
//       btn.classList.add('copied');
//       const orig = btn.innerHTML;
//       btn.innerHTML = \`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 12 4 10"/><line x1="4" y1="10" x2="4" y2="18"/><polyline points="4 18 20 18"/></svg> Copied!\`;
//       setTimeout(() => {
//         btn.classList.remove('copied');
//         btn.innerHTML = orig;
//       }, 2000);
//     }).catch(() => {
//       // fallback for older webview contexts
//       const ta = document.createElement('textarea');
//       ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
//       document.body.appendChild(ta); ta.select();
//       document.execCommand('copy');
//       document.body.removeChild(ta);
//       btn.classList.add('copied');
//       const orig = btn.innerHTML;
//       btn.innerHTML = \`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 12 4 10"/></svg> Copied!\`;
//       setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = orig; }, 2000);
//     });
//   }
// </script>

// </body>
// </html>`;
// }










// import * as vscode from "vscode";

// type PanelData = {
//   explanation: string;
//   fix: string;
//   remember?: string | null;
//   source: "AI" | "ChromaDB" | string;
//   matchedError?: string;
//   similarity?: number | null;
//   errorType?: 'diagnostic' | 'runtime';
//   // New fields for location + language display
//   fileName?: string;
//   lineNumber?: number;
//   targetLanguage?: string;
// };

// export function showPanel(
//   data: PanelData,
//   extensionUri: vscode.Uri
// ): void {
//   const panel = vscode.window.createWebviewPanel(
//     "codeEqualize",
//     "Code Equalize",
//     vscode.ViewColumn.Beside,
//     { enableScripts: true }
//   );

//   panel.iconPath = vscode.Uri.joinPath(
//     extensionUri,
//     'media',
//     'code-equalize-icon.png'
//   );

//   panel.webview.html = getWebviewContent(data);
// }

// function escapeHtml(text: string): string {
//   return text
//     .replace(/&/g, "&amp;")
//     .replace(/</g, "&lt;")
//     .replace(/>/g, "&gt;");
// }

// /**
//  * Renders markdown to HTML.
//  * Code blocks get a per-block copy button.
//  */
// function renderMarkdown(text: string): string {
//   if (!text) return "";

//   const parts: { type: string; content: string; index?: number }[] = [];
//   let codeBlockIndex = 0;
//   const codeBlockRegex = /```[\w]*\n?([\s\S]*?)```/g;
//   let lastIndex = 0;
//   let match: RegExpExecArray | null;

//   while ((match = codeBlockRegex.exec(text)) !== null) {
//     const before = text.slice(lastIndex, match.index);
//     parts.push({ type: 'text', content: before });
//     parts.push({ type: 'code', content: match[1], index: codeBlockIndex++ });
//     lastIndex = match.index + match[0].length;
//   }
//   parts.push({ type: 'text', content: text.slice(lastIndex) });

//   return parts.map((part) => {
//     if (part.type === 'code') {
//       const escaped = escapeHtml(part.content.trimEnd());
//       const encoded = encodeURIComponent(part.content.trimEnd());
//       return `<div class="code-block-wrap">
//   <button class="copy-btn" onclick="copyCode(this, '${encoded}')" title="Copy code">
//     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
//       <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
//     </svg>
//     Copy
//   </button>
//   <pre><code>${escaped}</code></pre>
// </div>`;
//     } else {
//       const escaped = escapeHtml(part.content);
//       return escaped
//         .replace(/`([^`]+)`/g, `<code class="inline">$1</code>`)
//         .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
//         .replace(/\n/g, "<br>");
//     }
//   }).join('').trim();
// }

// function getWebviewContent(data: PanelData): string {
//   const isChroma  = data.source === "ChromaDB";
//   const isRuntime = data.errorType === "runtime";

//   // ── Badge tooltips ──────────────────────────────────────────
//   const errorTypeTooltip = isRuntime
//     ? "Runtime Error: occurs while the program is running — e.g. null pointer, division by zero, stack overflow."
//     : "Diagnostic Error: caught by the language server before your code runs — e.g. syntax error or type mismatch.";
//   const sourceTooltip = isChroma
//     ? "ChromaDB: retrieved from the local error knowledge base using vector similarity search."
//     : "AI Generated: Groq AI (LLaMA) generated this explanation from your code.";

//   const errorTypeBadge = isRuntime
//     ? `<span class="badge badge-runtime"  data-tooltip="${errorTypeTooltip}">⚡ Runtime Error</span>`
//     : `<span class="badge badge-diagnostic" data-tooltip="${errorTypeTooltip}">🔍 Diagnostic Error</span>`;
//   const sourceBadge = isChroma
//     ? `<span class="badge badge-chroma" data-tooltip="${sourceTooltip}">📚 ChromaDB</span>`
//     : `<span class="badge badge-ai"     data-tooltip="${sourceTooltip}">🤖 AI Generated</span>`;

//   // ── Location chip (filename + line) ─────────────────────────
//   const locationHtml = (data.fileName || data.lineNumber !== undefined)
//     ? `<div class="location-chip">
//         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
//           <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
//         </svg>
//         <span class="location-file">${escapeHtml(data.fileName ?? 'Unknown file')}</span>
//         ${data.lineNumber !== undefined && data.lineNumber > 0
//           ? `<span class="location-sep">·</span><span class="location-line">Line ${data.lineNumber + 1}</span>`
//           : ''}
//         ${data.targetLanguage
//           ? `<span class="location-sep">·</span>
//              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
//                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
//                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
//              </svg>
//              <span class="location-lang">${escapeHtml(data.targetLanguage)}</span>`
//           : ''}
//        </div>`
//     : '';

//   // ── Matched error bar ────────────────────────────────────────
//   const matchedHtml = isChroma && data.matchedError
//     ? `<div class="matched-bar">
//         <span class="matched-dot"></span>
//         <span class="matched-label">Matched:</span>
//         <code class="matched-value">${escapeHtml(data.matchedError)}</code>
//        </div>`
//     : "";

//   // ── Remember section ─────────────────────────────────────────
//   const rememberHtml = data.remember
//     ? `<div class="section">
//         <div class="section-label amber-label">
//           <span class="label-icon">💡</span>
//           <span>Remember for Next Time</span>
//         </div>
//         <div class="card card-remember">${renderMarkdown(data.remember)}</div>
//        </div>`
//     : "";

//   const fixHtml = renderMarkdown(data.fix);

//   return `<!DOCTYPE html>
// <html lang="en">
// <head>
// <meta charset="UTF-8">
// <meta name="viewport" content="width=device-width, initial-scale=1.0">
// <style>
//   :root {
//     --bg:           var(--vscode-editor-background);
//     --fg:           var(--vscode-editor-foreground);
//     --fg-muted:     var(--vscode-descriptionForeground, #8b949e);
//     --border:       var(--vscode-panel-border, rgba(128,128,128,.18));
//     --surface:      var(--vscode-editorWidget-background, rgba(128,128,128,.06));
//     --code-bg:      var(--vscode-textCodeBlock-background, rgba(0,0,0,.22));
//     --blue:         #4FC1FF;
//     --blue-dim:     rgba(79,193,255,.10);
//     --blue-border:  rgba(79,193,255,.28);
//     --blue-label:   rgba(79,193,255,.15);
//     --green:        #4EC994;
//     --green-dim:    rgba(78,201,148,.10);
//     --green-border: rgba(78,201,148,.28);
//     --green-label:  rgba(78,201,148,.15);
//     --amber:        #E5A11C;
//     --amber-dim:    rgba(229,161,28,.10);
//     --amber-border: rgba(229,161,28,.28);
//     --amber-label:  rgba(229,161,28,.15);
//     --purple:       #C586C0;
//     --purple-dim:   rgba(197,134,192,.10);
//     --purple-border:rgba(197,134,192,.28);
//     --radius: 9px;
//     --font-ui:   var(--vscode-font-family, -apple-system, "Segoe UI", sans-serif);
//     --font-mono: var(--vscode-editor-font-family, "Cascadia Code", Consolas, monospace);
//   }
//   * { box-sizing: border-box; margin: 0; padding: 0; }
//   body {
//     font-family: var(--font-ui); font-size: 13.5px;
//     background: var(--bg); color: var(--fg);
//     line-height: 1.75; padding-bottom: 48px;
//   }

//   /* ── Header ── */
//   .header {
//     padding: 16px 20px 14px;
//     border-bottom: 1px solid var(--border);
//     background: linear-gradient(135deg, rgba(79,193,255,.06) 0%, rgba(78,201,148,.04) 60%, transparent 100%);
//   }
//   .header-top {
//     display: flex; align-items: center; justify-content: space-between;
//     gap: 10px; flex-wrap: wrap; margin-bottom: 10px;
//   }
//   .header-title {
//     display: flex; align-items: center; gap: 10px;
//     font-size: 15px; font-weight: 700; letter-spacing: -.025em;
//   }
//   .logo-icon {
//     width: 30px; height: 30px; border-radius: 7px;
//     background: linear-gradient(135deg, var(--blue-dim), var(--green-dim));
//     border: 1px solid var(--blue-border);
//     display: flex; align-items: center; justify-content: center;
//     font-size: 15px; flex-shrink: 0;
//   }
//   .header-badges { display: flex; gap: 6px; flex-wrap: wrap; }
//   .header-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

//   /* ── Location chip ── */
//   .location-chip {
//     display: inline-flex; align-items: center; gap: 5px;
//     padding: 4px 10px; border-radius: 6px;
//     background: var(--surface); border: 1px solid var(--border);
//     font-size: 11.5px; color: var(--fg-muted);
//     font-family: var(--font-mono);
//   }
//   .location-file { color: var(--fg); font-weight: 600; }
//   .location-line { color: var(--blue); font-weight: 600; }
//   .location-lang { color: var(--purple); font-weight: 600; font-family: var(--font-ui); }
//   .location-sep  { color: var(--fg-muted); opacity: .5; }

//   /* ── Badges ── */
//   .badge {
//     position: relative; display: inline-flex; align-items: center; gap: 5px;
//     padding: 3px 10px; border-radius: 99px;
//     font-size: 11px; font-weight: 600; letter-spacing: .03em;
//     border: 1px solid transparent; cursor: default;
//     transition: filter .15s, transform .15s; user-select: none;
//   }
//   .badge:hover { filter: brightness(1.15); transform: translateY(-1px); }
//   .badge-runtime    { color: var(--amber);  background: var(--amber-dim);  border-color: var(--amber-border); }
//   .badge-diagnostic { color: var(--blue);   background: var(--blue-dim);   border-color: var(--blue-border); }
//   .badge-chroma     { color: var(--green);  background: var(--green-dim);  border-color: var(--green-border); }
//   .badge-ai         { color: var(--purple); background: var(--purple-dim); border-color: var(--purple-border); }
//   .badge::after {
//     content: attr(data-tooltip);
//     position: absolute; top: calc(100% + 7px); right: 0; width: 230px;
//     background: var(--vscode-editorHoverWidget-background, #1e1e2e);
//     color: var(--fg); border: 1px solid var(--border);
//     border-radius: 7px; padding: 9px 12px;
//     font-size: 11.5px; font-weight: 400; line-height: 1.55; letter-spacing: 0;
//     white-space: normal; z-index: 99; opacity: 0; pointer-events: none;
//     transform: translateY(4px); transition: opacity .18s, transform .18s;
//     box-shadow: 0 4px 18px rgba(0,0,0,.35);
//   }
//   .badge:hover::after { opacity: 1; transform: translateY(0); }

//   /* ── Matched bar ── */
//   .matched-bar {
//     display: flex; align-items: center; gap: 8px;
//     padding: 7px 12px; border-radius: 7px; margin-top: 8px;
//     background: var(--green-dim); border: 1px solid var(--green-border); font-size: 12px;
//   }
//   .matched-dot {
//     width: 6px; height: 6px; border-radius: 50%;
//     background: var(--green); box-shadow: 0 0 5px var(--green); flex-shrink: 0;
//   }
//   .matched-label { color: var(--fg-muted); font-weight: 600; flex-shrink: 0; }
//   .matched-value { font-family: var(--font-mono); font-size: 11.5px; color: var(--green); background: none; border: none; padding: 0; }

//   /* ── Body ── */
//   .body { padding: 18px 20px 0; display: flex; flex-direction: column; gap: 18px; }

//   /* ── Section label pills ── */
//   .section-label {
//     display: flex; align-items: center; gap: 7px; margin-bottom: 8px;
//     font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
//     padding: 4px 10px; border-radius: 6px; width: fit-content;
//     color: var(--fg-muted); background: var(--surface); border: 1px solid var(--border);
//   }
//   .blue-label  { color: var(--blue);  background: var(--blue-label);  border-color: var(--blue-border); }
//   .green-label { color: var(--green); background: var(--green-label); border-color: var(--green-border); }
//   .amber-label { color: var(--amber); background: var(--amber-label); border-color: var(--amber-border); }
//   .label-icon { font-size: 12px; }

//   /* ── Cards ── */
//   .card {
//     background: var(--surface); border: 1px solid var(--border);
//     border-radius: var(--radius); padding: 14px 17px;
//     font-size: 13.5px; line-height: 1.8;
//   }
//   .card-explanation { border-left: 3px solid var(--blue);  background: var(--blue-dim);  border-color: var(--blue-border); }
//   .card-fix         { border-left: 3px solid var(--green); background: var(--green-dim); border-color: var(--green-border); }
//   .card-remember    { border-left: 3px solid var(--amber); background: var(--amber-dim); border-color: var(--amber-border); }

//   /* ── Code blocks ── */
//   .code-block-wrap { position: relative; margin: 12px 0 4px; }
//   .code-block-wrap pre {
//     margin: 0; background: var(--code-bg); border: 1px solid var(--border);
//     border-radius: var(--radius); padding: 36px 14px 13px;
//     overflow-x: auto; font-size: 12.5px; line-height: 1.6;
//   }
//   .copy-btn {
//     position: absolute; top: 7px; right: 7px;
//     display: inline-flex; align-items: center; gap: 5px;
//     padding: 3px 9px; background: var(--surface);
//     border: 1px solid var(--border); border-radius: 5px;
//     color: var(--fg-muted); font-family: var(--font-ui);
//     font-size: 11px; font-weight: 600; cursor: pointer;
//     transition: background .15s, color .15s, border-color .15s; z-index: 2;
//   }
//   .copy-btn:hover   { background: var(--green-dim); color: var(--green); border-color: var(--green-border); }
//   .copy-btn.copied  { background: var(--green-dim); color: var(--green); border-color: var(--green-border); }
//   code { font-family: var(--font-mono); font-size: 12.5px; }
//   code.inline {
//     background: rgba(128,128,128,.13); padding: 2px 5px;
//     border-radius: 4px; font-size: 12px; border: 1px solid var(--border);
//   }
//   pre code { background: none; border: none; padding: 0; }

//   /* ── Fix locked ── */
//   .fix-locked {
//     border-radius: var(--radius); border: 1px dashed var(--border);
//     background: var(--surface); padding: 24px 20px 20px; text-align: center;
//   }
//   .countdown-ring { position: relative; width: 70px; height: 70px; margin: 0 auto 13px; }
//   .countdown-ring svg { transform: rotate(-90deg); }
//   .countdown-ring .track    { fill: none; stroke: var(--border); stroke-width: 4; }
//   .countdown-ring .progress {
//     fill: none; stroke: var(--green); stroke-width: 4;
//     stroke-linecap: round; stroke-dasharray: 188.5; stroke-dashoffset: 0;
//     transition: stroke-dashoffset 1s linear, stroke .4s;
//   }
//   .countdown-number {
//     position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
//     font-size: 20px; font-weight: 700; color: var(--green);
//     font-variant-numeric: tabular-nums; transition: color .4s;
//   }
//   .fix-locked-title { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
//   .fix-locked-sub   { font-size: 11.5px; color: var(--fg-muted); line-height: 1.6; max-width: 260px; margin: 0 auto; }
//   .fix-progress-bar { height: 2px; border-radius: 99px; background: var(--border); margin-top: 14px; overflow: hidden; }
//   .fix-progress-fill {
//     height: 100%; width: 100%;
//     background: linear-gradient(90deg, var(--blue), var(--green));
//     border-radius: 99px; transform-origin: left; transform: scaleX(1);
//     transition: transform 1s linear;
//   }

//   /* ── Toggle button ── */
//   .fix-toggle-btn {
//     display: none; width: 100%; align-items: center; justify-content: space-between;
//     padding: 11px 17px; border-radius: var(--radius);
//     border: 1px solid var(--green-border); background: var(--green-dim);
//     color: var(--green); font-family: var(--font-ui);
//     font-size: 13px; font-weight: 600; cursor: pointer;
//     transition: background .2s, box-shadow .2s; letter-spacing: .01em;
//   }
//   .fix-toggle-btn:hover { background: rgba(78,201,148,.2); box-shadow: 0 0 12px rgba(78,201,148,.18); }
//   .fix-toggle-btn.visible { display: flex; }
//   .fix-toggle-left { display: flex; align-items: center; gap: 8px; }
//   .fix-toggle-chevron { display: inline-flex; transition: transform .3s ease; flex-shrink: 0; }
//   .fix-toggle-chevron.open { transform: rotate(180deg); }

//   /* ── Collapsible ── */
//   .fix-collapse { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .3s ease; margin-top: 8px; }
//   .fix-collapse.open { grid-template-rows: 1fr; }
//   .fix-collapse-inner { overflow: hidden; }

//   /* ── Footer ── */
//   .footer {
//     margin-top: 26px; padding: 12px 20px 0; border-top: 1px solid var(--border);
//     display: flex; align-items: center; justify-content: center;
//     gap: 8px; font-size: 11px; color: var(--fg-muted); opacity: .45; letter-spacing: .05em;
//   }
// </style>
// </head>
// <body>

// <div class="header">
//   <div class="header-top">
//     <div class="header-title">
//       <div class="logo-icon">⚖️</div>
//       Code Equalize
//     </div>
//     <div class="header-badges">
//       ${errorTypeBadge}
//       ${sourceBadge}
//     </div>
//   </div>
//   <div class="header-meta">
//     ${locationHtml}
//   </div>
//   ${matchedHtml}
// </div>

// <div class="body">

//   <!-- Why This Happened -->
//   <div class="section">
//     <div class="section-label blue-label">
//       <span class="label-icon">🤔</span>
//       <span>Why This Happened</span>
//     </div>
//     <div class="card card-explanation">${renderMarkdown(data.explanation)}</div>
//   </div>

//   <!-- How to Fix It -->
//   <div class="section">
//     <div class="section-label green-label">
//       <span class="label-icon">🛠️</span>
//       <span>How to Fix It</span>
//     </div>

//     <div class="fix-locked" id="fixLocked">
//       <div class="countdown-ring">
//         <svg width="70" height="70" viewBox="0 0 70 70">
//           <circle class="track"    cx="35" cy="35" r="30"/>
//           <circle class="progress" id="progressCircle" cx="35" cy="35" r="30"/>
//         </svg>
//         <div class="countdown-number" id="countdownNum">15</div>
//       </div>
//       <div class="fix-locked-title">Code Fix is locked 🔒</div>
//       <div class="fix-locked-sub">Read the explanation above first.<br>The fix unlocks in a moment.</div>
//       <div class="fix-progress-bar"><div class="fix-progress-fill" id="progressBar"></div></div>
//     </div>

//     <button class="fix-toggle-btn" id="toggleBtn" onclick="toggleFix()">
//       <span class="fix-toggle-left">
//         <span id="toggleLabel">✅ Show Code Fix</span>
//       </span>
//       <span class="fix-toggle-chevron" id="toggleChevron">
//         <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
//           <polyline points="6 9 12 15 18 9"/>
//         </svg>
//       </span>
//     </button>

//     <div class="fix-collapse" id="fixCollapse">
//       <div class="fix-collapse-inner">
//         <div class="card card-fix">${fixHtml}</div>
//       </div>
//     </div>
//   </div>

//   ${rememberHtml}

// </div>

// <div class="footer">⚖️ &nbsp;The compiler complained. We explained.</div>

// <script>
//   const TOTAL = 15;
//   let remaining = TOTAL;
//   const circle    = document.getElementById('progressCircle');
//   const numEl     = document.getElementById('countdownNum');
//   const barEl     = document.getElementById('progressBar');
//   const lockedEl  = document.getElementById('fixLocked');
//   const toggleBtn = document.getElementById('toggleBtn');
//   const CIRCUMFERENCE = 2 * Math.PI * 30;
//   circle.style.strokeDashoffset = '0';

//   const timer = setInterval(() => {
//     remaining--;
//     const frac = remaining / TOTAL;
//     circle.style.strokeDashoffset = CIRCUMFERENCE * (1 - frac);
//     numEl.textContent = remaining;
//     if (remaining <= 5) {
//       circle.style.stroke = 'var(--amber)';
//       numEl.style.color   = 'var(--amber)';
//     }
//     barEl.style.transform = 'scaleX(' + frac + ')';
//     if (remaining <= 0) {
//       clearInterval(timer);
//       lockedEl.style.display = 'none';
//       toggleBtn.classList.add('visible');
//     }
//   }, 1000);

//   let fixOpen = false;
//   function toggleFix() {
//     fixOpen = !fixOpen;
//     document.getElementById('fixCollapse').classList.toggle('open', fixOpen);
//     document.getElementById('toggleChevron').classList.toggle('open', fixOpen);
//     document.getElementById('toggleLabel').textContent = fixOpen ? '🔼 Hide Code Fix' : '✅ Show Code Fix';
//   }

//   function copyCode(btn, encoded) {
//     const text = decodeURIComponent(encoded);
//     const doFlash = () => {
//       btn.classList.add('copied');
//       const orig = btn.innerHTML;
//       btn.innerHTML = \`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 12 4 10"/><line x1="4" y1="10" x2="4" y2="18"/><polyline points="4 18 20 18"/></svg> Copied!\`;
//       setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = orig; }, 2000);
//     };
//     navigator.clipboard.writeText(text).then(doFlash).catch(() => {
//       const ta = document.createElement('textarea');
//       ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
//       document.body.appendChild(ta); ta.select(); document.execCommand('copy');
//       document.body.removeChild(ta); doFlash();
//     });
//   }
// </script>
// </body>
// </html>`;
// }






// import * as vscode from 'vscode';

// type PanelData = {
//   explanation: string;
//   fix: string;
//   remember?: string | null;
//   source: 'AI' | 'ChromaDB' | string;
//   matchedError?: string;
//   similarity?: number | null;
//   errorType?: 'diagnostic' | 'runtime';
//   fileName?: string;
//   lineNumber?: number;
//   targetLanguage?: string;
// };

// export function showPanel(
//   data: PanelData,
//   extensionUri: vscode.Uri
// ): void {
//   const mediaFolder = vscode.Uri.joinPath(extensionUri, 'media');

//   const panel = vscode.window.createWebviewPanel(
//     'codeEqualize',
//     'Code Equalize',
//     vscode.ViewColumn.Beside,
//     {
//       enableScripts: true,
//       localResourceRoots: [mediaFolder]
//     }
//   );

//   // VS Code editor tab icon
//   panel.iconPath = vscode.Uri.joinPath(
//     mediaFolder,
//     'code-equalize-icon.png'
//   );

//   // Convert local image paths into webview-accessible URIs
//   const logoUri = panel.webview.asWebviewUri(
//     vscode.Uri.joinPath(mediaFolder, 'code-equalize-logo.png')
//   );

//   panel.webview.html = getWebviewContent(
//     data,
//     logoUri.toString()
//   );
// }

// function escapeHtml(text: string): string {
//   return text
//     .replace(/&/g, '&amp;')
//     .replace(/</g, '&lt;')
//     .replace(/>/g, '&gt;')
//     .replace(/"/g, '&quot;')
//     .replace(/'/g, '&#39;');
// }

// /**
//  * Renders markdown to HTML.
//  * Code blocks receive individual copy buttons.
//  */
// function renderMarkdown(text: string): string {
//   if (!text) {
//     return '';
//   }

//   const parts: { type: string; content: string }[] = [];
//   const codeBlockRegex = /```[\w]*\n?([\s\S]*?)```/g;

//   let lastIndex = 0;
//   let match: RegExpExecArray | null;

//   while ((match = codeBlockRegex.exec(text)) !== null) {
//     parts.push({
//       type: 'text',
//       content: text.slice(lastIndex, match.index)
//     });

//     parts.push({
//       type: 'code',
//       content: match[1]
//     });

//     lastIndex = match.index + match[0].length;
//   }

//   parts.push({
//     type: 'text',
//     content: text.slice(lastIndex)
//   });

//   return parts.map((part) => {
//     if (part.type === 'code') {
//       const code = part.content.trimEnd();
//       const escaped = escapeHtml(code);
//       const encoded = encodeURIComponent(code).replace(/'/g, '%27');

//       return `
//         <div class="code-block-wrap">
//           <button
//             class="copy-btn"
//             onclick="copyCode(this, '${encoded}')"
//             title="Copy code"
//           >
//             <svg width="13" height="13" viewBox="0 0 24 24"
//               fill="none" stroke="currentColor" stroke-width="2"
//               stroke-linecap="round" stroke-linejoin="round">
//               <rect x="9" y="9" width="13" height="13" rx="2"/>
//               <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
//             </svg>
//             Copy
//           </button>
//           <pre><code>${escaped}</code></pre>
//         </div>
//       `;
//     }

//     const escaped = escapeHtml(part.content);

//     return escaped
//       .replace(/`([^`]+)`/g, '<code class="inline">$1</code>')
//       .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
//       .replace(/\n/g, '<br>');
//   }).join('').trim();
// }

// function getWebviewContent(
//   data: PanelData,
//   logoUri: string
// ): string {
//   const isChroma = data.source === 'ChromaDB';
//   const isRuntime = data.errorType === 'runtime';

//   const errorTypeTooltip = isRuntime
//     ? 'Runtime Error: occurs while the program is running — e.g. null pointer, division by zero, stack overflow.'
//     : 'Diagnostic Error: caught by the language server before your code runs — e.g. syntax error or type mismatch.';

//   const sourceTooltip = isChroma
//     ? 'ChromaDB: retrieved from the error knowledge base using vector similarity search.'
//     : 'AI Generated: Groq AI generated this explanation using the retrieved context.';

//   const errorTypeBadge = isRuntime
//     ? `<span class="badge badge-runtime" data-tooltip="${errorTypeTooltip}">⚡ Runtime Error</span>`
//     : `<span class="badge badge-diagnostic" data-tooltip="${errorTypeTooltip}">🔍 Diagnostic Error</span>`;

//   const sourceBadge = isChroma
//     ? `<span class="badge badge-chroma" data-tooltip="${sourceTooltip}">📚 ChromaDB</span>`
//     : `<span class="badge badge-ai" data-tooltip="${sourceTooltip}">🤖 AI Generated</span>`;

//   // File, line and explanation language information
//   const locationHtml =
//     data.fileName || data.lineNumber !== undefined || data.targetLanguage
//       ? `
//         <div class="location-chip">
//           <svg width="12" height="12" viewBox="0 0 24 24"
//             fill="none" stroke="currentColor" stroke-width="2"
//             stroke-linecap="round" stroke-linejoin="round">
//             <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
//             <polyline points="14 2 14 8 20 8"/>
//           </svg>

//           ${data.fileName
//             ? `<span class="location-file">${escapeHtml(data.fileName)}</span>`
//             : ''}

//           ${data.lineNumber !== undefined
//             ? `<span class="location-sep">·</span>
//                <span class="location-line">Line ${data.lineNumber + 1}</span>`
//             : ''}

//           ${data.targetLanguage
//             ? `<span class="location-sep">·</span>
//                <span class="location-lang">${escapeHtml(data.targetLanguage)}</span>`
//             : ''}
//         </div>
//       `
//       : '';

//   // Matched knowledge-base error
//   const matchedHtml =
//     isChroma && data.matchedError
//       ? `
//         <div class="matched-bar">
//           <span class="matched-dot"></span>
//           <span class="matched-label">Matched:</span>
//           <code class="matched-value">${escapeHtml(data.matchedError)}</code>
//         </div>
//       `
//       : '';

//   // Optional learning reminder
//   const rememberHtml = data.remember
//     ? `
//       <div class="section">
//         <div class="section-label amber-label">
//           <span class="label-icon">💡</span>
//           <span>Remember for Next Time</span>
//         </div>
//         <div class="card card-remember">
//           ${renderMarkdown(data.remember)}
//         </div>
//       </div>
//     `
//     : '';

//   const fixHtml = renderMarkdown(data.fix);

//   return `<!DOCTYPE html>
// <html lang="en">
// <head>
// <meta charset="UTF-8">
// <meta name="viewport" content="width=device-width, initial-scale=1.0">

// <style>
// :root {
//   --bg: var(--vscode-editor-background);
//   --fg: var(--vscode-editor-foreground);
//   --fg-muted: var(--vscode-descriptionForeground, #8b949e);
//   --border: var(--vscode-panel-border, rgba(128,128,128,.18));
//   --surface: var(--vscode-editorWidget-background, rgba(128,128,128,.06));
//   --code-bg: var(--vscode-textCodeBlock-background, rgba(0,0,0,.22));

//   --blue: #4FC1FF;
//   --blue-dim: rgba(79,193,255,.10);
//   --blue-border: rgba(79,193,255,.28);
//   --blue-label: rgba(79,193,255,.15);

//   --green: #4EC994;
//   --green-dim: rgba(78,201,148,.10);
//   --green-border: rgba(78,201,148,.28);
//   --green-label: rgba(78,201,148,.15);

//   --amber: #E5A11C;
//   --amber-dim: rgba(229,161,28,.10);
//   --amber-border: rgba(229,161,28,.28);
//   --amber-label: rgba(229,161,28,.15);

//   --purple: #C586C0;
//   --purple-dim: rgba(197,134,192,.10);
//   --purple-border: rgba(197,134,192,.28);

//   --radius: 9px;
//   --font-ui: var(--vscode-font-family, -apple-system, "Segoe UI", sans-serif);
//   --font-mono: var(--vscode-editor-font-family, Consolas, monospace);
// }

// * {
//   box-sizing: border-box;
//   margin: 0;
//   padding: 0;
// }

// body {
//   font-family: var(--font-ui);
//   font-size: 13.5px;
//   background: var(--bg);
//   color: var(--fg);
//   line-height: 1.75;
//   padding-bottom: 20px;
// }

// /* HEADER */

// .header {
//   padding: 16px 20px 14px;
//   border-bottom: 1px solid var(--border);
//   background: linear-gradient(
//     135deg,
//     rgba(79,193,255,.06),
//     rgba(78,201,148,.04) 60%,
//     transparent
//   );
// }

// .header-top {
//   display: flex;
//   align-items: center;
//   justify-content: space-between;
//   gap: 10px;
//   flex-wrap: wrap;
//   margin-bottom: 10px;
// }

// .header-title {
//   display: flex;
//   align-items: center;
//   min-width: 0;
// }

// .header-logo {
//   display: block;
//   width: 190px;
//   max-width: 100%;
//   height: auto;
//   object-fit: contain;
//   animation: logoAppear .55s ease-out both;
// }

// @keyframes logoAppear {
//   from {
//     opacity: 0;
//     transform: translateY(5px);
//   }
//   to {
//     opacity: 1;
//     transform: translateY(0);
//   }
// }

// .header-badges {
//   display: flex;
//   gap: 6px;
//   flex-wrap: wrap;
// }

// .header-meta {
//   display: flex;
//   align-items: center;
//   gap: 8px;
//   flex-wrap: wrap;
// }

// /* LOCATION */

// .location-chip {
//   display: inline-flex;
//   align-items: center;
//   gap: 5px;
//   padding: 4px 10px;
//   border-radius: 6px;
//   background: var(--surface);
//   border: 1px solid var(--border);
//   font-size: 11.5px;
//   color: var(--fg-muted);
//   font-family: var(--font-mono);
// }

// .location-file {
//   color: var(--fg);
//   font-weight: 600;
// }

// .location-line {
//   color: var(--blue);
//   font-weight: 600;
// }

// .location-lang {
//   color: var(--purple);
//   font-weight: 600;
//   font-family: var(--font-ui);
// }

// .location-sep {
//   color: var(--fg-muted);
//   opacity: .5;
// }

// /* BADGES */

// .badge {
//   position: relative;
//   display: inline-flex;
//   align-items: center;
//   gap: 5px;
//   padding: 3px 10px;
//   border-radius: 99px;
//   font-size: 11px;
//   font-weight: 600;
//   letter-spacing: .03em;
//   border: 1px solid transparent;
//   cursor: default;
//   transition: filter .15s, transform .15s;
//   user-select: none;
// }

// .badge:hover {
//   filter: brightness(1.15);
//   transform: translateY(-1px);
// }

// .badge-runtime {
//   color: var(--amber);
//   background: var(--amber-dim);
//   border-color: var(--amber-border);
// }

// .badge-diagnostic {
//   color: var(--blue);
//   background: var(--blue-dim);
//   border-color: var(--blue-border);
// }

// .badge-chroma {
//   color: var(--green);
//   background: var(--green-dim);
//   border-color: var(--green-border);
// }

// .badge-ai {
//   color: var(--purple);
//   background: var(--purple-dim);
//   border-color: var(--purple-border);
// }

// .badge::after {
//   content: attr(data-tooltip);
//   position: absolute;
//   top: calc(100% + 7px);
//   right: 0;
//   width: 230px;
//   background: var(--vscode-editorHoverWidget-background, #1e1e2e);
//   color: var(--fg);
//   border: 1px solid var(--border);
//   border-radius: 7px;
//   padding: 9px 12px;
//   font-size: 11.5px;
//   font-weight: 400;
//   line-height: 1.55;
//   white-space: normal;
//   z-index: 99;
//   opacity: 0;
//   pointer-events: none;
//   transform: translateY(4px);
//   transition: opacity .18s, transform .18s;
//   box-shadow: 0 4px 18px rgba(0,0,0,.35);
// }

// .badge:hover::after {
//   opacity: 1;
//   transform: translateY(0);
// }

// /* MATCHED ERROR */

// .matched-bar {
//   display: flex;
//   align-items: center;
//   gap: 8px;
//   padding: 7px 12px;
//   border-radius: 7px;
//   margin-top: 8px;
//   background: var(--green-dim);
//   border: 1px solid var(--green-border);
//   font-size: 12px;
// }

// .matched-dot {
//   width: 6px;
//   height: 6px;
//   border-radius: 50%;
//   background: var(--green);
//   box-shadow: 0 0 5px var(--green);
//   flex-shrink: 0;
// }

// .matched-label {
//   color: var(--fg-muted);
//   font-weight: 600;
//   flex-shrink: 0;
// }

// .matched-value {
//   font-family: var(--font-mono);
//   font-size: 11.5px;
//   color: var(--green);
//   overflow-wrap: anywhere;
// }

// /* MAIN BODY */

// .body {
//   padding: 18px 20px 0;
//   display: flex;
//   flex-direction: column;
//   gap: 18px;
// }

// /* SECTION LABELS */

// .section-label {
//   display: flex;
//   align-items: center;
//   gap: 7px;
//   margin-bottom: 8px;
//   font-size: 10px;
//   font-weight: 700;
//   letter-spacing: .1em;
//   text-transform: uppercase;
//   padding: 4px 10px;
//   border-radius: 6px;
//   width: fit-content;
//   color: var(--fg-muted);
//   background: var(--surface);
//   border: 1px solid var(--border);
// }

// .blue-label {
//   color: var(--blue);
//   background: var(--blue-label);
//   border-color: var(--blue-border);
// }

// .green-label {
//   color: var(--green);
//   background: var(--green-label);
//   border-color: var(--green-border);
// }

// .amber-label {
//   color: var(--amber);
//   background: var(--amber-label);
//   border-color: var(--amber-border);
// }

// .label-icon {
//   font-size: 12px;
// }

// /* EXPLANATION CARDS */

// .card {
//   background: var(--surface);
//   border: 1px solid var(--border);
//   border-radius: var(--radius);
//   padding: 14px 17px;
//   font-size: 13.5px;
//   line-height: 1.8;
//   overflow-wrap: anywhere;
// }

// .card-explanation {
//   border-left: 3px solid var(--blue);
//   background: var(--blue-dim);
//   border-color: var(--blue-border);
// }

// .card-fix {
//   border-left: 3px solid var(--green);
//   background: var(--green-dim);
//   border-color: var(--green-border);
// }

// .card-remember {
//   border-left: 3px solid var(--amber);
//   background: var(--amber-dim);
//   border-color: var(--amber-border);
// }

// /* CODE BLOCKS */

// .code-block-wrap {
//   position: relative;
//   margin: 12px 0 4px;
// }

// .code-block-wrap pre {
//   margin: 0;
//   background: var(--code-bg);
//   border: 1px solid var(--border);
//   border-radius: var(--radius);
//   padding: 36px 14px 13px;
//   overflow-x: auto;
//   font-size: 12.5px;
//   line-height: 1.6;
// }

// .copy-btn {
//   position: absolute;
//   top: 7px;
//   right: 7px;
//   display: inline-flex;
//   align-items: center;
//   gap: 5px;
//   padding: 3px 9px;
//   background: var(--surface);
//   border: 1px solid var(--border);
//   border-radius: 5px;
//   color: var(--fg-muted);
//   font-family: var(--font-ui);
//   font-size: 11px;
//   font-weight: 600;
//   cursor: pointer;
//   transition: background .15s, color .15s;
//   z-index: 2;
// }

// .copy-btn:hover,
// .copy-btn.copied {
//   background: var(--green-dim);
//   color: var(--green);
//   border-color: var(--green-border);
// }

// code {
//   font-family: var(--font-mono);
//   font-size: 12.5px;
// }

// code.inline {
//   background: rgba(128,128,128,.13);
//   padding: 2px 5px;
//   border-radius: 4px;
//   font-size: 12px;
//   border: 1px solid var(--border);
// }

// pre code {
//   background: none;
//   border: none;
//   padding: 0;
// }

// /* LOCKED CODE FIX */

// .fix-locked {
//   border-radius: var(--radius);
//   border: 1px dashed var(--border);
//   background: var(--surface);
//   padding: 24px 20px 20px;
//   text-align: center;
// }

// .countdown-ring {
//   position: relative;
//   width: 70px;
//   height: 70px;
//   margin: 0 auto 13px;
// }

// .countdown-ring svg {
//   transform: rotate(-90deg);
// }

// .countdown-ring .track {
//   fill: none;
//   stroke: var(--border);
//   stroke-width: 4;
// }

// .countdown-ring .progress {
//   fill: none;
//   stroke: var(--green);
//   stroke-width: 4;
//   stroke-linecap: round;
//   stroke-dasharray: 188.5;
//   stroke-dashoffset: 0;
//   transition: stroke-dashoffset 1s linear, stroke .4s;
// }

// .countdown-number {
//   position: absolute;
//   inset: 0;
//   display: flex;
//   align-items: center;
//   justify-content: center;
//   font-size: 20px;
//   font-weight: 700;
//   color: var(--green);
//   font-variant-numeric: tabular-nums;
// }

// .fix-locked-title {
//   font-size: 13px;
//   font-weight: 600;
//   margin-bottom: 4px;
// }

// .fix-locked-sub {
//   font-size: 11.5px;
//   color: var(--fg-muted);
//   line-height: 1.6;
//   max-width: 260px;
//   margin: 0 auto;
// }

// .fix-progress-bar {
//   height: 2px;
//   border-radius: 99px;
//   background: var(--border);
//   margin-top: 14px;
//   overflow: hidden;
// }

// .fix-progress-fill {
//   height: 100%;
//   width: 100%;
//   background: linear-gradient(90deg, var(--blue), var(--green));
//   border-radius: 99px;
//   transform-origin: left;
//   transform: scaleX(1);
//   transition: transform 1s linear;
// }

// /* FIX TOGGLE */

// .fix-toggle-btn {
//   display: none;
//   width: 100%;
//   align-items: center;
//   justify-content: space-between;
//   padding: 11px 17px;
//   border-radius: var(--radius);
//   border: 1px solid var(--green-border);
//   background: var(--green-dim);
//   color: var(--green);
//   font-family: var(--font-ui);
//   font-size: 13px;
//   font-weight: 600;
//   cursor: pointer;
// }

// .fix-toggle-btn:hover {
//   background: rgba(78,201,148,.2);
// }

// .fix-toggle-btn.visible {
//   display: flex;
// }

// .fix-toggle-left {
//   display: flex;
//   align-items: center;
//   gap: 8px;
// }

// .fix-toggle-chevron {
//   display: inline-flex;
//   transition: transform .3s ease;
// }

// .fix-toggle-chevron.open {
//   transform: rotate(180deg);
// }

// /* COLLAPSIBLE FIX */

// .fix-collapse {
//   display: grid;
//   grid-template-rows: 0fr;
//   transition: grid-template-rows .3s ease;
//   margin-top: 8px;
// }

// .fix-collapse.open {
//   grid-template-rows: 1fr;
// }

// .fix-collapse-inner {
//   overflow: hidden;
// }

// /* FOOTER */

// .footer {
//   margin-top: 26px;
//   padding: 13px 20px 8px;
//   border-top: 1px solid var(--border);
//   display: flex;
//   flex-direction: column;
//   align-items: center;
//   justify-content: center;
//   gap: 7px;
//   font-size: 10px;
//   color: var(--fg-muted);
//   opacity: .7;
//   letter-spacing: .04em;
//   text-align: center;
// }

// .footer-logo {
//   display: block;
//   width: 105px;
//   max-width: 45%;
//   height: auto;
//   object-fit: contain;
// }

// /* SMALL SCREENS */

// @media (max-width: 420px) {
//   .header-top {
//     align-items: flex-start;
//     flex-direction: column;
//   }

//   .header-logo {
//     width: 165px;
//   }

//   .body {
//     padding-left: 13px;
//     padding-right: 13px;
//   }
// }

// @media (prefers-reduced-motion: reduce) {
//   *,
//   *::before,
//   *::after {
//     animation-duration: .01ms !important;
//     transition-duration: .01ms !important;
//   }
// }
// </style>
// </head>

// <body>

// <!-- HEADER -->
// <div class="header">
//   <div class="header-top">

//     <div class="header-title">
//       <img
//         src="${logoUri}"
//         alt="Code Equalize"
//         class="header-logo"
//       />
//     </div>

//     <div class="header-badges">
//       ${errorTypeBadge}
//       ${sourceBadge}
//     </div>

//   </div>

//   <div class="header-meta">
//     ${locationHtml}
//   </div>

//   ${matchedHtml}
// </div>

// <!-- EXPLANATION CONTENT -->
// <div class="body">

//   <div class="section">
//     <div class="section-label blue-label">
//       <span class="label-icon">🤔</span>
//       <span>Why This Happened</span>
//     </div>

//     <div class="card card-explanation">
//       ${renderMarkdown(data.explanation)}
//     </div>
//   </div>

//   <!-- CODE FIX -->
//   <div class="section">

//     <div class="section-label green-label">
//       <span class="label-icon">🛠️</span>
//       <span>How to Fix It</span>
//     </div>

//     <div class="fix-locked" id="fixLocked">

//       <div class="countdown-ring">
//         <svg width="70" height="70" viewBox="0 0 70 70">
//           <circle class="track" cx="35" cy="35" r="30"/>
//           <circle
//             class="progress"
//             id="progressCircle"
//             cx="35"
//             cy="35"
//             r="30"
//           />
//         </svg>

//         <div class="countdown-number" id="countdownNum">15</div>
//       </div>

//       <div class="fix-locked-title">
//         Code Fix is locked 🔒
//       </div>

//       <div class="fix-locked-sub">
//         Read the explanation above first.<br>
//         The fix unlocks in a moment.
//       </div>

//       <div class="fix-progress-bar">
//         <div class="fix-progress-fill" id="progressBar"></div>
//       </div>

//     </div>

//     <button
//       class="fix-toggle-btn"
//       id="toggleBtn"
//       onclick="toggleFix()"
//     >
//       <span class="fix-toggle-left">
//         <span id="toggleLabel">✓ Show Code Fix</span>
//       </span>

//       <span class="fix-toggle-chevron" id="toggleChevron">
//         <svg width="15" height="15" viewBox="0 0 24 24"
//           fill="none" stroke="currentColor" stroke-width="2.5"
//           stroke-linecap="round" stroke-linejoin="round">
//           <polyline points="6 9 12 15 18 9"/>
//         </svg>
//       </span>
//     </button>

//     <div class="fix-collapse" id="fixCollapse">
//       <div class="fix-collapse-inner">
//         <div class="card card-fix">
//           ${fixHtml}
//         </div>
//       </div>
//     </div>

//   </div>

//   ${rememberHtml}

// </div>

// <!-- FOOTER -->
// <div class="footer">
//   <img
//     src="${logoUri}"
//     alt="Code Equalize"
//     class="footer-logo"
//   />
//   <span>© 2026 Code Equalize. All rights reserved.</span>
// </div>

// <script>
//   // 15-second code-fix countdown
//   const TOTAL = 15;
//   let remaining = TOTAL;

//   const circle = document.getElementById('progressCircle');
//   const numEl = document.getElementById('countdownNum');
//   const barEl = document.getElementById('progressBar');
//   const lockedEl = document.getElementById('fixLocked');
//   const toggleBtn = document.getElementById('toggleBtn');

//   const CIRCUMFERENCE = 2 * Math.PI * 30;

//   circle.style.strokeDashoffset = '0';

//   const timer = setInterval(() => {
//     remaining--;

//     const fraction = remaining / TOTAL;

//     circle.style.strokeDashoffset =
//       String(CIRCUMFERENCE * (1 - fraction));

//     numEl.textContent = String(remaining);

//     if (remaining <= 5) {
//       circle.style.stroke = 'var(--amber)';
//       numEl.style.color = 'var(--amber)';
//     }

//     barEl.style.transform = 'scaleX(' + fraction + ')';

//     if (remaining <= 0) {
//       clearInterval(timer);
//       lockedEl.style.display = 'none';
//       toggleBtn.classList.add('visible');
//     }
//   }, 1000);

//   // Expand and collapse the code fix
//   let fixOpen = false;

//   function toggleFix() {
//     fixOpen = !fixOpen;

//     document
//       .getElementById('fixCollapse')
//       .classList.toggle('open', fixOpen);

//     document
//       .getElementById('toggleChevron')
//       .classList.toggle('open', fixOpen);

//     document.getElementById('toggleLabel').textContent =
//       fixOpen ? '🔼 Hide Code Fix' : '✓ Show Code Fix';
//   }

//   // Copy code blocks
//   function copyCode(button, encoded) {
//     const text = decodeURIComponent(encoded);

//     const doFlash = () => {
//       button.classList.add('copied');

//       const original = button.innerHTML;
//       button.textContent = 'Copied!';

//       setTimeout(() => {
//         button.classList.remove('copied');
//         button.innerHTML = original;
//       }, 2000);
//     };

//     navigator.clipboard.writeText(text)
//       .then(doFlash)
//       .catch(() => {
//         const textarea = document.createElement('textarea');

//         textarea.value = text;
//         textarea.style.cssText = 'position:fixed;opacity:0';

//         document.body.appendChild(textarea);
//         textarea.select();

//         document.execCommand('copy');
//         document.body.removeChild(textarea);

//         doFlash();
//       });
//   }
// </script>

// </body>
// </html>`;
// }




// import * as vscode from "vscode";

// type PanelData = {

//   explanation: string;

//   fix: string;

//   remember?: string | null;

//   source: "AI" | "ChromaDB" | string;

//   matchedError?: string;

//   similarity?: number | null;

//   errorType?: 'diagnostic' | 'runtime';

//   // New fields for location + language display

//   fileName?: string;

//   lineNumber?: number;

//   targetLanguage?: string;

// };

// export function showPanel(

//   data: PanelData,

//   extensionUri: vscode.Uri

// ): void {

//   const panel = vscode.window.createWebviewPanel(

//     "codeEqualize",

//     "Code Equalize",

//     vscode.ViewColumn.Beside,

//     { enableScripts: true }

//   );

//   panel.iconPath = vscode.Uri.joinPath(

//     extensionUri,

//     'media',

//     'code-equalize-icon.png'

//   );

//   panel.webview.html = getWebviewContent(data);

// }

// function escapeHtml(text: string): string {

//   return text

//     .replace(/&/g, "&")

//     .replace(/</g, "<")

//     .replace(/>/g, ">");

// }

// /**

//  * Renders markdown to HTML.

//  * Code blocks get a per-block copy button.

//  */

// function renderMarkdown(text: string): string {

//   if (!text) return "";

//   const parts: { type: string; content: string; index?: number }[] = [];

//   let codeBlockIndex = 0;

//   const codeBlockRegex = /```[\w]*\n?([\s\S]*?)```/g;

//   let lastIndex = 0;

//   let match: RegExpExecArray | null;

//   while ((match = codeBlockRegex.exec(text)) !== null) {

//     const before = text.slice(lastIndex, match.index);

//     parts.push({ type: 'text', content: before });

//     parts.push({ type: 'code', content: match[1], index: codeBlockIndex++ });

//     lastIndex = match.index + match[0].length;

//   }

//   parts.push({ type: 'text', content: text.slice(lastIndex) });

//   return parts.map((part) => {

//     if (part.type === 'code') {

//       const escaped = escapeHtml(part.content.trimEnd());

//       const encoded = encodeURIComponent(part.content.trimEnd());

//       return `<div class="code-block-wrap">

//   <button class="copy-btn" onclick="copyCode(this, '${encoded}')" title="Copy code">

//     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">

//       <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>

//     </svg>

//     Copy

//   </button>

//   <pre><code>${escaped}</code></pre>

// </div>`;

//     } else {

//       const escaped = escapeHtml(part.content);

//       return escaped

//         .replace(/`([^`]+)`/g, `<code class="inline">$1</code>`)

//         .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")

//         .replace(/\n/g, "<br>");

//     }

//   }).join('').trim();

// }

// function getWebviewContent(data: PanelData): string {

//   const isChroma  = data.source === "ChromaDB";

//   const isRuntime = data.errorType === "runtime";

//   // ── Badge tooltips ──────────────────────────────────────────

//   const errorTypeTooltip = isRuntime

//     ? "Runtime Error: occurs while the program is running — e.g. null pointer, division by zero, stack overflow."

//     : "Diagnostic Error: caught by the language server before your code runs — e.g. syntax error or type mismatch.";

//   const sourceTooltip = isChroma

//     ? "ChromaDB: retrieved from the local error knowledge base using vector similarity search."

//     : "AI Generated: Groq AI (LLaMA) generated this explanation from your code.";

//   const errorTypeBadge = isRuntime

//     ? `<span class="badge badge-runtime"  data-tooltip="${errorTypeTooltip}">⚡ Runtime Error</span>`

//     : `<span class="badge badge-diagnostic" data-tooltip="${errorTypeTooltip}">🔍 Diagnostic Error</span>`;

//   const sourceBadge = isChroma

//     ? `<span class="badge badge-chroma" data-tooltip="${sourceTooltip}">📚 ChromaDB</span>`

//     : `<span class="badge badge-ai"     data-tooltip="${sourceTooltip}">🤖 AI Generated</span>`;

//   // ── Location chip (filename + line) ─────────────────────────

//   const locationHtml = (data.fileName || data.lineNumber !== undefined)

//     ? `<div class="location-chip">

//         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">

//           <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>

//         </svg>

//         <span class="location-file">${escapeHtml(data.fileName ?? 'Unknown file')}</span>

//         ${data.lineNumber !== undefined && data.lineNumber > 0

//           ? `<span class="location-sep">·</span><span class="location-line">Line ${data.lineNumber + 1}</span>`

//           : ''}

//         ${data.targetLanguage

//           ? `<span class="location-sep">·</span>

//              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">

//                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>

//                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>

//              </svg>

//              <span class="location-lang">${escapeHtml(data.targetLanguage)}</span>`

//           : ''}

//        </div>`

//     : '';

//   // ── Matched error bar ────────────────────────────────────────

//   const matchedHtml = isChroma && data.matchedError

//     ? `<div class="matched-bar">

//         <span class="matched-dot"></span>

//         <span class="matched-label">Matched:</span>

//         <code class="matched-value">${escapeHtml(data.matchedError)}</code>

//        </div>`

//     : "";

//   // ── Remember section ─────────────────────────────────────────

//   const rememberHtml = data.remember

//     ? `<div class="section">

//         <div class="section-label amber-label">

//           <span class="label-icon">💡</span>

//           <span>Remember for Next Time</span>

//         </div>

//         <div class="card card-remember">${renderMarkdown(data.remember)}</div>

//        </div>`

//     : "";

//   const fixHtml = renderMarkdown(data.fix);

//   return `<!DOCTYPE html>

// <html lang="en">

// <head>

// <meta charset="UTF-8">

// <meta name="viewport" content="width=device-width, initial-scale=1.0">

// <style>

//   :root {

//     --bg:           var(--vscode-editor-background);

//     --fg:           var(--vscode-editor-foreground);

//     --fg-muted:     var(--vscode-descriptionForeground, #8b949e);

//     --border:       var(--vscode-panel-border, rgba(128,128,128,.18));

//     --surface:      var(--vscode-editorWidget-background, rgba(128,128,128,.06));

//     --code-bg:      var(--vscode-textCodeBlock-background, rgba(0,0,0,.22));

//     --blue:         #4FC1FF;

//     --blue-dim:     rgba(79,193,255,.10);

//     --blue-border:  rgba(79,193,255,.28);

//     --blue-label:   rgba(79,193,255,.15);

//     --green:        #4EC994;

//     --green-dim:    rgba(78,201,148,.10);

//     --green-border: rgba(78,201,148,.28);

//     --green-label:  rgba(78,201,148,.15);

//     --amber:        #E5A11C;

//     --amber-dim:    rgba(229,161,28,.10);

//     --amber-border: rgba(229,161,28,.28);

//     --amber-label:  rgba(229,161,28,.15);

//     --purple:       #C586C0;

//     --purple-dim:   rgba(197,134,192,.10);

//     --purple-border:rgba(197,134,192,.28);

//     --radius: 9px;

//     --font-ui:   var(--vscode-font-family, -apple-system, "Segoe UI", sans-serif);

//     --font-mono: var(--vscode-editor-font-family, "Cascadia Code", Consolas, monospace);

//   }

//   * { box-sizing: border-box; margin: 0; padding: 0; }

//   body {

//     font-family: var(--font-ui); font-size: 13.5px;

//     background: var(--bg); color: var(--fg);

//     line-height: 1.75; padding-bottom: 48px;

//   }

//   /* ── Header ── */

//   .header {

//     padding: 16px 20px 14px;

//     border-bottom: 1px solid var(--border);

//     background: linear-gradient(135deg, rgba(79,193,255,.06) 0%, rgba(78,201,148,.04) 60%, transparent 100%);

//   }

//   .header-top {

//     display: flex; align-items: center; justify-content: space-between;

//     gap: 10px; flex-wrap: wrap; margin-bottom: 10px;

//   }

//   .header-title {

//     display: flex; align-items: center; gap: 10px;

//     font-size: 15px; font-weight: 700; letter-spacing: -.025em;

//   }

//   .logo-icon {

//     width: 30px; height: 30px; border-radius: 7px;

//     background: linear-gradient(135deg, var(--blue-dim), var(--green-dim));

//     border: 1px solid var(--blue-border);

//     display: flex; align-items: center; justify-content: center;

//     font-size: 15px; flex-shrink: 0;

//   }

//   .header-badges { display: flex; gap: 6px; flex-wrap: wrap; }

//   .header-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

//   /* ── Location chip ── */

//   .location-chip {

//     display: inline-flex; align-items: center; gap: 5px;

//     padding: 4px 10px; border-radius: 6px;

//     background: var(--surface); border: 1px solid var(--border);

//     font-size: 11.5px; color: var(--fg-muted);

//     font-family: var(--font-mono);

//   }

//   .location-file { color: var(--fg); font-weight: 600; }

//   .location-line { color: var(--blue); font-weight: 600; }

//   .location-lang { color: var(--purple); font-weight: 600; font-family: var(--font-ui); }

//   .location-sep  { color: var(--fg-muted); opacity: .5; }

//   /* ── Badges ── */

//   .badge {

//     position: relative; display: inline-flex; align-items: center; gap: 5px;

//     padding: 3px 10px; border-radius: 99px;

//     font-size: 11px; font-weight: 600; letter-spacing: .03em;

//     border: 1px solid transparent; cursor: default;

//     transition: filter .15s, transform .15s; user-select: none;

//   }

//   .badge:hover { filter: brightness(1.15); transform: translateY(-1px); }

//   .badge-runtime    { color: var(--amber);  background: var(--amber-dim);  border-color: var(--amber-border); }

//   .badge-diagnostic { color: var(--blue);   background: var(--blue-dim);   border-color: var(--blue-border); }

//   .badge-chroma     { color: var(--green);  background: var(--green-dim);  border-color: var(--green-border); }

//   .badge-ai         { color: var(--purple); background: var(--purple-dim); border-color: var(--purple-border); }

//   .badge::after {

//     content: attr(data-tooltip);

//     position: absolute; top: calc(100% + 7px); right: 0; width: 230px;

//     background: var(--vscode-editorHoverWidget-background, #1e1e2e);

//     color: var(--fg); border: 1px solid var(--border);

//     border-radius: 7px; padding: 9px 12px;

//     font-size: 11.5px; font-weight: 400; line-height: 1.55; letter-spacing: 0;

//     white-space: normal; z-index: 99; opacity: 0; pointer-events: none;

//     transform: translateY(4px); transition: opacity .18s, transform .18s;

//     box-shadow: 0 4px 18px rgba(0,0,0,.35);

//   }

//   .badge:hover::after { opacity: 1; transform: translateY(0); }

//   /* ── Matched bar ── */

//   .matched-bar {

//     display: flex; align-items: center; gap: 8px;

//     padding: 7px 12px; border-radius: 7px; margin-top: 8px;

//     background: var(--green-dim); border: 1px solid var(--green-border); font-size: 12px;

//   }

//   .matched-dot {

//     width: 6px; height: 6px; border-radius: 50%;

//     background: var(--green); box-shadow: 0 0 5px var(--green); flex-shrink: 0;

//   }

//   .matched-label { color: var(--fg-muted); font-weight: 600; flex-shrink: 0; }

//   .matched-value { font-family: var(--font-mono); font-size: 11.5px; color: var(--green); background: none; border: none; padding: 0; }

//   /* ── Body ── */

//   .body { padding: 18px 20px 0; display: flex; flex-direction: column; gap: 18px; }

//   /* ── Section label pills ── */

//   .section-label {

//     display: flex; align-items: center; gap: 7px; margin-bottom: 8px;

//     font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;

//     padding: 4px 10px; border-radius: 6px; width: fit-content;

//     color: var(--fg-muted); background: var(--surface); border: 1px solid var(--border);

//   }

//   .blue-label  { color: var(--blue);  background: var(--blue-label);  border-color: var(--blue-border); }

//   .green-label { color: var(--green); background: var(--green-label); border-color: var(--green-border); }

//   .amber-label { color: var(--amber); background: var(--amber-label); border-color: var(--amber-border); }

//   .label-icon { font-size: 12px; }

//   /* ── Cards ── */

//   .card {

//     background: var(--surface); border: 1px solid var(--border);

//     border-radius: var(--radius); padding: 14px 17px;

//     font-size: 13.5px; line-height: 1.8;

//   }

//   .card-explanation { border-left: 3px solid var(--blue);  background: var(--blue-dim);  border-color: var(--blue-border); }

//   .card-fix         { border-left: 3px solid var(--green); background: var(--green-dim); border-color: var(--green-border); }

//   .card-remember    { border-left: 3px solid var(--amber); background: var(--amber-dim); border-color: var(--amber-border); }

//   /* ── Code blocks ── */

//   .code-block-wrap { position: relative; margin: 12px 0 4px; }

//   .code-block-wrap pre {

//     margin: 0; background: var(--code-bg); border: 1px solid var(--border);

//     border-radius: var(--radius); padding: 36px 14px 13px;

//     overflow-x: auto; font-size: 12.5px; line-height: 1.6;

//   }

//   .copy-btn {

//     position: absolute; top: 7px; right: 7px;

//     display: inline-flex; align-items: center; gap: 5px;

//     padding: 3px 9px; background: var(--surface);

//     border: 1px solid var(--border); border-radius: 5px;

//     color: var(--fg-muted); font-family: var(--font-ui);

//     font-size: 11px; font-weight: 600; cursor: pointer;

//     transition: background .15s, color .15s, border-color .15s; z-index: 2;

//   }

//   .copy-btn:hover   { background: var(--green-dim); color: var(--green); border-color: var(--green-border); }

//   .copy-btn.copied  { background: var(--green-dim); color: var(--green); border-color: var(--green-border); }

//   code { font-family: var(--font-mono); font-size: 12.5px; }

//   code.inline {

//     background: rgba(128,128,128,.13); padding: 2px 5px;

//     border-radius: 4px; font-size: 12px; border: 1px solid var(--border);

//   }

//   pre code { background: none; border: none; padding: 0; }

//   /* ── Fix locked ── */

//   .fix-locked {

//     border-radius: var(--radius); border: 1px dashed var(--border);

//     background: var(--surface); padding: 24px 20px 20px; text-align: center;

//   }

//   .countdown-ring { position: relative; width: 70px; height: 70px; margin: 0 auto 13px; }

//   .countdown-ring svg { transform: rotate(-90deg); }

//   .countdown-ring .track    { fill: none; stroke: var(--border); stroke-width: 4; }

//   .countdown-ring .progress {

//     fill: none; stroke: var(--green); stroke-width: 4;

//     stroke-linecap: round; stroke-dasharray: 188.5; stroke-dashoffset: 0;

//     transition: stroke-dashoffset 1s linear, stroke .4s;

//   }

//   .countdown-number {

//     position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;

//     font-size: 20px; font-weight: 700; color: var(--green);

//     font-variant-numeric: tabular-nums; transition: color .4s;

//   }

//   .fix-locked-title { font-size: 13px; font-weight: 600; margin-bottom: 4px; }

//   .fix-locked-sub   { font-size: 11.5px; color: var(--fg-muted); line-height: 1.6; max-width: 260px; margin: 0 auto; }

//   .fix-progress-bar { height: 2px; border-radius: 99px; background: var(--border); margin-top: 14px; overflow: hidden; }

//   .fix-progress-fill {

//     height: 100%; width: 100%;

//     background: linear-gradient(90deg, var(--blue), var(--green));

//     border-radius: 99px; transform-origin: left; transform: scaleX(1);

//     transition: transform 1s linear;

//   }

//   /* ── Toggle button ── */

//   .fix-toggle-btn {

//     display: none; width: 100%; align-items: center; justify-content: space-between;

//     padding: 11px 17px; border-radius: var(--radius);

//     border: 1px solid var(--green-border); background: var(--green-dim);

//     color: var(--green); font-family: var(--font-ui);

//     font-size: 13px; font-weight: 600; cursor: pointer;

//     transition: background .2s, box-shadow .2s; letter-spacing: .01em;

//   }

//   .fix-toggle-btn:hover { background: rgba(78,201,148,.2); box-shadow: 0 0 12px rgba(78,201,148,.18); }

//   .fix-toggle-btn.visible { display: flex; }

//   .fix-toggle-left { display: flex; align-items: center; gap: 8px; }

//   .fix-toggle-chevron { display: inline-flex; transition: transform .3s ease; flex-shrink: 0; }

//   .fix-toggle-chevron.open { transform: rotate(180deg); }

//   /* ── Collapsible ── */

//   .fix-collapse { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .3s ease; margin-top: 8px; }

//   .fix-collapse.open { grid-template-rows: 1fr; }

//   .fix-collapse-inner { overflow: hidden; }

//   /* ── Footer ── */

//   .footer {

//     margin-top: 26px; padding: 12px 20px 0; border-top: 1px solid var(--border);

//     display: flex; align-items: center; justify-content: center;

//     gap: 8px; font-size: 11px; color: var(--fg-muted); opacity: .45; letter-spacing: .05em;

//   }

// </style>

// </head>

// <body>

// <div class="header">

//   <div class="header-top">

//     <div class="header-title">

//       <div class="logo-icon">⚖️</div>

//       Code Equalize

//     </div>

//     <div class="header-badges">

//       ${errorTypeBadge}

//       ${sourceBadge}

//     </div>

//   </div>

//   <div class="header-meta">

//     ${locationHtml}

//   </div>

//   ${matchedHtml}

// </div>

// <div class="body">

//   <!-- Why This Happened -->

//   <div class="section">

//     <div class="section-label blue-label">

//       <span class="label-icon">🤔</span>

//       <span>Why This Happened</span>

//     </div>

//     <div class="card card-explanation">${renderMarkdown(data.explanation)}</div>

//   </div>

//   <!-- How to Fix It -->

//   <div class="section">

//     <div class="section-label green-label">

//       <span class="label-icon">🛠️</span>

//       <span>How to Fix It</span>

//     </div>

//     <div class="fix-locked" id="fixLocked">

//       <div class="countdown-ring">

//         <svg width="70" height="70" viewBox="0 0 70 70">

//           <circle class="track"    cx="35" cy="35" r="30"/>

//           <circle class="progress" id="progressCircle" cx="35" cy="35" r="30"/>

//         </svg>

//         <div class="countdown-number" id="countdownNum">15</div>

//       </div>

//       <div class="fix-locked-title">Code Fix is locked 🔒</div>

//       <div class="fix-locked-sub">Read the explanation above first.<br>The fix unlocks in a moment.</div>

//       <div class="fix-progress-bar"><div class="fix-progress-fill" id="progressBar"></div></div>

//     </div>

//     <button class="fix-toggle-btn" id="toggleBtn" onclick="toggleFix()">

//       <span class="fix-toggle-left">

//         <span id="toggleLabel">✅ Show Code Fix</span>

//       </span>

//       <span class="fix-toggle-chevron" id="toggleChevron">

//         <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">

//           <polyline points="6 9 12 15 18 9"/>

//         </svg>

//       </span>

//     </button>

//     <div class="fix-collapse" id="fixCollapse">

//       <div class="fix-collapse-inner">

//         <div class="card card-fix">${fixHtml}</div>

//       </div>

//     </div>

//   </div>

//   ${rememberHtml}

// </div>

// <div class="footer">⚖️  The compiler complained. We explained.</div>

// <script>

//   const TOTAL = 15;

//   let remaining = TOTAL;

//   const circle    = document.getElementById('progressCircle');

//   const numEl     = document.getElementById('countdownNum');

//   const barEl     = document.getElementById('progressBar');

//   const lockedEl  = document.getElementById('fixLocked');

//   const toggleBtn = document.getElementById('toggleBtn');

//   const CIRCUMFERENCE = 2 * Math.PI * 30;

//   circle.style.strokeDashoffset = '0';

//   const timer = setInterval(() => {

//     remaining--;

//     const frac = remaining / TOTAL;

//     circle.style.strokeDashoffset = CIRCUMFERENCE * (1 - frac);

//     numEl.textContent = remaining;

//     if (remaining <= 5) {

//       circle.style.stroke = 'var(--amber)';

//       numEl.style.color   = 'var(--amber)';

//     }

//     barEl.style.transform = 'scaleX(' + frac + ')';

//     if (remaining <= 0) {

//       clearInterval(timer);

//       lockedEl.style.display = 'none';

//       toggleBtn.classList.add('visible');

//     }

//   }, 1000);

//   let fixOpen = false;

//   function toggleFix() {

//     fixOpen = !fixOpen;

//     document.getElementById('fixCollapse').classList.toggle('open', fixOpen);

//     document.getElementById('toggleChevron').classList.toggle('open', fixOpen);

//     document.getElementById('toggleLabel').textContent = fixOpen ? '🔼 Hide Code Fix' : '✅ Show Code Fix';

//   }

//   function copyCode(btn, encoded) {

//     const text = decodeURIComponent(encoded);

//     const doFlash = () => {

//       btn.classList.add('copied');

//       const orig = btn.innerHTML;

//       btn.innerHTML = \`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 12 4 10"/><line x1="4" y1="10" x2="4" y2="18"/><polyline points="4 18 20 18"/></svg> Copied!\`;

//       setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = orig; }, 2000);

//     };

//     navigator.clipboard.writeText(text).then(doFlash).catch(() => {

//       const ta = document.createElement('textarea');

//       ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';

//       document.body.appendChild(ta); ta.select(); document.execCommand('copy');

//       document.body.removeChild(ta); doFlash();

//     });

//   }

// </script>

// </body>

// </html>`;

// }





// import * as vscode from 'vscode';

// import { ErrorEntry } from './errorExtractor';

// const TARGET_LANGUAGES = [

//   'English', 'Hindi', 'Bengali', 'Marathi', 'Telugu',

//   'Tamil', 'Gujarati', 'Urdu', 'Kannada', 'Odia', 'Malayalam'

// ];

// export type PanelData = {

//   explanation: string;

//   fix: string;

//   remember?: string | null;

//   source: 'AI' | 'ChromaDB' | string;

//   matchedError?: string;

//   distance?: number | null;

//   errorType?: 'diagnostic' | 'runtime';

//   fileName?: string;

//   lineNumber?: number;

//   targetLanguage?: string;

//   errors?: ErrorEntry[];

//   singleErrorWarning?: boolean;

// };

// export type LanguageChangeHandler = (

//   targetLanguage: string

// ) => Promise<PanelData>;

// export function showPanel(

//   data: PanelData,

//   onLanguageChange: LanguageChangeHandler

// ): vscode.WebviewPanel {

//   const panel = vscode.window.createWebviewPanel(

//     'codeEqualize',

//     'Code Equalize',

//     vscode.ViewColumn.Beside,

//     { enableScripts: true }

//   );

//   panel.webview.html = getWebviewContent(data);

//   panel.webview.onDidReceiveMessage(async message => {

//     if (

//       message?.command !== 'changeLanguage' ||

//       !TARGET_LANGUAGES.includes(message.language)

//     ) {

//       return;

//     }

//     try {

//       const updatedData = await onLanguageChange(message.language);

//       if (!panel.visible) return;

//       panel.webview.html = getWebviewContent(updatedData);

// } catch (error) {
//   const errorMessage =
//     error instanceof Error
//       ? error.message
//       : 'Unable to regenerate explanation.';

//   await panel.webview.postMessage({
//     command: 'languageChangeFailed'
//   });

//   vscode.window.showErrorMessage(
//     `Code Equalize: ${errorMessage}`
//   );
// }

//   });

//   return panel;

// }

// function escapeHtml(value: string): string {

//   return value

//     .replace(/&/g, '&')

//     .replace(/</g, '<')

//     .replace(/>/g, '>')

//     .replace(/"/g, '"')

//     .replace(/'/g, ''');

// }

// function renderMarkdown(text: string): string {

//   if (!text) return '';

//   const parts: string[] = [];

//   const codeBlockRegex = /```[\w]*\n?([\s\S]*?)```/g;

//   let lastIndex = 0;

//   let match: RegExpExecArray | null;

//   let codeIndex = 0;

//   while ((match = codeBlockRegex.exec(text)) !== null) {

//     const before = text.slice(lastIndex, match.index);

//     parts.push(

//       escapeHtml(before)

//         .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

//         .replace(/`([^`]+)`/g, '<code class="inline">$1</code>')

//         .replace(/\n/g, '<br>')

//     );

//     const code = match[1].trimEnd();

//     const encoded = encodeURIComponent(code);

//     parts.push(`

//       <div class="code-block-wrap">

//         <button class="copy-btn"

//           onclick="copyCode(this, '${encoded}')">

//           Copy

//         </button>

//         <pre><code>${escapeHtml(code)}</code></pre>

//       </div>

//     `);

//     lastIndex = match.index + match[0].length;

//     codeIndex++;

//   }

//   const remaining = text.slice(lastIndex);

//   parts.push(

//     escapeHtml(remaining)

//       .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

//       .replace(/`([^`]+)`/g, '<code class="inline">$1</code>')

//       .replace(/\n/g, '<br>')

//   );

//   return parts.join('').trim();

// }

// function getWebviewContent(data: PanelData): string {

//   const isChroma = data.source === 'ChromaDB';

//   const isRuntime = data.errorType === 'runtime';

//   // Sort errors by ascending line number.

//   // Unknown line numbers (-1) appear last.

//   const entries = [...(data.errors ?? [])].sort((a, b) => {

//     if (a.line < 0) return 1;

//     if (b.line < 0) return -1;

//     return a.line - b.line;

//   });

//   const selectedLanguage = TARGET_LANGUAGES.includes(

//     data.targetLanguage ?? ''

//   )

//     ? data.targetLanguage!

//     : 'English';

//   const errorTypeTooltip = isRuntime

//     ? 'Runtime Error: occurs while the program is running.'

//     : 'Diagnostic Error: reported by the editor or language server.';

//   const sourceTooltip = isChroma

//     ? 'Retrieved from the local ChromaDB knowledge base.'

//     : 'Generated using the AI explanation service.';

//   const errorTypeBadge = `

//     <span class="badge">

//       <span class="dot ${isRuntime ? 'amber' : 'blue'}"></span>

//       ${isRuntime ? 'Runtime Error' : 'Diagnostic Error'}

//       <span class="tooltip">${errorTypeTooltip}</span>

//     </span>

//   `;

//   const sourceBadge = `

//     <span class="badge">

//       <span class="dot ${isChroma ? 'green' : 'purple'}"></span>

//       ${isChroma ? 'ChromaDB' : 'AI Generated'}

//       <span class="tooltip">${sourceTooltip}</span>

//     </span>

//   `;

//   const locationHtml = data.fileName

//     ? `

//       <div class="location-chip">

//         <span>▤</span>

//         <span class="location-file">${escapeHtml(data.fileName)}</span>

//         <span class="separator">·</span>

//         <span class="language-name">${escapeHtml(selectedLanguage)}</span>

//       </div>

//     `

//     : `

//       <div class="location-chip">

//         <span class="language-name">${escapeHtml(selectedLanguage)}</span>

//       </div>

//     `;

//   const errorsHtml = entries.length > 1

//     ? `

//       <div class="errors-list">

//         <div class="errors-heading">

//           <span class="dot red"></span>

//           ${entries.length} Errors Detected

//         </div>

//         ${entries.map((error, index) => `

//           <div class="error-entry">

//             <span class="error-number">Error ${index + 1}</span>

//             <span class="error-line">

//               ${error.line >= 0 ? `Line ${error.line + 1}` : 'Unknown line'}

//             </span>

//             <code>${escapeHtml(error.message)}</code>

//           </div>

//         `).join('')}

//       </div>

//     `

//     : entries.length === 1

//       ? `

//         <div class="matched-bar">

//           <span class="dot green"></span>

//           <span class="matched-label">

//             ${entries[0].line >= 0

//               ? `Line ${entries[0].line + 1}`

//               : 'Error'}

//           </span>

//           <code>${escapeHtml(entries[0].message)}</code>

//         </div>

//       `

//       : data.matchedError

//         ? `

//           <div class="matched-bar">

//             <span class="dot green"></span>

//             <span class="matched-label">Matched:</span>

//             <code>${escapeHtml(data.matchedError)}</code>

//           </div>

//         `

//         : '';

//   const warningHtml = data.singleErrorWarning

//     ? `

//       <div class="warning">

//         Java may stop reporting additional errors after a syntax error.

//         Fix the reported error and run Code Equalize again.

//       </div>

//     `

//     : '';

//   const rememberHtml = data.remember

//     ? `

//       <section class="section">

//         <h3 class="amber-heading">Remember for Next Time</h3>

//         <div class="card remember-card">

//           ${renderMarkdown(data.remember)}

//         </div>

//       </section>

//     `

//     : '';

//   const languageOptions = TARGET_LANGUAGES.map(language => `

//     <option value="${language}"

//       ${language === selectedLanguage ? 'selected' : ''}>

//       ${language}

//     </option>

//   `).join('');

//   return `<!DOCTYPE html>

// <html lang="en">

// <head>

// <meta charset="UTF-8">

// <meta name="viewport" content="width=device-width, initial-scale=1.0">

// <style>

// :root {

//   --bg: var(--vscode-editor-background);

//   --fg: var(--vscode-editor-foreground);

//   --muted: var(--vscode-descriptionForeground);

//   --border: var(--vscode-panel-border);

//   --surface: var(--vscode-editorWidget-background);

//   --code-bg: var(--vscode-textCodeBlock-background);

//   --blue: #4FC1FF;

//   --green: #4EC994;

//   --amber: #E5A11C;

//   --purple: #C586C0;

//   --red: #F47067;

//   --font: var(--vscode-font-family);

//   --mono: var(--vscode-editor-font-family);

// }

// * {

//   box-sizing: border-box;

//   margin: 0;

//   padding: 0;

// }

// body {

//   background: var(--bg);

//   color: var(--fg);

//   font-family: var(--font);

//   font-size: 13px;

//   line-height: 1.7;

//   padding-bottom: 35px;

// }

// .header {

//   padding: 14px 18px 12px;

//   border-bottom: 1px solid var(--border);

// }

// .header-top {

//   display: flex;

//   justify-content: space-between;

//   align-items: center;

//   gap: 10px;

//   flex-wrap: wrap;

//   margin-bottom: 10px;

// }

// .header-title {

//   font-weight: 600;

//   font-size: 14px;

// }

// .header-badges {

//   display: flex;

//   gap: 6px;

//   flex-wrap: wrap;

// }

// .badge {

//   position: relative;

//   display: inline-flex;

//   align-items: center;

//   gap: 5px;

//   padding: 2px 8px;

//   border: 1px solid var(--border);

//   border-radius: 5px;

//   font-size: 10px;

//   color: var(--muted);

//   cursor: default;

// }

// .tooltip {

//   display: none;

//   position: absolute;

//   z-index: 10;

//   top: 110%;

//   right: 0;

//   width: 220px;

//   padding: 8px;

//   background: var(--vscode-editorHoverWidget-background);

//   border: 1px solid var(--border);

//   border-radius: 6px;

//   color: var(--fg);

//   white-space: normal;

// }

// .badge:hover .tooltip {

//   display: block;

// }

// .dot {

//   width: 5px;

//   height: 5px;

//   display: inline-block;

//   border-radius: 50%;

//   flex-shrink: 0;

// }

// .blue { background: var(--blue); }

// .green { background: var(--green); }

// .amber { background: var(--amber); }

// .purple { background: var(--purple); }

// .red { background: var(--red); }

// .header-meta {

//   display: flex;

//   align-items: center;

//   gap: 8px;

//   flex-wrap: wrap;

// }

// .location-chip {

//   display: inline-flex;

//   align-items: center;

//   gap: 7px;

//   background: var(--surface);

//   border: 1px solid var(--border);

//   border-radius: 5px;

//   padding: 3px 8px;

//   font-size: 11px;

//   color: var(--muted);

// }

// .location-file {

//   color: var(--fg);

// }

// .language-name {

//   color: var(--purple);

// }

// .separator {

//   opacity: .4;

// }

// .language-control {

//   display: flex;

//   align-items: center;

//   gap: 7px;

//   margin-top: 10px;

//   flex-wrap: wrap;

// }

// .language-control label {

//   font-size: 11px;

//   color: var(--muted);

// }

// .language-control select {

//   min-width: 135px;

//   padding: 5px 9px;

//   background: var(--vscode-dropdown-background);

//   color: var(--vscode-dropdown-foreground);

//   border: 1px solid var(--vscode-dropdown-border);

//   border-radius: 5px;

//   font-family: var(--font);

//   font-size: 11px;

// }

// .language-control select:focus {

//   outline: 1px solid var(--blue);

// }

// .language-status {

//   font-size: 11px;

//   color: var(--muted);

// }

// .errors-list {

//   margin-top: 10px;

//   border: 1px solid var(--border);

//   border-radius: 8px;

//   overflow: hidden;

// }

// .errors-heading {

//   padding: 6px 10px;

//   display: flex;

//   align-items: center;

//   gap: 7px;

//   background: rgba(128,128,128,.08);

//   border-bottom: 1px solid var(--border);

//   font-size: 10px;

//   text-transform: uppercase;

//   letter-spacing: .06em;

//   color: var(--muted);

// }

// .error-entry {

//   display: grid;

//   grid-template-columns: 55px 65px minmax(0, 1fr);

//   gap: 8px;

//   padding: 6px 10px;

//   align-items: baseline;

//   border-bottom: 1px solid var(--border);

//   font-size: 11px;

// }

// .error-entry:last-child {

//   border-bottom: none;

// }

// .error-number {

//   color: var(--muted);

//   font-size: 10px;

//   font-weight: 600;

// }

// .error-line {

//   color: var(--amber);

//   white-space: nowrap;

// }

// .error-entry code,

// .matched-bar code {

//   font-family: var(--mono);

//   font-size: 11px;

//   overflow-wrap: anywhere;

// }

// .matched-bar {

//   display: flex;

//   gap: 8px;

//   align-items: center;

//   padding: 7px 10px;

//   margin-top: 9px;

//   border: 1px solid rgba(78,201,148,.2);

//   border-radius: 5px;

//   background: rgba(78,201,148,.06);

//   font-size: 11px;

// }

// .matched-label {

//   color: var(--muted);

//   white-space: nowrap;

// }

// .warning {

//   margin-top: 9px;

//   padding: 8px 10px;

//   background: rgba(229,161,28,.08);

//   border: 1px solid rgba(229,161,28,.2);

//   border-radius: 5px;

//   color: var(--muted);

//   font-size: 11px;

// }

// .body {

//   padding: 17px 18px 0;

//   display: flex;

//   flex-direction: column;

//   gap: 20px;

// }

// .section h3 {

//   font-size: 11px;

//   text-transform: uppercase;

//   letter-spacing: .07em;

//   margin-bottom: 9px;

//   padding-bottom: 6px;

//   border-bottom: 1px solid var(--border);

// }

// .blue-heading { color: var(--blue); }

// .green-heading { color: var(--green); }

// .amber-heading { color: var(--amber); }

// .card {

//   background: var(--surface);

//   border: 1px solid var(--border);

//   border-radius: 8px;

//   padding: 13px 15px;

//   font-size: 13px;

//   line-height: 1.75;

//   overflow-wrap: anywhere;

// }

// .explanation-card {

//   border-left: 2px solid var(--blue);

// }

// .fix-card {

//   border-left: 2px solid var(--green);

// }

// .remember-card {

//   border-left: 2px solid var(--amber);

// }

// .inline {

//   font-family: var(--mono);

//   background: rgba(128,128,128,.12);

//   padding: 1px 4px;

//   border-radius: 3px;

//   font-size: 11px;

// }

// .code-block-wrap {

//   position: relative;

//   margin: 10px 0;

// }

// .code-block-wrap pre {

//   background: var(--code-bg);

//   border: 1px solid var(--border);

//   border-radius: 7px;

//   padding: 32px 12px 12px;

//   overflow-x: auto;

//   font-size: 12px;

//   line-height: 1.6;

// }

// pre code {

//   font-family: var(--mono);

// }

// .copy-btn {

//   position: absolute;

//   top: 6px;

//   right: 6px;

//   padding: 3px 9px;

//   border: 1px solid var(--border);

//   border-radius: 5px;

//   background: var(--surface);

//   color: var(--muted);

//   cursor: pointer;

//   font-size: 10px;

// }

// .copy-btn:hover {

//   color: var(--green);

// }

// .fix-locked {

//   padding: 20px;

//   text-align: center;

//   border: 1px solid var(--border);

//   border-radius: 8px;

//   background: var(--surface);

// }

// .countdown-number {

//   font-size: 19px;

//   font-weight: 600;

//   color: var(--blue);

//   margin: 5px;

// }

// .fix-locked-title {

//   font-weight: 600;

//   margin-bottom: 4px;

// }

// .fix-locked-sub {

//   color: var(--muted);

//   font-size: 11px;

// }

// .fix-toggle-btn {

//   display: none;

//   width: 100%;

//   justify-content: space-between;

//   padding: 9px 12px;

//   background: var(--surface);

//   border: 1px solid var(--border);

//   border-radius: 7px;

//   color: var(--green);

//   cursor: pointer;

//   font-size: 12px;

// }

// .fix-toggle-btn.visible {

//   display: flex;

// }

// .fix-collapse {

//   display: grid;

//   grid-template-rows: 0fr;

//   transition: grid-template-rows .25s ease;

//   margin-top: 6px;

// }

// .fix-collapse.open {

//   grid-template-rows: 1fr;

// }

// .fix-collapse-inner {

//   overflow: hidden;

// }

// .footer {

//   margin-top: 28px;

//   padding: 12px;

//   border-top: 1px solid var(--border);

//   text-align: center;

//   color: var(--muted);

//   font-size: 10px;

// }

// </style>

// </head>

// <body>

// <header class="header">

//   <div class="header-top">

//     <div class="header-title">⚖ Code Equalize</div>

//     <div class="header-badges">

//       ${errorTypeBadge}

//       ${sourceBadge}

//     </div>

//   </div>

//   <div class="header-meta">

//     ${locationHtml}

//   </div>

//   <div class="language-control">

//     <label for="languageSelect">Explanation language:</label>

//     <select id="languageSelect" onchange="changeLanguage(this.value)">

//       ${languageOptions}

//     </select>

//     <span id="languageStatus" class="language-status"></span>

//   </div>

//   ${errorsHtml}

//   ${warningHtml}

// </header>

// <main class="body">

//   <section class="section">

//     <h3 class="blue-heading">ⓘ Why This Happened</h3>

//     <div class="card explanation-card">

//       ${renderMarkdown(data.explanation)}

//     </div>

//   </section>

//   <section class="section">

//     <h3 class="green-heading">⚒ How to Fix It</h3>

//     <div class="fix-locked" id="fixLocked">

//       <div class="countdown-number" id="countdownNum">15</div>

//       <div class="fix-locked-title">Code Fix is locked 🔒</div>

//       <div class="fix-locked-sub">

//         Read the explanation above first.<br>

//         The fix unlocks in a moment.

//       </div>

//     </div>

//     <button class="fix-toggle-btn" id="toggleBtn"

//       onclick="toggleFix()">

//       <span id="toggleLabel">✓ Show Code Fix</span>

//       <span id="toggleChevron">⌄</span>

//     </button>

//     <div class="fix-collapse" id="fixCollapse">

//       <div class="fix-collapse-inner">

//         <div class="card fix-card">

//           ${renderMarkdown(data.fix)}

//         </div>

//       </div>

//     </div>

//   </section>

//   ${rememberHtml}

// </main>

// <footer class="footer">

//   ⚖ The compiler complained. We explained.

// </footer>

// <script>

//   const vscode = acquireVsCodeApi();

//   const TOTAL = 15;

//   let remaining = TOTAL;

//   const countdownNum = document.getElementById('countdownNum');

//   const lockedEl = document.getElementById('fixLocked');

//   const toggleBtn = document.getElementById('toggleBtn');

//   const timer = setInterval(() => {

//     remaining--;

//     countdownNum.textContent = remaining;

//     if (remaining <= 0) {

//       clearInterval(timer);

//       lockedEl.style.display = 'none';

//       toggleBtn.classList.add('visible');

//     }

//   }, 1000);

// let fixOpen = false;
// let changingLanguage = false;
// let previousLanguage = document.getElementById('languageSelect').value;

//   function toggleFix() {

//     fixOpen = !fixOpen;

//     document.getElementById('fixCollapse')

//       .classList.toggle('open', fixOpen);

//     document.getElementById('toggleLabel').textContent =

//       fixOpen ? '✓ Hide Code Fix' : '✓ Show Code Fix';

//     document.getElementById('toggleChevron').textContent =

//       fixOpen ? '⌃' : '⌄';

//   }

//   function changeLanguage(language) {

//     if (changingLanguage) return;
// previousLanguage = document.getElementById('languageSelect').value;

//     changingLanguage = true;

//     const select = document.getElementById('languageSelect');

//     const status = document.getElementById('languageStatus');

//     select.disabled = true;

//     status.textContent = 'Generating...';

//     vscode.postMessage({

//       command: 'changeLanguage',

//       language

//     });

//   }

//   function copyCode(button, encoded) {

//     const code = decodeURIComponent(encoded);

//     const flash = () => {

//       const original = button.textContent;

//       button.textContent = 'Copied!';

//       setTimeout(() => {

//         button.textContent = original;

//       }, 1800);

//     };

//     navigator.clipboard.writeText(code)

//       .then(flash)

//       .catch(() => {

//         const textarea = document.createElement('textarea');

//         textarea.value = code;

//         document.body.appendChild(textarea);

//         textarea.select();

//         document.execCommand('copy');

//         document.body.removeChild(textarea);

//         flash();

//       });

//   }

// </script>

// </body>

// </html>`;

// }



import * as vscode from 'vscode';

type PanelData = {
  explanation: string;
  fix: string;
  remember?: string | null;
  source: 'AI' | 'ChromaDB' | string;
  matchedError?: string;
  similarity?: number | null;
  errorType?: 'diagnostic' | 'runtime';
  fileName?: string;
  lineNumber?: number;
  targetLanguage?: string;
};

export function showPanel(
  data: PanelData,
  extensionUri: vscode.Uri
): void {
  const mediaFolder = vscode.Uri.joinPath(extensionUri, 'media');

  const panel = vscode.window.createWebviewPanel(
    'codeEqualize',
    'Code Equalize',
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      localResourceRoots: [mediaFolder]
    }
  );

  // VS Code editor tab icon
  panel.iconPath = vscode.Uri.joinPath(
    mediaFolder,
    'code-equalize-icon.png'
  );

  // Convert local image paths into webview-accessible URIs
  const logoUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(mediaFolder, 'code-equalize-logo.png')
  );

  panel.webview.html = getWebviewContent(
    data,
    logoUri.toString()
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renders markdown to HTML.
 * Code blocks receive individual copy buttons.
 */
function renderMarkdown(text: string): string {
  if (!text) {
    return '';
  }

  const parts: { type: string; content: string }[] = [];
  const codeBlockRegex = /```[\w]*\n?([\s\S]*?)```/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    parts.push({
      type: 'text',
      content: text.slice(lastIndex, match.index)
    });

    parts.push({
      type: 'code',
      content: match[1]
    });

    lastIndex = match.index + match[0].length;
  }

  parts.push({
    type: 'text',
    content: text.slice(lastIndex)
  });

  return parts.map((part) => {
    if (part.type === 'code') {
      const code = part.content.trimEnd();
      const escaped = escapeHtml(code);
      const encoded = encodeURIComponent(code).replace(/'/g, '%27');

      return `
        <div class="code-block-wrap">
          <button
            class="copy-btn"
            onclick="copyCode(this, '${encoded}')"
            title="Copy code"
          >
            <svg width="13" height="13" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy
          </button>
          <pre><code>${escaped}</code></pre>
        </div>
      `;
    }

    const escaped = escapeHtml(part.content);

    return escaped
      .replace(/`([^`]+)`/g, '<code class="inline">$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }).join('').trim();
}

function getWebviewContent(
  data: PanelData,
  logoUri: string
): string {
  const isChroma = data.source === 'ChromaDB';
  const isRuntime = data.errorType === 'runtime';

  const errorTypeTooltip = isRuntime
    ? 'Runtime Error: occurs while the program is running — e.g. null pointer, division by zero, stack overflow.'
    : 'Diagnostic Error: caught by the language server before your code runs — e.g. syntax error or type mismatch.';

  const sourceTooltip = isChroma
    ? 'ChromaDB: retrieved from the error knowledge base using vector similarity search.'
    : 'AI Generated: Groq AI generated this explanation using the retrieved context.';

  const errorTypeBadge = isRuntime
    ? `<span class="badge badge-runtime" data-tooltip="${errorTypeTooltip}">⚡ Runtime Error</span>`
    : `<span class="badge badge-diagnostic" data-tooltip="${errorTypeTooltip}">🔍 Diagnostic Error</span>`;

  const sourceBadge = isChroma
    ? `<span class="badge badge-chroma" data-tooltip="${sourceTooltip}">📚 ChromaDB</span>`
    : `<span class="badge badge-ai" data-tooltip="${sourceTooltip}">🤖 AI Generated</span>`;

  // File, line and explanation language information
  const locationHtml =
    data.fileName || data.lineNumber !== undefined || data.targetLanguage
      ? `
        <div class="location-chip">
          <svg width="12" height="12" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>

          ${data.fileName
            ? `<span class="location-file">${escapeHtml(data.fileName)}</span>`
            : ''}

          ${data.lineNumber !== undefined
            ? `<span class="location-sep">·</span>
               <span class="location-line">Line ${data.lineNumber + 1}</span>`
            : ''}

          ${data.targetLanguage
            ? `<span class="location-sep">·</span>
               <span class="location-lang">${escapeHtml(data.targetLanguage)}</span>`
            : ''}
        </div>
      `
      : '';

  // Matched knowledge-base error
  const matchedHtml =
    isChroma && data.matchedError
      ? `
        <div class="matched-bar">
          <span class="matched-dot"></span>
          <span class="matched-label">Matched:</span>
          <code class="matched-value">${escapeHtml(data.matchedError)}</code>
        </div>
      `
      : '';

  // Optional learning reminder
  const rememberHtml = data.remember
    ? `
      <div class="section">
        <div class="section-label amber-label">
          <span class="label-icon">💡</span>
          <span>Remember for Next Time</span>
        </div>
        <div class="card card-remember">
          ${renderMarkdown(data.remember)}
        </div>
      </div>
    `
    : '';

  const fixHtml = renderMarkdown(data.fix);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<style>
:root {
  --bg: var(--vscode-editor-background);
  --fg: var(--vscode-editor-foreground);
  --fg-muted: var(--vscode-descriptionForeground, #8b949e);
  --border: var(--vscode-panel-border, rgba(128,128,128,.18));
  --surface: var(--vscode-editorWidget-background, rgba(128,128,128,.06));
  --code-bg: var(--vscode-textCodeBlock-background, rgba(0,0,0,.22));

  --blue: #4FC1FF;
  --blue-dim: rgba(79,193,255,.10);
  --blue-border: rgba(79,193,255,.28);
  --blue-label: rgba(79,193,255,.15);

  --green: #4EC994;
  --green-dim: rgba(78,201,148,.10);
  --green-border: rgba(78,201,148,.28);
  --green-label: rgba(78,201,148,.15);

  --amber: #E5A11C;
  --amber-dim: rgba(229,161,28,.10);
  --amber-border: rgba(229,161,28,.28);
  --amber-label: rgba(229,161,28,.15);

  --purple: #C586C0;
  --purple-dim: rgba(197,134,192,.10);
  --purple-border: rgba(197,134,192,.28);

  --radius: 9px;
  --font-ui: var(--vscode-font-family, -apple-system, "Segoe UI", sans-serif);
  --font-mono: var(--vscode-editor-font-family, Consolas, monospace);
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-ui);
  font-size: 13.5px;
  background: var(--bg);
  color: var(--fg);
  line-height: 1.75;
  padding-bottom: 20px;
}

/* HEADER */

.header {
  padding: 16px 20px 14px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(
    135deg,
    rgba(79,193,255,.06),
    rgba(78,201,148,.04) 60%,
    transparent
  );
}

.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.header-title {
  display: flex;
  align-items: center;
  min-width: 0;
}

.header-logo {
  display: block;
  width: 190px;
  max-width: 100%;
  height: auto;
  object-fit: contain;
  animation: logoAppear .55s ease-out both;
}

@keyframes logoAppear {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.header-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.header-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* LOCATION */

.location-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 6px;
  background: var(--surface);
  border: 1px solid var(--border);
  font-size: 11.5px;
  color: var(--fg-muted);
  font-family: var(--font-mono);
}

.location-file {
  color: var(--fg);
  font-weight: 600;
}

.location-line {
  color: var(--blue);
  font-weight: 600;
}

.location-lang {
  color: var(--purple);
  font-weight: 600;
  font-family: var(--font-ui);
}

.location-sep {
  color: var(--fg-muted);
  opacity: .5;
}

/* BADGES */

.badge {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .03em;
  border: 1px solid transparent;
  cursor: default;
  transition: filter .15s, transform .15s;
  user-select: none;
}

.badge:hover {
  filter: brightness(1.15);
  transform: translateY(-1px);
}

.badge-runtime {
  color: var(--amber);
  background: var(--amber-dim);
  border-color: var(--amber-border);
}

.badge-diagnostic {
  color: var(--blue);
  background: var(--blue-dim);
  border-color: var(--blue-border);
}

.badge-chroma {
  color: var(--green);
  background: var(--green-dim);
  border-color: var(--green-border);
}

.badge-ai {
  color: var(--purple);
  background: var(--purple-dim);
  border-color: var(--purple-border);
}

.badge::after {
  content: attr(data-tooltip);
  position: absolute;
  top: calc(100% + 7px);
  right: 0;
  width: 230px;
  background: var(--vscode-editorHoverWidget-background, #1e1e2e);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 9px 12px;
  font-size: 11.5px;
  font-weight: 400;
  line-height: 1.55;
  white-space: normal;
  z-index: 99;
  opacity: 0;
  pointer-events: none;
  transform: translateY(4px);
  transition: opacity .18s, transform .18s;
  box-shadow: 0 4px 18px rgba(0,0,0,.35);
}

.badge:hover::after {
  opacity: 1;
  transform: translateY(0);
}

/* MATCHED ERROR */

.matched-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-radius: 7px;
  margin-top: 8px;
  background: var(--green-dim);
  border: 1px solid var(--green-border);
  font-size: 12px;
}

.matched-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 5px var(--green);
  flex-shrink: 0;
}

.matched-label {
  color: var(--fg-muted);
  font-weight: 600;
  flex-shrink: 0;
}

.matched-value {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--green);
  overflow-wrap: anywhere;
}

/* MAIN BODY */

.body {
  padding: 18px 20px 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* SECTION LABELS */

.section-label {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 8px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .1em;
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 6px;
  width: fit-content;
  color: var(--fg-muted);
  background: var(--surface);
  border: 1px solid var(--border);
}

.blue-label {
  color: var(--blue);
  background: var(--blue-label);
  border-color: var(--blue-border);
}

.green-label {
  color: var(--green);
  background: var(--green-label);
  border-color: var(--green-border);
}

.amber-label {
  color: var(--amber);
  background: var(--amber-label);
  border-color: var(--amber-border);
}

.label-icon {
  font-size: 12px;
}

/* EXPLANATION CARDS */

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 17px;
  font-size: 13.5px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}

.card-explanation {
  border-left: 3px solid var(--blue);
  background: var(--blue-dim);
  border-color: var(--blue-border);
}

.card-fix {
  border-left: 3px solid var(--green);
  background: var(--green-dim);
  border-color: var(--green-border);
}

.card-remember {
  border-left: 3px solid var(--amber);
  background: var(--amber-dim);
  border-color: var(--amber-border);
}

/* CODE BLOCKS */

.code-block-wrap {
  position: relative;
  margin: 12px 0 4px;
}

.code-block-wrap pre {
  margin: 0;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 36px 14px 13px;
  overflow-x: auto;
  font-size: 12.5px;
  line-height: 1.6;
}

.copy-btn {
  position: absolute;
  top: 7px;
  right: 7px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--fg-muted);
  font-family: var(--font-ui);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background .15s, color .15s;
  z-index: 2;
}

.copy-btn:hover,
.copy-btn.copied {
  background: var(--green-dim);
  color: var(--green);
  border-color: var(--green-border);
}

code {
  font-family: var(--font-mono);
  font-size: 12.5px;
}

code.inline {
  background: rgba(128,128,128,.13);
  padding: 2px 5px;
  border-radius: 4px;
  font-size: 12px;
  border: 1px solid var(--border);
}

pre code {
  background: none;
  border: none;
  padding: 0;
}

/* LOCKED CODE FIX */

.fix-locked {
  border-radius: var(--radius);
  border: 1px dashed var(--border);
  background: var(--surface);
  padding: 24px 20px 20px;
  text-align: center;
}

.countdown-ring {
  position: relative;
  width: 70px;
  height: 70px;
  margin: 0 auto 13px;
}

.countdown-ring svg {
  transform: rotate(-90deg);
}

.countdown-ring .track {
  fill: none;
  stroke: var(--border);
  stroke-width: 4;
}

.countdown-ring .progress {
  fill: none;
  stroke: var(--green);
  stroke-width: 4;
  stroke-linecap: round;
  stroke-dasharray: 188.5;
  stroke-dashoffset: 0;
  transition: stroke-dashoffset 1s linear, stroke .4s;
}

.countdown-number {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  color: var(--green);
  font-variant-numeric: tabular-nums;
}

.fix-locked-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
}

.fix-locked-sub {
  font-size: 11.5px;
  color: var(--fg-muted);
  line-height: 1.6;
  max-width: 260px;
  margin: 0 auto;
}

.fix-progress-bar {
  height: 2px;
  border-radius: 99px;
  background: var(--border);
  margin-top: 14px;
  overflow: hidden;
}

.fix-progress-fill {
  height: 100%;
  width: 100%;
  background: linear-gradient(90deg, var(--blue), var(--green));
  border-radius: 99px;
  transform-origin: left;
  transform: scaleX(1);
  transition: transform 1s linear;
}

/* FIX TOGGLE */

.fix-toggle-btn {
  display: none;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  padding: 11px 17px;
  border-radius: var(--radius);
  border: 1px solid var(--green-border);
  background: var(--green-dim);
  color: var(--green);
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.fix-toggle-btn:hover {
  background: rgba(78,201,148,.2);
}

.fix-toggle-btn.visible {
  display: flex;
}

.fix-toggle-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fix-toggle-chevron {
  display: inline-flex;
  transition: transform .3s ease;
}

.fix-toggle-chevron.open {
  transform: rotate(180deg);
}

/* COLLAPSIBLE FIX */

.fix-collapse {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows .3s ease;
  margin-top: 8px;
}

.fix-collapse.open {
  grid-template-rows: 1fr;
}

.fix-collapse-inner {
  overflow: hidden;
}

/* FOOTER */

.footer {
  margin-top: 26px;
  padding: 13px 20px 8px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font-size: 10px;
  color: var(--fg-muted);
  opacity: .7;
  letter-spacing: .04em;
  text-align: center;
}

.footer-logo {
  display: block;
  width: 105px;
  max-width: 45%;
  height: auto;
  object-fit: contain;
}

/* SMALL SCREENS */

@media (max-width: 420px) {
  .header-top {
    align-items: flex-start;
    flex-direction: column;
  }

  .header-logo {
    width: 165px;
  }

  .body {
    padding-left: 13px;
    padding-right: 13px;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: .01ms !important;
    transition-duration: .01ms !important;
  }
}
</style>
</head>

<body>

<!-- HEADER -->
<div class="header">
  <div class="header-top">

    <div class="header-title">
      <img
        src="${logoUri}"
        alt="Code Equalize"
        class="header-logo"
      />
    </div>

    <div class="header-badges">
      ${errorTypeBadge}
      ${sourceBadge}
    </div>

  </div>

  <div class="header-meta">
    ${locationHtml}
  </div>

  ${matchedHtml}
</div>

<!-- EXPLANATION CONTENT -->
<div class="body">

  <div class="section">
    <div class="section-label blue-label">
      <span class="label-icon">🤔</span>
      <span>Why This Happened</span>
    </div>

    <div class="card card-explanation">
      ${renderMarkdown(data.explanation)}
    </div>
  </div>

  <!-- CODE FIX -->
  <div class="section">

    <div class="section-label green-label">
      <span class="label-icon">🛠️</span>
      <span>How to Fix It</span>
    </div>

    <div class="fix-locked" id="fixLocked">

      <div class="countdown-ring">
        <svg width="70" height="70" viewBox="0 0 70 70">
          <circle class="track" cx="35" cy="35" r="30"/>
          <circle
            class="progress"
            id="progressCircle"
            cx="35"
            cy="35"
            r="30"
          />
        </svg>

        <div class="countdown-number" id="countdownNum">15</div>
      </div>

      <div class="fix-locked-title">
        Code Fix is locked 🔒
      </div>

      <div class="fix-locked-sub">
        Read the explanation above first.<br>
        The fix unlocks in a moment.
      </div>

      <div class="fix-progress-bar">
        <div class="fix-progress-fill" id="progressBar"></div>
      </div>

    </div>

    <button
      class="fix-toggle-btn"
      id="toggleBtn"
      onclick="toggleFix()"
    >
      <span class="fix-toggle-left">
        <span id="toggleLabel">✓ Show Code Fix</span>
      </span>

      <span class="fix-toggle-chevron" id="toggleChevron">
        <svg width="15" height="15" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </span>
    </button>

    <div class="fix-collapse" id="fixCollapse">
      <div class="fix-collapse-inner">
        <div class="card card-fix">
          ${fixHtml}
        </div>
      </div>
    </div>

  </div>

  ${rememberHtml}

</div>

<!-- FOOTER -->
<div class="footer">
  <img
    src="${logoUri}"
    alt="Code Equalize"
    class="footer-logo"
  />
  <span>© 2026 Code Equalize. All rights reserved.</span>
</div>

<script>
  // 15-second code-fix countdown
  const TOTAL = 15;
  let remaining = TOTAL;

  const circle = document.getElementById('progressCircle');
  const numEl = document.getElementById('countdownNum');
  const barEl = document.getElementById('progressBar');
  const lockedEl = document.getElementById('fixLocked');
  const toggleBtn = document.getElementById('toggleBtn');

  const CIRCUMFERENCE = 2 * Math.PI * 30;

  circle.style.strokeDashoffset = '0';

  const timer = setInterval(() => {
    remaining--;

    const fraction = remaining / TOTAL;

    circle.style.strokeDashoffset =
      String(CIRCUMFERENCE * (1 - fraction));

    numEl.textContent = String(remaining);

    if (remaining <= 5) {
      circle.style.stroke = 'var(--amber)';
      numEl.style.color = 'var(--amber)';
    }

    barEl.style.transform = 'scaleX(' + fraction + ')';

    if (remaining <= 0) {
      clearInterval(timer);
      lockedEl.style.display = 'none';
      toggleBtn.classList.add('visible');
    }
  }, 1000);

  // Expand and collapse the code fix
  let fixOpen = false;

  function toggleFix() {
    fixOpen = !fixOpen;

    document
      .getElementById('fixCollapse')
      .classList.toggle('open', fixOpen);

    document
      .getElementById('toggleChevron')
      .classList.toggle('open', fixOpen);

    document.getElementById('toggleLabel').textContent =
      fixOpen ? '🔼 Hide Code Fix' : '✓ Show Code Fix';
  }

  // Copy code blocks
  function copyCode(button, encoded) {
    const text = decodeURIComponent(encoded);

    const doFlash = () => {
      button.classList.add('copied');

      const original = button.innerHTML;
      button.textContent = 'Copied!';

      setTimeout(() => {
        button.classList.remove('copied');
        button.innerHTML = original;
      }, 2000);
    };

    navigator.clipboard.writeText(text)
      .then(doFlash)
      .catch(() => {
        const textarea = document.createElement('textarea');

        textarea.value = text;
        textarea.style.cssText = 'position:fixed;opacity:0';

        document.body.appendChild(textarea);
        textarea.select();

        document.execCommand('copy');
        document.body.removeChild(textarea);

        doFlash();
      });
  }
</script>

</body>
</html>`;
}
