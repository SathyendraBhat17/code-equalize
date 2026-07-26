export async function sendToBackend(data: {
  errorMessage: string;
  code: string;
  language: string;
  targetLanguage: string;
}): Promise<{
  explanation: string;
  fix: string;
  remember?: string | null;
  source: string;
  matchedError?: string;
  similarity?: number | null;
}> {
  try {
    const response = await fetch("http://localhost:3000/explain", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        error: data.errorMessage,
        code: data.code,
        language: data.language,
        targetLanguage: data.targetLanguage,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Backend request failed with status ${response.status}`
      );
    }

    const result = await response.json();

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