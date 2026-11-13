const assert = require('node:assert/strict');
const test = require('node:test');

const {
  validateBatchResponse,
  stripOuterFence,
  sendExplainAll
} = require('../out/apiService.js');

const base = (explanations, extra = {}) => ({
  explanations,
  fix: 'x = 1',
  whatWasFixed: '- Fixed it.',
  remember: '- Remember it.',
  correctionStatus: 'complete',
  validation: { status: 'unavailable' },
  source: 'AI',
  ...extra
});

const item = (id, extra = {}) => ({
  id,
  error: 'message for ' + id,
  lineNumber: 1,
  errorType: 'diagnostic',
  explanation: 'Explanation for ' + id,
  source: 'AI',
  ...extra
});

test('maps explanations by stable ID regardless of response order', () => {
  const result = validateBatchResponse(
    base([item('b'), item('a')]),
    ['a', 'b']
  );

  assert.deepEqual(result.explanations.map(entry => entry.id), ['a', 'b']);
  assert.equal(result.explanations[0].explanation, 'Explanation for a');
});

test('rejects missing, duplicate and unknown IDs', () => {
  assert.throws(
    () => validateBatchResponse(base([item('a')]), ['a', 'b']),
    /missing the explanation for error id=b/
  );
  assert.throws(
    () => validateBatchResponse(base([item('a'), item('a')]), ['a']),
    /duplicate/
  );
  assert.throws(
    () => validateBatchResponse(base([item('a'), item('zzz')]), ['a']),
    /unexpected error id=zzz/
  );
});

test('accepts source-inferred potential issues only for whole-source analysis', () => {
  const potential = item('potential|4|division-by-zero', {
    errorType: 'potential',
    issueType: 'Division by Zero',
    summary: 'count may be 0.'
  });

  const result = validateBatchResponse(
    base([item('a'), potential]),
    ['a'],
    true
  );

  assert.equal(result.explanations.length, 2);
  assert.equal(result.explanations[1].issueType, 'Division by Zero');

  assert.throws(
    () => validateBatchResponse(base([item('a'), potential]), ['a'], false),
    /unexpected error id/
  );

  // An unknown id that is not marked potential is never attached.
  assert.throws(
    () => validateBatchResponse(
      base([item('a'), item('potential|1|x', { errorType: 'diagnostic' })]),
      ['a'],
      true
    ),
    /unexpected error id/
  );
});

test('rejects incomplete responses instead of presenting them as complete', () => {
  assert.throws(
    () => validateBatchResponse(base([item('a')], { whatWasFixed: '' }), ['a']),
    /What was fixed/
  );
  assert.throws(
    () => validateBatchResponse(base([item('a')], { fix: '' }), ['a']),
    /incomplete/
  );
  assert.throws(
    () => validateBatchResponse(base([item('a', { explanation: '' })]), ['a']),
    /incomplete batch explanation item/
  );
  assert.throws(
    () => validateBatchResponse(base([item('a', { lineNumber: -1 })]), ['a']),
    /invalid line number/
  );
});

test('a missing correction status is never reported as complete', () => {
  const result = validateBatchResponse(
    base([item('a')], { correctionStatus: undefined }),
    ['a']
  );
  assert.equal(result.correctionStatus, 'partial');
});

test('handles a clean file reported by whole-source analysis', () => {
  const result = validateBatchResponse(
    { explanations: [], noIssues: true, source: 'AI' },
    [],
    true
  );
  assert.equal(result.noIssues, true);
  assert.equal(result.explanations.length, 0);

  assert.throws(
    () => validateBatchResponse(
      { explanations: [], noIssues: true, source: 'AI' },
      ['a'],
      true
    ),
    /no issues for a file with detected errors/
  );
});

test('strips only an outer Markdown fence from corrected code', () => {
  assert.equal(stripOuterFence('```python\nx = 1\n```\n'), 'x = 1');
  const inner = 'doc = """\n```\nexample\n```\n"""';
  assert.equal(stripOuterFence(inner), inner);
});

test('whole-source request may have no diagnostics and sends analyzeSource', async () => {
  const originalFetch = global.fetch;
  let body;
  global.fetch = async (url, options) => {
    body = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ explanations: [], noIssues: true, source: 'AI' })
    };
  };

  try {
    const result = await sendExplainAll({
      code: 'print(1)',
      language: 'Python',
      targetLanguage: 'English',
      fileName: 'main.py',
      analyzeSource: true,
      errors: []
    });
    assert.equal(body.analyzeSource, true);
    assert.equal(body.fileName, 'main.py');
    assert.deepEqual(body.errors, []);
    assert.equal(result.noIssues, true);
  } finally {
    global.fetch = originalFetch;
  }

  await assert.rejects(
    sendExplainAll({
      code: 'print(1)',
      language: 'Python',
      targetLanguage: 'English',
      errors: []
    }),
    /Missing required information/
  );
});
