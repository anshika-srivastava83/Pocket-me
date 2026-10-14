const express = require('express');
require('dotenv').config();
const supabase = require('./services/supabase');
const requireAuth = require('./middleware/requireAuth');
const { callAI, getModels } = require('./services/aiService');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

// Public test route
app.get('/', (req, res) => {
    res.json({ message: 'Pocket Me backend is running successfully!' });
});

// Everything below needs a login. requireAuth runs first.
app.get('/api/models', requireAuth, (req, res) => {
    res.json(getModels().map((m) => ({ id: m.id, label: m.label })));
});

app.get('/api/health/db', requireAuth, async (req, res) => {
    const { count, error } = await supabase
        .from('spaces')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error('DB check failed:', error.message);
        return res.status(500).json({ ok: false, error: error.message });
    }
    res.json({ ok: true, spacesCount: count });
});

app.post('/api/chat', requireAuth, async (req, res) => {
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