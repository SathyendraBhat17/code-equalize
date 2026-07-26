const Groq = require("groq-sdk");
const { GROQ_API_KEY } = require("../config/config");
const { buildPrompt } = require("../utils/promptBuilder");

const groq = new Groq({
  apiKey: GROQ_API_KEY,
});

const generateExplanation = async ({
  error,
  code,
  language,
  targetLanguage,
  baseExplanation,
  baseFix,
}) => {
  try {
    const prompt = buildPrompt({
      error,
      code,
      language,
      targetLanguage,
      baseExplanation,
      baseFix,
    });

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.5,
    });

    const text = completion.choices[0].message.content;

    const explanationMatch = text.match(/Explanation:\s*(.+?)(?=Fix:|$)/s);
    const fixMatch = text.match(/Fix:\s*(.+?)(?=Remember:|$)/s);
    const rememberMatch = text.match(/Remember:\s*(.+?)$/s);

    const explanation = explanationMatch
      ? explanationMatch[1].trim()
      : text.trim();

    const fix = fixMatch
      ? fixMatch[1].trim()
      : "Check the error and review related code lines.";

    const remember = rememberMatch
      ? rememberMatch[1].trim()
      : null;

    return { explanation, fix, remember };

  } catch (err) {
    console.error("Groq API call failed:", err);
    throw err;
  }
};

module.exports = {
  generateExplanation,
};