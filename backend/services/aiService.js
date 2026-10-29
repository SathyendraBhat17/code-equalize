const Groq = require("groq-sdk");
const { GROQ_API_KEY } = require("../config/config");
const { buildPrompt } = require("../utils/promptBuilder");

let groq;

function getGroqClient() {
  if (!GROQ_API_KEY) {
    const err = new Error("GROQ_API_KEY is not configured");
    err.code = "GROQ_NOT_CONFIGURED";
    err.statusCode = 503;
    throw err;
  }
  if (!groq) groq = new Groq({ apiKey: GROQ_API_KEY });
  return groq;
}

const generateExplanation = async ({
  error,
  code,
  language,
  targetLanguage,
  baseExplanation,
  baseFix,
}) => {
  try {
    const client = getGroqClient();
    const prompt = buildPrompt({
      error,
      code,
      language,
      targetLanguage,
      baseExplanation,
      baseFix,
    });

    const completion = await client.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.5,
    });

    const text = completion.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      const err = new Error("Groq returned an empty response");
      err.code = "GROQ_EMPTY_RESPONSE";
      throw err;
    }

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
    console.error(`[Groq] Request failed: ${err.code || err.name || "Error"}${err.status ? ` (HTTP ${err.status})` : ""}`);
    console.error(`[Groq] Error detail:`, err.message || err.error || JSON.stringify(err));
    throw err;
}
};

module.exports = {
  generateExplanation,
};
