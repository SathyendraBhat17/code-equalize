const BACKEND_URL = 'http://127.0.0.1:3000/explain';
const BACKEND_BATCH_URL = 'http://127.0.0.1:3000/explain/all';

const REQUEST_TIMEOUT = 20000;
const BATCH_REQUEST_TIMEOUT = 90000;
const MAX_RETRIES = 2;
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

export type BatchErrorInput = {
  id: string;
  error: string;
  lineNumber?: number;
  errorType: ErrorType;
};

export type BatchExplainRequest = {
  code: string;
  language: string;
  targetLanguage: string;
  errors: BatchErrorInput[];
};

export type BatchExplanationItem = {
  id: string;
  error: string;
  lineNumber?: number;
  errorType: ErrorType;
  explanation: string;
  source: string;
  matchedError?: string;
  distance?: number | null;
};

export type BatchExplainResponse = {
  explanations: BatchExplanationItem[];
  fix: string;
  remember: string;
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

/**
 * Validates and normalizes the batch backend response.
 */
function validateBatchResponse(
  result: unknown,
  expectedIds: string[]
): BatchExplainResponse {
  if (!result || typeof result !== 'object') {
    throw new Error(
      'The backend returned an invalid batch explanation response.'
    );
  }

  const response = result as Record<string, unknown>;

  if (
    typeof response.fix !== 'string' ||
    !response.fix.trim() ||
    typeof response.remember !== 'string' ||
    !response.remember.trim() ||
    typeof response.source !== 'string' ||
    !Array.isArray(response.explanations)
  ) {
    throw new Error(
      'The backend returned an invalid batch explanation response.'
    );
  }

  const explanationsById = new Map<string, BatchExplanationItem>();

  for (const item of response.explanations) {
    if (!item || typeof item !== 'object') {
      continue;
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

    if (!expectedIds.includes(entry.id)) {
      throw new Error(
        `The backend returned an unexpected error id=${entry.id}.`
      );
    }

    if (explanationsById.has(entry.id)) {
      throw new Error(
        `The backend returned a duplicate explanation for error id=${entry.id}.`
      );
    }

    if (
      entry.lineNumber !== undefined &&
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

    explanationsById.set(entry.id, {
      id: entry.id,
      error: entry.error,
      lineNumber:
        typeof entry.lineNumber === 'number'
          ? entry.lineNumber
          : undefined,
      errorType: normalizeErrorType(entry.errorType),
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
    });
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

  return {
    explanations,
    fix: response.fix,
    remember: response.remember,
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
  timeoutMs: number
): Promise<unknown> {
  let lastError: Error = new Error(
    'Unable to connect to the Code Equalize backend.'
  );

  for (
    let attempt = 0;
    attempt <= MAX_RETRIES;
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
          attempt < MAX_RETRIES
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

        shouldRetry = attempt < MAX_RETRIES;

      } else if (shouldRetry) {
        // Preserve the HTTP error that triggered the retry.
      } else if (error instanceof TypeError) {
        lastError = new Error(
          'Unable to connect to the Code Equalize backend. Check whether the backend server is running.'
        );

        shouldRetry = attempt < MAX_RETRIES;

      } else if (error instanceof Error) {
        lastError = error;
        throw lastError;

      } else {
        lastError = new Error(
          'Unable to communicate with the backend.'
        );

        shouldRetry = attempt < MAX_RETRIES;
      }

    } finally {
      clearTimeout(timeout);
    }

    if (!shouldRetry) {
      break;
    }

    console.warn(
      `[Code Equalize] Backend request failed. Retrying (${attempt + 1}/${MAX_RETRIES})...`,
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
 * Sends a batch explanation request for all detected errors.
 */
export async function sendExplainAll(
  data: BatchExplainRequest
): Promise<BatchExplainResponse> {
  if (
    !data.code?.trim() ||
    !data.language?.trim() ||
    !data.targetLanguage?.trim() ||
    !Array.isArray(data.errors) ||
    data.errors.length === 0
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
      errors: data.errors.map(item => ({
        id: item.id,
        error: item.error,
        lineNumber: item.lineNumber,
        errorType: item.errorType
      }))
    },
    BATCH_REQUEST_TIMEOUT
  );

  return validateBatchResponse(
    result,
    data.errors.map(item => item.id)
  );
}