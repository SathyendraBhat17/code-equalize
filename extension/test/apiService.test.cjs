const assert = require('node:assert/strict');
const test = require('node:test');

const { sendExplainAll } = require('../out/apiService.js');

const request = {
  code: 'value = 1 / 0',
  language: 'Python',
  targetLanguage: 'Hindi',
  errors: [{
    id: 'runtime|0|zerodivisionerror',
    error: 'ZeroDivisionError: division by zero',
    lineNumber: 0,
    errorType: 'runtime'
  }]
};

test('batch API sends source and explanation languages as separate fields', async () => {
  const originalFetch = global.fetch;
  let captured;
  global.fetch = async (url, options) => {
    captured = { url, options, body: JSON.parse(options.body) };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        explanations: [{
          id: request.errors[0].id,
          error: request.errors[0].error,
          lineNumber: 0,
          errorType: 'runtime',
          explanation: 'Hindi explanation',
          source: 'AI'
        }],
        fix: 'if divisor == 0: raise ValueError()',
        whatWasFixed: '- Added a zero check.',
        remember: 'Check the divisor.',
        correctionStatus: 'complete',
        validation: { status: 'passed', tool: 'Python ast.parse' },
        source: 'AI'
      })
    };
  };

  try {
    const result = await sendExplainAll(request);
    assert.equal(captured.url, 'http://127.0.0.1:3000/explain/all');
    assert.equal(captured.body.language, 'Python');
    assert.equal(captured.body.targetLanguage, 'Hindi');
    assert.equal(result.explanations[0].explanation, 'Hindi explanation');
    assert.equal(captured.body.analyzeSource, false);
    assert.equal(result.whatWasFixed, '- Added a zero check.');
    assert.equal(result.correctionStatus, 'complete');
    assert.equal(result.validation.status, 'passed');
  } finally {
    global.fetch = originalFetch;
  }
});

test('batch API rejects a failed language request with backend feedback', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 400,
    json: async () => ({ error: 'Unsupported explanation language.' })
  });

  try {
    await assert.rejects(
      sendExplainAll(request),
      /Unsupported explanation language/
    );
  } finally {
    global.fetch = originalFetch;
  }
});
