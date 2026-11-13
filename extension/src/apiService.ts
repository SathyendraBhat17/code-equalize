const BACKEND_URL = 'http://127.0.0.1:3000/explain';
const BACKEND_BATCH_URL = 'http://127.0.0.1:3000/explain/all';

const REQUEST_TIMEOUT = 20000;
// Longer than the backend's Groq timeout so the backend can always answer
// with a result or an explicit error first.
const BATCH_REQUEST_TIMEOUT = 150000;
const MAX_RETRIES = 2;
// A batch request is expensive (one full Groq generation); retry it once.
const BATCH_MAX_RETRIES = 1;
const RETRY_DELAY = 500;

export type ErrorType = 'diagnostic' | 'runtime' | 'potential';

export type BackendRequest = {
  errorMessage: string;
  code: string;
  language: string;
  targetLanguage: string;
  errorType?: ErrorType;
};

export type BackendResponse = {
  explanation: string;
  fix: string;
  remember?: string | null;
  source: string;
  matchedError?: string;
  distance?: number | null;
};

export type RelatedDiagnosticInput = {
  message: string;
  lineNumber?: number;
};

export type BatchErrorInput = {
  id: string;
  error: string;
  lineNumber?: number;
  errorType: ErrorType;
  relatedDiagnostics?: RelatedDiagnosticInput[];
};

export type BatchExplainRequest = {
  code: string;
  language: string;
  targetLanguage: string;
  errors: BatchErrorInput[];
  fileName?: string;
  /**
   * When true, Groq analyses the complete source and may report
   * additional (potential) issues beyond the listed diagnostics.
   */
  analyzeSource?: boolean;
};

export type BatchExplanationItem = {
  id: string;
  error: string;
  lineNumber?: number;
  errorType: ErrorType;
  issueType?: string;
  summary?: string;
  explanation: string;
  source: string;
  matchedError?: string;
  distance?: number | null;
};

export type CorrectionStatus = 'complete' | 'partial' | 'none';

export type SyntaxValidation = {
  status: 'passed' | 'failed' | 'unavailable';
  tool?: string;
  detail?: string;
};

export type BatchExplainResponse = {
  explanations: BatchExplanationItem[];
  fix: string;
  whatWasFixed: string;
  remember: string;
  correctionStatus: CorrectionStatus;
  validation: SyntaxValidation;
  noIssues: boolean;
  source: string;
};

/**
 * Validates and normalizes the single-error backend response.
 */
function validateResponse(result: unknown): BackendResponse {
  if (
    !result ||
    typeof result !== 'object' ||
    typeof (result as any).explanation !== 'string' ||
    typeof (result as any).fix !== 'string' ||
    typeof (result as any).source !== 'string'
  ) {
    throw new Error(
      'The backend returned an invalid explanation response.'
    );
  }

  const response = result as Record<string, unknown>;

  return {
    explanation: response.explanation as string,
    fix: response.fix as string,

    remember:
      typeof response.remember === 'string'
        ? response.remember
        : null,

    source: response.source as string,

    matchedError:
      typeof response.matchedError === 'string'
        ? response.matchedError
        : undefined,

    distance:
      typeof response.distance === 'number' &&
      Number.isFinite(response.distance)
        ? response.distance
        : null
  };
}

function normalizeErrorType(value: unknown): ErrorType {
  if (value === 'runtime' || value === 'potential') {
    return value;
  }

  return 'diagnostic';
}

function optionalText(value: unknown, maxLength: number): string | undefined {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, maxLength)
    : undefined;
}

function normalizeValidation(value: unknown): SyntaxValidation {
  const entry =
    value && typeof value === 'object'
      ? value as Record<string, unknown>
      : {};

  const status =
    entry.status === 'passed' || entry.status === 'failed'
      ? entry.status
      : 'unavailable';

  return {
    status,
    tool: optionalText(entry.tool, 80),
    detail: optionalText(entry.detail, 400)
  };
}

/**
 * Defensive: if the whole corrected source is still wrapped in one
 * Markdown fence, remove only that outer fence. Fence-like lines inside the
 * program (for example in a docstring) are left untouched.
 */
export function stripOuterFence(code: string): string {
  const lines = code.replace(/\r\n/g, '\n').split('\n');

  while (lines.length > 0 && !lines[lines.length - 1].trim()) {
    lines.pop();
  }

  if (
    lines.length >= 2 &&
    /^[ \t]*(`{3,})[\w+#.-]*[ \t]*$/.test(lines[0]) &&
    /^[ \t]*`{3,}[ \t]*$/.test(lines[lines.length - 1])
  ) {
    return lines.slice(1, -1).join('\n');
  }

  return code;
}

const ADDITIONAL_ISSUE_ID = /^potential\|/;
const MAX_ADDITIONAL_ISSUES = 10;

/**
 * Validates and normalizes the batch backend response.
 *
 * Stable IDs are authoritative: every requested ID must come back exactly
 * once, duplicates and unknown IDs are rejected, and only clearly marked
 * source-inferred issues ("potential|...") may be added when whole-source
 * analysis was requested.
 */
export function validateBatchResponse(
  result: unknown,
  expectedIds: string[],
  allowAdditional = false
): BatchExplainResponse {
  if (!result || typeof result !== 'object') {
    throw new Error(
      'The backend returned an invalid batch explanation response.'
    );
  }

  const response = result as Record<string, unknown>;

  if (
    typeof response.source !== 'string' ||
    !Array.isArray(response.explanations)
  ) {
    throw new Error(
      'The backend returned an invalid batch explanation response.'
    );
  }

  if (response.noIssues === true) {
    if (expectedIds.length > 0 || response.explanations.length > 0) {
      throw new Error(
        'The backend reported no issues for a file with detected errors.'
      );
    }

    return {
      explanations: [],
      fix: '',
      whatWasFixed: '',
      remember: '',
      correctionStatus: 'none',
      validation: { status: 'unavailable' },
      noIssues: true,
      source: response.source
    };
  }

  if (
    typeof response.fix !== 'string' ||
    !response.fix.trim() ||
    typeof response.remember !== 'string' ||
    !response.remember.trim()
  ) {
    throw new Error(
      'The backend returned an incomplete batch explanation response.'
    );
  }


  const explanationsById = new Map<string, BatchExplanationItem>();
  const additional: BatchExplanationItem[] = [];

  for (const item of response.explanations) {
    if (!item || typeof item !== 'object') {
      throw new Error(
        'The backend returned an incomplete batch explanation item.'
      );
    }

    const entry = item as Record<string, unknown>;

    if (
      typeof entry.id !== 'string' ||
      !entry.id.trim() ||
      typeof entry.error !== 'string' ||
      !entry.error.trim() ||
      typeof entry.explanation !== 'string' ||
      !entry.explanation.trim() ||
      typeof entry.source !== 'string' ||
      !entry.source.trim()
    ) {
      throw new Error(
        'The backend returned an incomplete batch explanation item.'
      );
    }

    const isExpected = expectedIds.includes(entry.id);
    const isAdditional =
      !isExpected &&
      allowAdditional &&
      ADDITIONAL_ISSUE_ID.test(entry.id) &&
      entry.errorType === 'potential';

    if (!isExpected && !isAdditional) {
      throw new Error(
        `The backend returned an unexpected error id=${entry.id}.`
      );
    }

    if (
      explanationsById.has(entry.id) ||
      additional.some(other => other.id === entry.id)
    ) {
      throw new Error(
        `The backend returned a duplicate explanation for error id=${entry.id}.`
      );
    }

    if (
      entry.lineNumber !== undefined &&
      entry.lineNumber !== null &&
      (
        typeof entry.lineNumber !== 'number' ||
        !Number.isFinite(entry.lineNumber) ||
        !Number.isInteger(entry.lineNumber) ||
        entry.lineNumber < 0
      )
    ) {
      throw new Error(
        `The backend returned an invalid line number for error id=${entry.id}.`
      );
    }

    const normalized: BatchExplanationItem = {
      id: entry.id,
      error: entry.error,
      lineNumber:
        typeof entry.lineNumber === 'number'
          ? entry.lineNumber
          : undefined,
      errorType: normalizeErrorType(entry.errorType),
      issueType: optionalText(entry.issueType, 80),
      summary: optionalText(entry.summary, 400),
      explanation: entry.explanation,
      source: entry.source,
      matchedError:
        typeof entry.matchedError === 'string'
          ? entry.matchedError
          : undefined,
      distance:
        typeof entry.distance === 'number' &&
        Number.isFinite(entry.distance)
          ? entry.distance
          : null
    };

    if (isExpected) {
      explanationsById.set(entry.id, normalized);
    } else {
      additional.push(normalized);
    }
  }

  if (additional.length > MAX_ADDITIONAL_ISSUES) {
    throw new Error(
      'The backend returned more additional issues than allowed.'
    );
  }

  const explanations = expectedIds.map(id => {
    const item = explanationsById.get(id);

    if (!item) {
      throw new Error(
        `The backend response is missing the explanation for error id=${id}.`
      );
    }

    return item;
  });

  if (explanations.length + additional.length === 0) {
    throw new Error(
      'The backend response did not contain any explanations.'
    );
  }

  const whatWasFixed =
    typeof response.whatWasFixed === 'string'
      ? response.whatWasFixed.trim()
      : '';

  if (!whatWasFixed) {
    throw new Error(
      'The backend response is missing the What was fixed summary.'
    );
  }

  return {
    explanations: [...explanations, ...additional],
    fix: stripOuterFence(response.fix),
    whatWasFixed,
    remember: response.remember,
    correctionStatus:
      response.correctionStatus === 'complete'
        ? 'complete'
        : 'partial',
    validation: normalizeValidation(response.validation),
    noIssues: false,
    source: response.source
  };
}

/**
 * Determines whether an HTTP status represents
 * a temporary failure worth retrying.
 */
function isRetryableStatus(status: number): boolean {
  return (
    status === 408 ||
    status === 429 ||
    status >= 500
  );
}

/**
 * Waits before retrying a failed request.
 */
function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, milliseconds);
  });
}

async function postJson(
  url: string,
  body: unknown,
  timeoutMs: number,
  maxRetries = MAX_RETRIES
): Promise<unknown> {
  let lastError: Error = new Error(
    'Unable to connect to the Code Equalize backend.'
  );

  for (
    let attempt = 0;
    attempt <= maxRetries;
    attempt++
  ) {
    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      timeoutMs
    );

    let shouldRetry = false;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      let result: unknown;

      try {
        result = await response.json();
      } catch {
        throw new Error(
          'The backend returned an invalid response.'
        );
      }

      if (!response.ok) {
        const errorBody =
          result && typeof result === 'object'
            ? result as Record<string, unknown>
            : undefined;

        const message =
          typeof errorBody?.error === 'string'
            ? errorBody.error
            : `Backend request failed with status ${response.status}.`;

        lastError = new Error(message);

        if (
          isRetryableStatus(response.status) &&
          attempt < maxRetries
        ) {
          shouldRetry = true;
        } else {
          throw lastError;
        }
      } else {
        return result;
      }

    } catch (error) {
      if (
        error instanceof Error &&
        error.name === 'AbortError'
      ) {
        lastError = new Error(
          'The backend request timed out. Please try again.'
        );

        shouldRetry = attempt < maxRetries;

      } else if (shouldRetry) {
        // Preserve the HTTP error that triggered the retry.
      } else if (error instanceof TypeError) {
        lastError = new Error(
          'Unable to connect to the Code Equalize backend. Check whether the backend server is running.'
        );

        shouldRetry = attempt < maxRetries;

      } else if (error instanceof Error) {
        lastError = error;
        throw lastError;

      } else {
        lastError = new Error(
          'Unable to communicate with the backend.'
        );

        shouldRetry = attempt < maxRetries;
      }

    } finally {
      clearTimeout(timeout);
    }

    if (!shouldRetry) {
      break;
    }

    console.warn(
      `[Code Equalize] Backend request failed. Retrying (${attempt + 1}/${maxRetries})...`,
      lastError.message
    );

    await delay(RETRY_DELAY * Math.pow(2, attempt));
  }

  console.error(
    '[Code Equalize] Backend request failed:',
    lastError.message
  );

  throw lastError;
}

/**
 * Sends a single-error explanation request to the backend.
 * Kept for compatibility and debugging.
 */
export async function sendToBackend(
  data: BackendRequest
): Promise<BackendResponse> {
  if (
    !data.errorMessage?.trim() ||
    !data.code?.trim() ||
    !data.language?.trim() ||
    !data.targetLanguage?.trim()
  ) {
    throw new Error(
      'Missing required information to generate an explanation.'
    );
  }

  const result = await postJson(
    BACKEND_URL,
    {
      error: data.errorMessage,
      code: data.code,
      language: data.language,
      targetLanguage: data.targetLanguage,
      errorType: data.errorType ?? 'diagnostic'
    },
    REQUEST_TIMEOUT
  );

  return validateResponse(result);
}

/**
 * Sends one coordinated batch request for the whole file: the complete
 * source, all detected errors with stable IDs, and the explanation language.
 */
export async function sendExplainAll(
  data: BatchExplainRequest
): Promise<BatchExplainResponse> {
  const analyzeSource = data.analyzeSource === true;

  if (
    !data.code?.trim() ||
    !data.language?.trim() ||
    !data.targetLanguage?.trim() ||
    !Array.isArray(data.errors) ||
    (data.errors.length === 0 && !analyzeSource)
  ) {
    throw new Error(
      'Missing required information to generate batch explanations.'
    );
  }

  for (const item of data.errors) {
    if (
      typeof item?.id !== 'string' ||
      !item.id.trim() ||
      typeof item.error !== 'string' ||
      !item.error.trim()
    ) {
      throw new Error(
        'Each batch error requires a non-empty id and message.'
      );
    }
  }

  const errorIds = new Set<string>();

  for (const item of data.errors) {
    if (errorIds.has(item.id)) {
      throw new Error(
        `Duplicate batch error id="${item.id}".`
      );
    }

    errorIds.add(item.id);
  }

  const result = await postJson(
    BACKEND_BATCH_URL,
    {
      code: data.code,
      language: data.language,
      targetLanguage: data.targetLanguage,
      fileName: data.fileName,
      analyzeSource,
      errors: data.errors.map(item => ({
        id: item.id,
        error: item.error,
        lineNumber: item.lineNumber,
        errorType: item.errorType,
        ...(item.relatedDiagnostics?.length
          ? { relatedDiagnostics: item.relatedDiagnostics }
          : {})
      }))
    },
    BATCH_REQUEST_TIMEOUT,
    BATCH_MAX_RETRIES
  );

  return validateBatchResponse(
    result,
    data.errors.map(item => item.id),
    analyzeSource
  );
}
