// Builds a structured prompt for AI error explanation.
const buildPrompt = ({ error, code, language, targetLanguage }) => {
    // Used when sending prompt to real OpenAI later
    return `
  You are a helpful programming tutor.
  
  Explain the following ${language} error in ${targetLanguage}.
  Keep all programming keywords in English.
  Give a short explanation and a short fix.
  Use simple beginner-friendly language.
  
  Error:
  ${error}
  
  Code Snippet:
  ${code}
  
  Return response in this format:
  Explanation: <short explanation>
  Fix: <short fix>
  `.trim();
  };
  
  module.exports = {
    buildPrompt
  };