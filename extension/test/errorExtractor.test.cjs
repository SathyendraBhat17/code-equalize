const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');

// errorExtractor imports 'vscode'; the pure grouping/filtering helpers do
// not use it, so a minimal stub is enough to load the compiled module.
const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'vscode') {
    return {
      window: {},
      languages: {},
      DiagnosticSeverity: { Error: 0, Warning: 1 },
      DiagnosticTag: { Unnecessary: 1, Deprecated: 2 }
    };
  }
  return originalLoad.call(this, request, ...rest);
};

const {
  groupDiagnostics,
  isMeaningfulDiagnostic,
  MAX_EXTRACTED_ERRORS
} = require('../out/errorExtractor.js');

Module._load = originalLoad;

const diag = (line, message, extra = {}) => ({
  message,
  line,
  character: 0,
  isError: true,
  ...extra
});

test('groups cascading parser diagnostics under the root mistake', () => {
  const grouped = groupDiagnostics([
    diag(2, '"(" was not closed'),
    diag(3, 'Expected expression'),
    diag(4, 'Statements must be separated by newlines or semicolons')
  ]);

  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].message, '"(" was not closed');
  assert.deepEqual(
    grouped[0].related.map(item => item.lineNumber),
    [3, 4]
  );
});

test('keeps independent root causes such as indentation and unterminated strings', () => {
  const grouped = groupDiagnostics([
    diag(1, 'Unindent not expected'),
    diag(1, 'Expected indented block'),
    diag(5, 'String literal is unterminated'),
    diag(9, '"undefined_name" is not defined')
  ]);

  assert.deepEqual(
    grouped.map(item => item.message),
    [
      'Expected indented block',
      'Unindent not expected',
      'String literal is unterminated',
      '"undefined_name" is not defined'
    ]
  );
});

test('does not swallow a generic error far away from the root cause', () => {
  const grouped = groupDiagnostics([
    diag(1, 'String literal is unterminated'),
    diag(40, 'Expected expression')
  ]);

  assert.equal(grouped.length, 2);
});

test('removes duplicates reported by several providers at the same position', () => {
  const grouped = groupDiagnostics([
    diag(3, "expected ';' before 'return'", { character: 10 }),
    diag(3, "expected ';' before 'return'", { character: 10, source: 'other' }),
    diag(3, "error: expected ';' before 'return'", { character: 10 })
  ]);

  assert.equal(grouped.length, 1);
});

test('keeps correctness warnings and drops style or unused-code warnings', () => {
  const warn = (message, extra = {}) => ({
    message, line: 0, character: 0, isError: false, ...extra
  });

  assert.equal(isMeaningfulDiagnostic(warn('"totl" is possibly unbound')), true);
  assert.equal(isMeaningfulDiagnostic(warn('Null pointer access: The variable s can only be null')), true);
  assert.equal(isMeaningfulDiagnostic(warn('"os" is not accessed')), false);
  assert.equal(isMeaningfulDiagnostic(warn('unused variable \'x\'')), false);
  assert.equal(isMeaningfulDiagnostic(warn('anything', { isUnnecessary: true })), false);
  assert.equal(isMeaningfulDiagnostic(warn('line too long (99 > 79 characters)', { code: 'E501' })), false);
  assert.equal(isMeaningfulDiagnostic(diag(0, 'unused import is an error here')), true);
  assert.equal(MAX_EXTRACTED_ERRORS, 12);
});
