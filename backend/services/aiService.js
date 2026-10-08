const axios = require('axios');

/**
 * AI Model Switcher Service
 * Tries providers sequentially: Gemini -> Groq -> OpenRouter
 */
async function callAI(prompt) {
    let lastError = null;

    // 1. Try Google Gemini First
    if (process.env.GEMINI_API_KEY) {
        try {
            console.log("Attempting request with Google Gemini...");
            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
                {
                    contents: [{ parts: [{ text: prompt }] }]
                },
                { headers: { 'Content-Type': 'application/json' } }
            );

            const aiText = response.data.candidates[0].content.parts[0].text;
            return { provider: 'Gemini', text: aiText };
        } catch (error) {
            console.log("Gemini failed or hit limit, falling back...", error.response?.data || error.message);
            lastError = error;
        }
    }

    // 2. Fallback to Groq
    if (process.env.GROQ_API_KEY) {
        try {
            console.log("Attempting request with Groq...");
            const response = await axios.post(
                'https://api.groq.com/openai/v1/chat/completions',
                {
                    model: 'llama-3.1-8b-instant',
                    messages: [{ role: 'user', content: prompt }]
                },
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const aiText = response.data.choices[0].message.content;
            return { provider: 'Groq', text: aiText };
        } catch (error) {
            console.log("Groq failed or hit limit, falling back...", error.response?.data || error.message);
            lastError = error;
        }
    }

    // If all providers fail
    throw new Error(`All AI providers failed. Last error: ${lastError?.message || 'No API keys configured'}`);
}

module.exports = { callAI };