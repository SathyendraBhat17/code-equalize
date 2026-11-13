// export async function sendToBackend(data: {
//   errorMessage: string;
//   code: string;
//   language: string;
//   targetLanguage: string;
//   errorType?: 'diagnostic' | 'runtime';
// }): Promise<{
//   explanation: string;
//   fix: string;
//   remember?: string | null;
//   source: string;
//   matchedError?: string;
//   similarity?: number | null;
// }> {
//   try {
//     const response = await fetch("http://127.0.0.1:3000/explain", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         error: data.errorMessage,
//         code: data.code,
//         language: data.language,
//         targetLanguage: data.targetLanguage,
//         errorType: data.errorType ?? 'diagnostic',
//       }),
//     });

//     const result = await response.json();
//     if (!response.ok) {
//       const message = typeof result?.error === "string"
//         ? result.error
//         : `Backend request failed with status ${response.status}`;
//       throw new Error(message);
//     }

//     return {
//       explanation: result.explanation,
//       fix: result.fix,
//       remember: result.remember,
//       source: result.source,
//       matchedError: result.matchedError,
//       similarity: result.similarity,
//     };
//   } catch (error) {
//     console.error("Failed to send request to backend:", error);
//     throw error;
//   }
// }



const BACKEND_URL = 'http://127.0.0.1:3000/explain';

const REQUEST_TIMEOUT = 20000;
const MAX_RETRIES = 2;

export type BackendRequest = {
  errorMessage: string;
  code: string;
  language: string;
  targetLanguage: string;
  errorType?: 'diagnostic' | 'runtime';
};

export type BackendResponse = {
  explanation: string;
  fix: string;
  remember?: string | null;
  source: string;
  matchedError?: string;
  distance?: number | null;
};

function validateResponse(result: any): BackendResponse {
  if (
    !result ||
    typeof result !== 'object' ||
    typeof result.explanation !== 'string' ||
    typeof result.fix !== 'string' ||
    typeof result.source !== 'string'
  ) {
    throw new Error(
      'The backend returned an invalid explanation response.'
    );
  }

  return {
    explanation: result.explanation,
    fix: result.fix,
    remember:
      typeof result.remember === 'string'
        ? result.remember
        : null,
    source: result.source,
    matchedError:
      typeof result.matchedError === 'string'
        ? result.matchedError
        : undefined,
    distance:
      typeof result.distance === 'number' &&
      Number.isFinite(result.distance)
        ? result.distance
        : null
  };
}

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

  let lastError: Error = new Error(
    'Unable to connect to the Code Equalize backend.'
  );

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT
    );

    try {
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: data.errorMessage,
          code: data.code,
          language: data.language,
          targetLanguage: data.targetLanguage,
          errorType: data.errorType ?? 'diagnostic'
        }),
        signal: controller.signal
      });

      let result: any;

      try {
        result = await response.json();
      } catch {
        throw new Error(
          'The backend returned an invalid response.'
        );
      }

      if (!response.ok) {
        const message =
          typeof result?.error === 'string'
            ? result.error
            : `Backend request failed with status ${response.status}.`;

        // Retry only temporary server errors.
        if (
          response.status >= 500 &&
          attempt < MAX_RETRIES
        ) {
          lastError = new Error(message);
          continue;
        }

        throw new Error(message);
      }

      return validateResponse(result);

    } catch (error) {
      if (
        error instanceof Error &&
        error.name === 'AbortError'
      ) {
        lastError = new Error(
          'The backend request timed out. Please try again.'
        );
      } else if (error instanceof Error) {
        lastError = error;
      } else {
        lastError = new Error(
          'Unable to communicate with the backend.'
        );
      }

      if (attempt === MAX_RETRIES) {
        break;
      }

    } finally {
      clearTimeout(timeout);
    }
  }

  console.error(
    '[Code Equalize] Backend request failed:',
    lastError.message
  );

  throw lastError;
}
