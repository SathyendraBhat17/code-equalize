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
      temperature: 0.3,
    });

    const text = completion.choices[0].message.content;

    const explanationMatch = text.match(/Explanation:\s*(.+?)(?=Fix:|$)/s);
    const fixMatch = text.match(/Fix:\s*(.+?)$/s);

    const explanation = explanationMatch
      ? explanationMatch[1].trim()
      : text.trim();

    const fix = fixMatch
      ? fixMatch[1].trim()
      : "Check the error and review related code lines.";

    return { explanation, fix };
  } catch (err) {
    console.error("Groq API call failed:", err);
    throw err;
  }
};

module.exports = {
  generateExplanation,
};