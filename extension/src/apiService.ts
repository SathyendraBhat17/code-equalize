export async function sendToBackend(data: {
  errorMessage: string;
  code: string;
  language: string;
  targetLanguage: string;
  errorType?: 'diagnostic' | 'runtime';
}): Promise<{
  explanation: string;
  fix: string;
  remember?: string | null;
  source: string;
  matchedError?: string;
  similarity?: number | null;
}> {
  try {
    const response = await fetch("http://127.0.0.1:3000/explain", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        error: data.errorMessage,
        code: data.code,
        language: data.language,
        targetLanguage: data.targetLanguage,
        errorType: data.errorType ?? 'diagnostic',
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      const message = typeof result?.error === "string"
        ? result.error
        : `Backend request failed with status ${response.status}`;
      throw new Error(message);
    }

    return {
      explanation: result.explanation,
      fix: result.fix,
      remember: result.remember,
      source: result.source,
      matchedError: result.matchedError,
      similarity: result.similarity,
    };
  } catch (error) {
    console.error("Failed to send request to backend:", error);
    throw error;
  }
}
