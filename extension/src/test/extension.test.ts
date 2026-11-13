import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { getSupportedProgrammingLanguage } from '../extension';
import { CodeEqualizePanel } from '../panelView';

/**
 * Integration tests that run inside the VS Code Extension Development
 * Host. The backend is replaced by a fetch stub in this process, so no
 * network, Groq, or ChromaDB access happens.
 */

type CapturedRequest = {
  url: string;
  body: Record<string, unknown>;
};

const captured: CapturedRequest[] = [];
let respond: (body: Record<string, unknown>) => Promise<unknown> =
  async () => ({});
const originalFetch = globalThis.fetch;

function installFetchStub(): void {
  globalThis.fetch = (async (url: string, options: { body: string }) => {
    const body = JSON.parse(options.body) as Record<string, unknown>;
    captured.push({ url: String(url), body });
    const result = await respond(body);
    return {
      ok: true,
      status: 200,
      json: async () => result
    };
  }) as unknown as typeof fetch;
}

/** A well-formed backend answer echoing every requested ID. */
function okResponse(body: Record<string, unknown>, extra = {}) {
  const errors = body.errors as Array<Record<string, unknown>>;
  const language = String(body.targetLanguage);

  const explanations = errors.map(item => ({
    id: item.id,
    error: item.error,
    lineNumber: item.lineNumber,
    errorType: item.errorType,
    issueType: `Type (${language})`,
    summary: `Summary in ${language}`,
    explanation: `Explanation in ${language}`,
    source: 'AI'
  }));

  if (body.analyzeSource === true) {
    explanations.push({
      id: 'potential|0|division-by-zero',
      error: 'y may be zero',
      lineNumber: 0,
      errorType: 'potential',
      issueType: 'Division by Zero',
      summary: `Potential issue in ${language}`,
      explanation: `Potential explanation in ${language}`,
      source: 'AI'
    });
  }

  return {
    explanations,
    fix: `# corrected (${language})\nprint(1)`,
    whatWasFixed: `- Fixed in ${language}`,
    remember: `- Remember in ${language}`,
    correctionStatus: 'complete',
    validation: { status: 'passed', tool: 'Python ast.parse' },
    noIssues: false,
    source: 'AI',
    ...extra
  };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor(
  condition: () => boolean,
  timeoutMs = 5000
): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition.');
    }
    await delay(25);
  }
}

function codeEqualizeTabs(): string[] {
  return vscode.window.tabGroups.all
    .flatMap(group => group.tabs)
    .filter(tab => tab.label.startsWith('Code Equalize'))
    .map(tab => tab.label);
}

function allTabLabels(): string {
  return JSON.stringify(
    vscode.window.tabGroups.all.map(group => group.tabs.map(tab => tab.label))
  );
}

async function openDoc(
  language: string,
  content: string
): Promise<vscode.TextDocument> {
  const document = await vscode.workspace.openTextDocument({
    language,
    content
  });
  await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
  return document;
}

// Private members are accessed to simulate webview messages.
type AnyPanel = any;

suite('Extension Test Suite', () => {
  suiteSetup(async () => {
    const extension = vscode.extensions.all.find(item =>
      item.packageJSON?.name === 'code-equalize'
    );
    assert.ok(extension, 'extension is loaded');
    await extension.activate();
    installFetchStub();
  });

  suiteTeardown(async () => {
    globalThis.fetch = originalFetch;
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  setup(() => {
    captured.length = 0;
    respond = async body => okResponse(body);
  });

  test('maps all supported VS Code source language IDs', () => {
    assert.strictEqual(getSupportedProgrammingLanguage('java'), 'Java');
    assert.strictEqual(getSupportedProgrammingLanguage('python'), 'Python');
    assert.strictEqual(getSupportedProgrammingLanguage('c'), 'C');
    assert.strictEqual(getSupportedProgrammingLanguage('cpp'), 'C++');
    assert.strictEqual(getSupportedProgrammingLanguage('c++'), 'C++');
    assert.strictEqual(getSupportedProgrammingLanguage('typescript'), undefined);
  });

  test('registers the Command Palette and editor context-menu commands', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('code-equalize.explain'));
    assert.ok(commands.includes('code-equalize.explainFromEditor'));

    const extension = vscode.extensions.all.find(item =>
      item.packageJSON?.name === 'code-equalize'
    )!;
    const contributes = extension.packageJSON.contributes;
    const palette = contributes.commands.find(
      (item: { command: string }) => item.command === 'code-equalize.explain'
    );
    assert.strictEqual(
      `${palette.category}: ${palette.title}`,
      'Code Equalize: Explain in My Language'
    );
    const contextEntry = contributes.menus['editor/context'][0];
    assert.strictEqual(contextEntry.command, 'code-equalize.explainFromEditor');
    const contextCommand = contributes.commands.find(
      (item: { command: string }) =>
        item.command === 'code-equalize.explainFromEditor'
    );
    assert.strictEqual(contextCommand.title, 'Explain with Code Equalize');
  });

  test('analyses only the active file, including unsaved edits, without diagnostics', async () => {
    const document = await openDoc('python', 'x = 10\ny = 0\nprint(x / y)\n');
    const editor = vscode.window.activeTextEditor!;
    await editor.edit(edit =>
      edit.insert(new vscode.Position(3, 0), 'z = 1  # unsaved edit\n')
    );
    assert.ok(document.isDirty);

    await vscode.commands.executeCommand('code-equalize.explain');

    assert.strictEqual(captured.length, 1);
    const body = captured[0].body;
    assert.ok(captured[0].url.endsWith('/explain/all'));
    assert.strictEqual(body.code, document.getText());
    assert.ok(String(body.code).includes('unsaved edit'));
    assert.strictEqual(body.language, 'Python');
    assert.strictEqual(body.analyzeSource, true);
    assert.strictEqual(body.targetLanguage, 'English');

    const panel = CodeEqualizePanel.get(document.uri.toString()) as AnyPanel;
    assert.ok(panel, 'panel created for the file');
    const html: string = panel.panel.webview.html;
    assert.ok(html.includes('<th scope="col">Error Type</th>'));
    assert.ok(!html.includes('Severity'));
    assert.ok(html.includes('Division by Zero'));
    assert.ok(html.includes('origin-potential'));
    assert.ok(html.includes('WHAT WAS FIXED'));
  });

  test('separate files get separate panels; re-analysis reuses the panel', async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');

    const pythonDoc = await openDoc('python', 'print(1 / 0)\n');
    await vscode.commands.executeCommand('code-equalize.explain');

    const cDoc = await openDoc('c', 'int main(void) { return 1 / 0; }\n');
    await vscode.commands.executeCommand('code-equalize.explainFromEditor', cDoc.uri);

    assert.strictEqual(captured.at(-1)!.body.language, 'C');
    assert.ok(CodeEqualizePanel.get(pythonDoc.uri.toString()));
    assert.ok(CodeEqualizePanel.get(cDoc.uri.toString()));
    assert.notStrictEqual(
      CodeEqualizePanel.get(pythonDoc.uri.toString()),
      CodeEqualizePanel.get(cDoc.uri.toString())
    );
    // Webview tabs are reported asynchronously after panel creation.
    await waitFor(() => codeEqualizeTabs().length === 2).catch(() => {
      assert.fail(`Expected two Code Equalize tabs: ${allTabLabels()}`);
    });

    // Re-analysing the first file reuses its panel (no new tab).
    const firstPanel = CodeEqualizePanel.get(pythonDoc.uri.toString());
    await vscode.window.showTextDocument(pythonDoc, vscode.ViewColumn.One);
    await vscode.commands.executeCommand('code-equalize.explain');
    assert.strictEqual(CodeEqualizePanel.get(pythonDoc.uri.toString()), firstPanel);
    await delay(300);
    assert.strictEqual(codeEqualizeTabs().length, 2, allTabLabels());
  });

  test('an older response never overwrites a newer analysis', async () => {
    const document = await openDoc('python', 'a = 1\n');
    const key = document.uri.toString();

    let call = 0;
    respond = async body => {
      call += 1;
      if (call === 1) {
        await delay(600);
        return okResponse(body, { fix: 'OLD = True' });
      }
      return okResponse(body, { fix: 'NEW = True' });
    };

    const first = vscode.commands.executeCommand('code-equalize.explain');
    await delay(50);
    const second = vscode.commands.executeCommand('code-equalize.explain');
    await Promise.all([first, second]);

    const panel = CodeEqualizePanel.get(key)!;
    assert.strictEqual(panel.currentData!.fix, 'NEW = True');
  });

  test('language change applies, persists per file, and survives re-analysis', async () => {
    const document = await openDoc('python', 'print("hi")\n');
    const key = document.uri.toString();
    await vscode.commands.executeCommand('code-equalize.explain');

    const panel = CodeEqualizePanel.get(key) as AnyPanel;
    const analysisId = panel.currentData.analysisId;
    const issueCount = panel.currentData.explanations.length;

    // Simulate the webview's changeLanguage message.
    await panel.handleMessage({
      command: 'changeLanguage',
      token: panel.nonce,
      language: 'Hindi',
      requestId: `${panel.nonce}-language-1`
    });

    assert.strictEqual(panel.currentData.targetLanguage, 'Hindi');
    assert.strictEqual(panel.currentData.analysisId, analysisId);
    assert.strictEqual(panel.currentData.explanations.length, issueCount);
    assert.ok(panel.currentData.whatWasFixed.includes('Hindi'));
    assert.ok(panel.currentData.remember.includes('Hindi'));
    const languageRequest = captured.at(-1)!.body;
    assert.strictEqual(languageRequest.analyzeSource, false);
    assert.strictEqual(
      (languageRequest.errors as unknown[]).length,
      issueCount
    );

    // Another file keeps its own default.
    const other = await openDoc('python', 'print("other")\n');
    await vscode.commands.executeCommand('code-equalize.explain');
    assert.strictEqual(captured.at(-1)!.body.targetLanguage, 'English');
    assert.strictEqual(
      CodeEqualizePanel.get(other.uri.toString())!.currentData!.targetLanguage,
      'English'
    );

    // Re-analysing the first file keeps Hindi.
    await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
    await vscode.commands.executeCommand('code-equalize.explain');
    assert.strictEqual(captured.at(-1)!.body.targetLanguage, 'Hindi');
    assert.strictEqual(
      CodeEqualizePanel.get(key)!.currentData!.targetLanguage,
      'Hindi'
    );
  });

  test('messages from an old page (stale token) are ignored', async () => {
    const document = await openDoc('python', 'print(2)\n');
    await vscode.commands.executeCommand('code-equalize.explain');
    const panel = CodeEqualizePanel.get(document.uri.toString()) as AnyPanel;
    const before = captured.length;

    await panel.handleMessage({
      command: 'changeLanguage',
      token: 'not-the-current-token',
      language: 'Tamil',
      requestId: 'not-the-current-token-language-1'
    });

    assert.strictEqual(captured.length, before);
    assert.strictEqual(panel.currentData.targetLanguage, 'English');
  });

  test('copy writes only the corrected source to the clipboard', async () => {
    const document = await openDoc('python', 'print(3)\n');
    await vscode.commands.executeCommand('code-equalize.explain');
    const panel = CodeEqualizePanel.get(document.uri.toString()) as AnyPanel;

    await vscode.env.clipboard.writeText('before');
    await panel.handleMessage({
      command: 'copyFix',
      token: panel.nonce,
      requestId: `${panel.nonce}-copy-1`
    });

    const copied = await vscode.env.clipboard.readText();
    assert.strictEqual(copied, panel.currentData.fix);
    assert.ok(!copied.includes('```'));
  });

  test('unsupported files are handled without calling the backend', async () => {
    await openDoc('plaintext', 'hello');
    await vscode.commands.executeCommand('code-equalize.explain');
    assert.strictEqual(captured.length, 0);
  });

  test('backend unavailable keeps previous results, then recovers', async () => {
    const document = await openDoc('java', 'class A { int f() { return 1 / 0; } }\n');
    const key = document.uri.toString();
    await vscode.commands.executeCommand('code-equalize.explain');
    const panel = CodeEqualizePanel.get(key)!;
    const previous = panel.currentData!.analysisId;

    respond = async () => {
      throw new TypeError('fetch failed');
    };
    await vscode.commands.executeCommand('code-equalize.explain');
    assert.strictEqual(panel.currentData!.analysisId, previous);

    respond = async body => okResponse(body);
    await vscode.commands.executeCommand('code-equalize.explain');
    assert.notStrictEqual(panel.currentData!.analysisId, previous);
    assert.strictEqual(captured.at(-1)!.body.language, 'Java');
  });

  test('a malformed backend response is not shown as a result', async () => {
    const document = await openDoc('cpp', 'int main() { int* p = nullptr; return *p; }\n');
    respond = async body => okResponse(body, { whatWasFixed: '' });
    await vscode.commands.executeCommand('code-equalize.explain');
    assert.strictEqual(CodeEqualizePanel.get(document.uri.toString()), undefined);
  });

  test('disposing a panel removes it from the registry', async () => {
    const document = await openDoc('python', 'print(4)\n');
    await vscode.commands.executeCommand('code-equalize.explain');
    const panel = CodeEqualizePanel.get(document.uri.toString()) as AnyPanel;
    panel.panel.dispose();
    await waitFor(() => !CodeEqualizePanel.get(document.uri.toString()));
    assert.strictEqual(panel.isDisposed, true);
  });
});
