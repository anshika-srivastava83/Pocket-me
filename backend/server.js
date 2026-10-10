const express = require('express');
require('dotenv').config();
const { callAI, getModels } = require('./services/aiService');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

// Lists the models available for the dropdown
app.get('/api/models', (req, res) => {
    res.json(getModels().map((m) => ({ id: m.id, label: m.label })));
});

app.post('/api/chat', async (req, res) => {
    try {
        const { prompt, modelId, autoFallback } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required in the request body.' });
        }

        const result = await callAI(prompt, modelId, autoFallback === true);
        res.json({ success: true, provider: result.provider, modelId: result.modelId, response: result.text });
    } catch (error) {
        console.error('AI Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});