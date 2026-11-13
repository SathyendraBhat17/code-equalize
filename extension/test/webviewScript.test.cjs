/**
 * Runs the real panel HTML's inline script in a Node VM with a minimal DOM
 * and fake timers, to verify the countdown, early reveal, copy, language
 * switching and error recovery logic of the webview.
 */
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const Module = require('node:module');

const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'vscode') {
    return {
      Uri: { joinPath: (base, ...parts) => ({ path: [base.path, ...parts].join('/') }) },
      ViewColumn: { Beside: -2 }
    };
  }
  return originalLoad.call(this, request, ...rest);
};
const panelView = require('../out/panelView.js');
Module._load = originalLoad;

const webview = { cspSource: 'vscode-resource:', asWebviewUri: uri => 'res:' + uri.path };
const extensionUri = { path: '/ext' };

function sampleData(extra = {}) {
  return {
    analysisId: 'file:///a.py#1',
    explanations: [
      {
        id: 'potential|4|division-by-zero',
        errorMessage: 'count may be 0',
        lineNumber: 4,
        errorType: 'potential',
        issueType: 'Division by Zero',
        summary: 'count may be 0, so the division can fail.',
        explanation: 'Dividing by zero has no meaningful result.'
      },
      {
        id: 'diagnostic|1|x',
        errorMessage: '"(" was not closed',
        lineNumber: 1,
        errorType: 'diagnostic',
        issueType: 'Missing Parenthesis',
        summary: 'The call is never closed.',
        explanation: 'The parenthesis is not closed.'
      }
    ],
    fix: 'def f(a, b):\n    if b == 0:\n        return 0  # guard\n    return a / b\n',
    whatWasFixed: '- Closed the call.\n- Added a guard.',
    remember: '- Close brackets.\n- Check divisors.',
    correctionStatus: 'complete',
    validation: { status: 'passed', tool: 'Python ast.parse' },
    noIssues: false,
    source: 'AI',
    fileName: 'a.py',
    targetLanguage: 'Hindi',
    sourceLanguage: 'Python',
    ...extra
  };
}

function makeElement(id) {
  const listeners = {};
  const classes = new Set();
  return {
    id,
    hidden: false,
    disabled: false,
    value: '',
    textContent: '',
    style: {},
    attributes: {},
    classList: {
      add: c => classes.add(c),
      remove: c => classes.delete(c),
      contains: c => classes.has(c),
      toggle: (c, force) => {
        const on = force === undefined ? !classes.has(c) : force;
        if (on) { classes.add(c); } else { classes.delete(c); }
        return on;
      }
    },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    dispatch(type) { (listeners[type] || []).forEach(fn => fn({})); },
    focus() {}
  };
}

function runPanel(html, initialSelectValue) {
  const script = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)[1];
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  const elements = Object.fromEntries(ids.map(id => [id, makeElement(id)]));
  // Reproduce the initial hidden attributes.
  for (const id of ids) {
    const tag = html.match(new RegExp(`<[^>]*id="${id}"[^>]*>`))[0];
    elements[id].hidden = /\shidden[\s>]/.test(tag);
  }
  elements.language.value = initialSelectValue;

  const posted = [];
  const windowListeners = {};
  let now = 0;
  let timers = [];
  let nextId = 1;

  const context = {
    acquireVsCodeApi: () => ({ postMessage: m => posted.push(JSON.parse(JSON.stringify(m))) }),
    document: { getElementById: id => elements[id] || null },
    window: {
      addEventListener: (type, fn) => { (windowListeners[type] ||= []).push(fn); }
    },
    setInterval: (fn, ms) => { const id = nextId++; timers.push({ id, fn, ms, at: now + ms, repeat: true }); return id; },
    clearInterval: id => { timers = timers.filter(t => t.id !== id); },
    setTimeout: (fn, ms) => { const id = nextId++; timers.push({ id, fn, ms, at: now + ms, repeat: false }); return id; },
    clearTimeout: id => { timers = timers.filter(t => t.id !== id); },
    Math,
    String,
    console
  };

  vm.runInNewContext(script, context);

  const advance = ms => {
    const end = now + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const t = timers[0];
      if (!t || t.at > end) { break; }
      now = t.at;
      if (t.repeat) { t.at += t.ms; } else { timers.shift(); }
      t.fn();
    }
    now = end;
  };

  const send = data => (windowListeners.message || []).forEach(fn => fn({ data }));

  return { elements, posted, advance, send, activeTimers: () => timers.length };
}

test('panel HTML has the exact four-column table, branding and no fences', () => {
  const html = panelView.getPanelHtml(webview, extensionUri, sampleData(), 'NONCE123', false);
  const headers = [...html.matchAll(/<th scope="col">([^<]*)<\/th>/g)].map(m => m[1]);
  assert.deepEqual(headers, ['#', 'Line', 'Error Type', 'Description']);
  assert.doesNotMatch(html, /Severity|Critical|>High<|>Medium<|>Low</);
  assert.match(html, /code-equalize-logo\.png/);
  assert.match(html, /Understand errors\. Learn better\. Code confidently\./);
  assert.match(html, /© 2026 Code Equalize\. All rights reserved\./);
  for (const heading of ['WHY THIS HAPPENED', 'HOW TO FIX IT', 'WHAT WAS FIXED', 'REMEMBER']) {
    assert.match(html, new RegExp(heading));
  }
  assert.doesNotMatch(html, /```/);
  // Ascending line order: line 2 (Missing Parenthesis) before line 5.
  assert.ok(html.indexOf('Missing Parenthesis') < html.indexOf('Division by Zero'));
  // Potential issues are labelled as such.
  assert.match(html, /origin-potential/);
  // Syntax highlighting present; theme classes defined for light and dark.
  assert.match(html, /<span class="tok-keyword">def<\/span>/);
  assert.match(html, /body\.vscode-light/);
  assert.match(html, /body\.vscode-dark/);
  assert.doesNotMatch(html, /color-scheme: dark;\s*\n\s*--background/);
  // No Apply-to-file action.
  assert.doesNotMatch(html, /apply/i);
});

test('highlighting keeps the exact source text', () => {
  const code = 'int main() {\n  char *s = "a/*b*/c"; // note\n  return 1 / 0;\n}\n';
  const html = panelView.highlightCode(code, 'C');
  const text = html.replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  assert.equal(text, code);
  assert.match(html, /<span class="tok-string">&quot;a\/\*b\*\/c&quot;<\/span>/);
  assert.match(html, /<span class="tok-comment">\/\/ note<\/span>/);
});

test('countdown runs 15 → 0 with a red-to-green ring and then reveals the fix', () => {
  const html = panelView.getPanelHtml(webview, extensionUri, sampleData(), 'NONCE123', false);
  const p = runPanel(html, 'Hindi');
  const e = p.elements;

  assert.equal(e['countdown-number'].textContent, '15');
  assert.equal(e['fix-content'].hidden, true);
  assert.equal(e['what-was-fixed'].hidden, true);
  assert.match(e['progress-circle'].style.stroke, /^hsl\(0,/);

  p.advance(7000);
  assert.equal(e['countdown-number'].textContent, '8');
  assert.equal(e['fix-content'].hidden, true);

  p.advance(8000);
  assert.equal(e['fix-content'].hidden, false);
  assert.equal(e['what-was-fixed'].hidden, false);
  assert.equal(e.countdown.hidden, true);
  assert.equal(e['countdown-number'].textContent, '0');
  assert.match(e['progress-circle'].style.stroke, /^hsl\(120,/);
  assert.deepEqual(p.posted.at(-1), { command: 'revealed', token: 'NONCE123' });
  assert.equal(p.activeTimers(), 0);
});

test('early reveal shows the fix immediately and stops the timer', () => {
  const html = panelView.getPanelHtml(webview, extensionUri, sampleData(), 'N2', false);
  const p = runPanel(html, 'Hindi');

  p.advance(2000);
  p.elements['reveal-button'].dispatch('click');
  assert.equal(p.elements['fix-content'].hidden, false);
  assert.equal(p.activeTimers(), 0);

  // Toggle hides and shows again.
  p.elements['fix-toggle'].dispatch('click');
  assert.equal(p.elements['fix-content'].hidden, true);
  p.elements['fix-toggle'].dispatch('click');
  assert.equal(p.elements['fix-content'].hidden, false);
});

test('a page rendered for an already revealed analysis starts unlocked', () => {
  const html = panelView.getPanelHtml(webview, extensionUri, sampleData(), 'N3', true);
  const p = runPanel(html, 'Hindi');
  assert.equal(p.elements['fix-content'].hidden, false);
  assert.equal(p.activeTimers(), 0);
});

test('copy posts a tokenised request and shows accurate feedback', () => {
  const html = panelView.getPanelHtml(webview, extensionUri, sampleData(), 'N4', true);
  const p = runPanel(html, 'Hindi');

  p.elements['copy-button'].dispatch('click');
  const request = p.posted.at(-1);
  assert.equal(request.command, 'copyFix');
  assert.equal(request.token, 'N4');
  assert.match(request.requestId, /^N4-copy-1$/);
  assert.equal(p.elements['copy-button'].disabled, true);

  p.send({ command: 'copyResult', requestId: 'stale', success: true });
  assert.equal(p.elements['copy-button'].textContent, 'Copying...');

  p.send({ command: 'copyResult', requestId: request.requestId, success: false });
  assert.equal(p.elements['copy-button'].textContent, 'Copy failed');
  assert.equal(p.elements['copy-button'].disabled, false);
});

test('language switch shows loading and always recovers on error', () => {
  const html = panelView.getPanelHtml(webview, extensionUri, sampleData(), 'N5', true);
  const p = runPanel(html, 'Hindi');
  const e = p.elements;

  e.language.value = 'Tamil';
  e.language.dispatch('change');
  const request = p.posted.at(-1);
  assert.deepEqual(
    { command: request.command, language: request.language },
    { command: 'changeLanguage', language: 'Tamil' }
  );
  assert.equal(e.loader.classList.contains('visible'), true);
  assert.equal(e.language.disabled, true);

  // A response for an older request is ignored.
  p.send({ command: 'error', requestId: 'N5-language-0', error: 'old' });
  assert.equal(e.loader.classList.contains('visible'), true);

  p.send({ command: 'error', requestId: request.requestId, error: 'Groq failed.' });
  assert.equal(e.loader.classList.contains('visible'), false);
  assert.equal(e.language.disabled, false);
  assert.equal(e.language.value, 'Hindi');
  assert.equal(e.banner.hidden, false);
  assert.match(e.banner.textContent, /Groq failed/);
});

test('re-analysis loading and failure keep the panel usable', () => {
  const html = panelView.getPanelHtml(webview, extensionUri, sampleData(), 'N6', true);
  const p = runPanel(html, 'Hindi');
  const e = p.elements;

  e['reanalyze-button'].dispatch('click');
  assert.deepEqual(p.posted.at(-1), { command: 'reanalyze', token: 'N6' });

  p.send({ command: 'loading', text: 'Analysing a.py...' });
  assert.equal(e.loader.classList.contains('visible'), true);
  assert.equal(e['reanalyze-button'].disabled, true);

  p.send({ command: 'analysisError', error: 'Backend unavailable.' });
  assert.equal(e.loader.classList.contains('visible'), false);
  assert.equal(e['reanalyze-button'].disabled, false);
  assert.equal(e.language.disabled, false);
  assert.match(e.banner.textContent, /Backend unavailable/);
});

test('clean-file result renders without fix controls', () => {
  const html = panelView.getPanelHtml(
    webview,
    extensionUri,
    sampleData({
      explanations: [], fix: '', whatWasFixed: '', remember: '',
      correctionStatus: 'none', validation: { status: 'unavailable' }, noIssues: true
    }),
    'N7',
    false
  );
  assert.match(html, /No meaningful problems were found/);
  const p = runPanel(html, 'Hindi');
  assert.equal(p.activeTimers(), 0);
});

test('invalid panel data renders the safe fallback page', () => {
  const html = panelView.getPanelHtml(
    webview, extensionUri, sampleData({ whatWasFixed: '' }), 'N8', false
  );
  assert.match(html, /its data is invalid/);
});
