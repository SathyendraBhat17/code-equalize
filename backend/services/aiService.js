// Generates a mock AI explanation response in the requested target language.
const generateExplanation = async ({
    error,
    code,
    language,
    targetLanguage,
    baseExplanation,
    baseFix
  }) => {
    try {
      // Replace with real OpenAI GPT-4o-mini call later
  
      // 🔹 CASE 1: If baseExplanation exists → translate DB result
      if (baseExplanation && baseFix) {
        if (targetLanguage === "Kannada") {
          return {
            explanation: `ಈ ದೋಷದ ಅರ್ಥ: ${baseExplanation}`,
            fix: `ಸರಿಪಡಿಸುವ ವಿಧಾನ: ${baseFix}`
          };
        }
  
        if (targetLanguage === "Hindi") {
          return {
            explanation: `इस त्रुटि का अर्थ है: ${baseExplanation}`,
            fix: `समाधान: ${baseFix}`
          };
        }
      }
  
      // 🔹 CASE 2: Normal AI generation (existing logic)
      if (targetLanguage === "Kannada") {
        return {
          explanation:
            `ಈ ದೋಷ "${error}" ಸಾಮಾನ್ಯವಾಗಿ ಕೋಡ್‌ನಲ್ಲಿ ತಪ್ಪು ಬಳಕೆಯಿಂದ ಬರುತ್ತದೆ. ` +
            `ನೀವು ನೀಡಿದ ${language} ಕೋಡ್‌ನಲ್ಲಿ ಸಂಬಂಧಿತ ಸಾಲುಗಳನ್ನು ಪರಿಶೀಲಿಸಿ ಮೂಲ ಕಾರಣವನ್ನು ಕಂಡುಹಿಡಿಯಿರಿ.`,
          fix:
            "ದೋಷ ಉಂಟಾದ ಭಾಗದ variables ಮತ್ತು conditions ಸರಿಯಾಗಿದೆಯೇ ನೋಡಿ. " +
            "ಸಣ್ಣ null/array/index ಪರಿಶೀಲನೆಗಳನ್ನು ಸೇರಿಸಿ ಮತ್ತೆ run ಮಾಡಿ."
        };
      }
  
      return {
        explanation:
          `यह त्रुटि "${error}" आम तौर पर कोड में गलत उपयोग या गलत लॉजिक के कारण आती है। ` +
          `दिए गए ${language} कोड की संबंधित लाइनों को ध्यान से जांचें।`,
        fix:
          "जिस हिस्से में त्रुटि आ रही है वहां variables और conditions को verify करें। " +
          "ज़रूरत हो तो null/index checks जोड़कर कोड फिर से run करें।"
      };
  
    } catch (error) {
      console.error("Failed to generate mock AI explanation:", error);
      throw error;
    }
  };
  
  module.exports = {
    generateExplanation
  };