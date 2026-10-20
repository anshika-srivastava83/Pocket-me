const axios = require('axios');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// "history" is a list like [{ role: 'user', content: '...' }, { role: 'assistant', content: '...' }]
// "system" is the optional space instructions.

// Gemini has its own format: roles are "user" and "model", and the system text goes in its own field.
async function callGemini(model, history, system) {
    const body = {
        contents: history.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }))
    };
    if (system) body.systemInstruction = { parts: [{ text: system }] };

    const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        body,
        { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY }, timeout: 30000 }
    );
    const parts = response.data.candidates[0].content.parts;
    return parts.map((p) => p.text).filter(Boolean).join('');
}

// Groq, OpenRouter, Mistral and Cerebras all use this "OpenAI style" format.
async function callOpenAICompatible(baseUrl, apiKey, model, history, system) {
    const messages = system ? [{ role: 'system', content: system }, ...history] : history;
    const response = await axios.post(
        `${baseUrl}/chat/completions`,
        { model, messages },
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
function getModels() {
    const models = [];

    if (process.env.GEMINI_API_KEY) {
        [process.env.GEMINI_MODEL, process.env.GEMINI_FALLBACK_MODEL]
            .filter(Boolean)
            .forEach((name) =>
                models.push({
                    id: `gemini:${name}`,
                    label: `Gemini ${name}`,
                    run: (history, system) => callGemini(name, history, system)
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
                    run: (history, system) =>
                        callOpenAICompatible(
                            'https://api.groq.com/openai/v1',
                            process.env.GROQ_API_KEY,
                            name,
                            history,
                            system
                        )
                })
            );
    }

    return models;
}

async function callAI(history, system, modelId, autoFallback = false) {
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
            const started = Date.now();
            const text = await withRetry(() => model.run(history, system));
            console.log(`${model.label} answered in ${Date.now() - started} ms`);
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