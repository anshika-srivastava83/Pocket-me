const axios = require('axios');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Gemini has its own request format. The key goes in a header so it cannot leak into logs.
async function callGemini(model, prompt) {
    const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        { contents: [{ parts: [{ text: prompt }] }] },
        { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY }, timeout: 30000 }
    );
    const parts = response.data.candidates[0].content.parts;
    return parts.map((p) => p.text).filter(Boolean).join('');
}

// Groq, OpenRouter, Mistral and Cerebras all use this same "OpenAI style" format,
// so one function serves all of them. Only the base URL and key change.
async function callOpenAICompatible(baseUrl, apiKey, model, prompt) {
    const response = await axios.post(
        `${baseUrl}/chat/completions`,
        { model, messages: [{ role: 'user', content: prompt }] },
        { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 30000 }
    );
    return response.data.choices[0].message.content;
}

// One retry for temporary problems (busy server or rate limit).
async function withRetry(fn) {
    try {
        return await fn();
    } catch (err) {
        if ([429, 500, 502, 503].includes(err.response?.status)) {
            await wait(1500);
            return await fn();
        }
        throw err;
    }
}

// Builds the list of models you can choose from, based on which keys exist in .env.
// To add a new provider later, add one more block here.
function getModels() {
    const models = [];

    if (process.env.GEMINI_API_KEY) {
        [process.env.GEMINI_MODEL, process.env.GEMINI_FALLBACK_MODEL]
            .filter(Boolean)
            .forEach((name) =>
                models.push({
                    id: `gemini:${name}`,
                    label: `Gemini ${name}`,
                    run: (prompt) => callGemini(name, prompt)
                })
            );
    }

    if (process.env.GROQ_API_KEY) {
        [process.env.GROQ_MODEL, process.env.GROQ_FALLBACK_MODEL]
            .filter(Boolean)
            .forEach((name) =>
                models.push({
                    id: `groq:${name}`,
                    label: `Groq ${name}`,
                    run: (prompt) =>
                        callOpenAICompatible(
                            'https://api.groq.com/openai/v1',
                            process.env.GROQ_API_KEY,
                            name,
                            prompt
                        )
                })
            );
    }

    return models;
}

// modelId: the model you picked. autoFallback: if true, other models are tried
// when yours fails. If false (the default), you get the real error instead.
async function callAI(prompt, modelId, autoFallback = false) {
    const models = getModels();
    if (models.length === 0) {
        throw new Error('No AI providers configured. Check your .env file.');
    }

    let queue;
    if (modelId) {
        const chosen = models.find((m) => m.id === modelId);
        if (!chosen) throw new Error(`Unknown model: ${modelId}`);
        queue = autoFallback ? [chosen, ...models.filter((m) => m.id !== modelId)] : [chosen];
    } else {
        queue = autoFallback ? models : [models[0]];
    }

    const errors = [];
    for (const model of queue) {
        try {
            console.log(`Trying ${model.label}...`);
            const text = await withRetry(() => model.run(prompt));
            return { provider: model.label, modelId: model.id, text };
        } catch (err) {
            const status = err.response?.status || 'no status';
            const message = err.response?.data?.error?.message || err.message;
            console.error(`${model.label} failed: ${status} ${message}`);
            errors.push(`${model.label}: ${status} ${message}`);
        }
    }

    throw new Error(errors.join(' | '));
}

module.exports = { callAI, getModels };