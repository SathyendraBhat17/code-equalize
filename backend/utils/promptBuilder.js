// Builds a structured prompt for AI error explanation.
const buildPrompt = ({ error, code, language, targetLanguage, baseExplanation, baseFix }) => {
  const context = baseExplanation
    ? `Here is a similar error from our knowledge base:
Explanation: ${baseExplanation}
Fix: ${baseFix}

Use this as context but generate a fresh explanation for the specific code below.`
    : "";

  return `
You are a helpful programming tutor for beginner students in India.

${context}

A ${language} error occurred:
Error: ${error}

Code Snippet:
${code}

Instructions:
- Explain this error in ${targetLanguage} language
- Keep ALL programming keywords in English (variable, function, array, null, etc.)
- Use simple beginner-friendly language
- Be concise and clear
- Provide a practical fix

Respond EXACTLY in this format:
Explanation: <your explanation in ${targetLanguage}>
Fix: <practical fix in ${targetLanguage}>
`.trim();
};

module.exports = { buildPrompt };