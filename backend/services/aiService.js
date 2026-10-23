const axios = require('axios');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// "history" is a list like [{ role: 'user', content: '...' }, { role: 'assistant', content: '...' }]
// "system" is the optional space instructions.
// "signal" lets the caller cancel the request (used by the Stop button).

async function callGemini(model, history, system, signal) {
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
        { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY }, timeout: 30000, signal }
    );
    const parts = response.data.candidates[0].content.parts;
    return parts.map((p) => p.text).filter(Boolean).join('');
}

// Groq, OpenRouter, Mistral and Cerebras all use this "OpenAI style" format.
async function callOpenAICompatible(baseUrl, apiKey, model, history, system, signal) {
    const messages = system ? [{ role: 'system', content: system }, ...history] : history;
    const response = await axios.post(
        `${baseUrl}/chat/completions`,
        { model, messages },
        { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 30000, signal }
    );
    return response.data.choices[0].message.content;
}

// One retry for temporary problems. A cancel is never retried.
async function withRetry(fn, signal) {
    try {
        return await fn();
    } catch (err) {
        if (signal?.aborted) throw err;
        if ([429, 500, 502, 503].includes(err.response?.status)) {
            await wait(1500);
            if (signal?.aborted) throw err;
            return await fn();
        }
        throw err;
    }
}

function getModels() {
    const models = [];

    if (process.env.GEMINI_API_KEY) {
        [process.env.GEMINI_MODEL, process.env.GEMINI_FALLBACK_MODEL]
            .filter(Boolean)
            .forEach((name) =>
                models.push({
                    id: `gemini:${name}`,
                    label: `Gemini ${name}`,
                    run: (history, system, signal) => callGemini(name, history, system, signal)
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
                    run: (history, system, signal) =>
                        callOpenAICompatible(
                            'https://api.groq.com/openai/v1',
                            process.env.GROQ_API_KEY,
                            name,
                            history,
                            system,
                            signal
                        )
                })
            );
    }

    return models;
}

async function callAI(history, system, modelId, autoFallback = false, signal) {
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
            const text = await withRetry(() => model.run(history, system, signal), signal);
            console.log(`${model.label} answered in ${Date.now() - started} ms`);
            return { provider: model.label, modelId: model.id, text };
        } catch (err) {
            // If you pressed Stop, do not try other models. Just stop everything.
            if (signal?.aborted || axios.isCancel(err)) {
                const stopped = new Error('Stopped by user.');
                stopped.aborted = true;
                throw stopped;
            }
            const status = err.response?.status || 'no status';
            const message = err.response?.data?.error?.message || err.message;
            console.error(`${model.label} failed: ${status} ${message}`);
            errors.push(`${model.label}: ${status} ${message}`);
        }
    }

    throw new Error(errors.join(' | '));
}

module.exports = { callAI, getModels };