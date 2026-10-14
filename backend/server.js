const express = require('express');
require('dotenv').config();
const supabase = require('./services/supabase');
const requireAuth = require('./middleware/requireAuth');
const { callAI, getModels } = require('./services/aiService');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

// Your starting spaces. You can edit the instructions later.
const DEFAULT_SPACES = [
    { name: 'Coding', instructions: 'You are my coding mentor. I am a beginner learning DSA with Java and web development. Explain simply, give code in small parts, and explain what each part does.' },
    { name: 'Mehfil', instructions: 'You are a mentor and partner for my open mic and event business called Mehfil. Help with planning, promotion and ideas.' },
    { name: 'Brand and Resume', instructions: 'Help me build my student brand and tailor my resume to job descriptions. Never add skills or achievements I have not told you about.' },
    { name: 'E-cell', instructions: 'Help with my college entrepreneurship cell: event plans, documents, letters, question sets and brainstorming. Use a direct formal tone for letters.' },
    { name: 'College', instructions: 'Help me keep track of my college projects and files.' },
    { name: 'Miscellaneous', instructions: '' },
    { name: 'Reminders', instructions: 'Help me track deadlines, important dates and birthdays.' }
];

// Public test route
app.get('/', (req, res) => {
    res.json({ message: 'Pocket Me backend is running successfully!' });
});

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

// List my spaces. The first time, create the starting spaces.
app.get('/api/spaces', requireAuth, async (req, res) => {
    const { data, error } = await supabase
        .from('spaces')
        .select('id, name, instructions')
        .eq('user_id', req.user.id)
        .order('position')
        .order('created_at');

    if (error) {
        console.error('List spaces failed:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }

    if (data.length > 0) {
        return res.json(data);
    }

    const rows = DEFAULT_SPACES.map((s, i) => ({ ...s, position: i, user_id: req.user.id }));
    const { data: seeded, error: seedError } = await supabase
        .from('spaces')
        .insert(rows)
        .select('id, name, instructions');

    if (seedError) {
        console.error('Seed spaces failed:', seedError.message);
        return res.status(500).json({ success: false, error: seedError.message });
    }
    const order = DEFAULT_SPACES.map((s) => s.name);
    seeded.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
    res.json(seeded);
});

// Create a new space
app.post('/api/spaces', requireAuth, async (req, res) => {
    const name = (req.body.name || '').trim();
    const instructions = (req.body.instructions || '').trim();

    if (!name || name.length > 40) {
        return res.status(400).json({ success: false, error: 'Name is required and must be 40 characters or less.' });
    }
    if (instructions.length > 4000) {
        return res.status(400).json({ success: false, error: 'Instructions are too long.' });
    }

    const { count } = await supabase
        .from('spaces')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.user.id);

    const { data, error } = await supabase
        .from('spaces')
        .insert({ user_id: req.user.id, name, instructions, position: count || 0 })
        .select('id, name, instructions')
        .single();

    if (error) {
        console.error('Create space failed:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
    res.json(data);
});

app.post('/api/chat', requireAuth, async (req, res) => {
    try {
        const { prompt, modelId, autoFallback, spaceId } = req.body;

        if (!prompt) {
            return res.status(400).json({ success: false, error: 'Prompt is required in the request body.' });
        }

        let finalPrompt = prompt;

        if (spaceId) {
            // Look up the space, but only if it belongs to the logged in user.
            const { data: space, error } = await supabase
                .from('spaces')
                .select('instructions')
                .eq('id', spaceId)
                .eq('user_id', req.user.id)
                .maybeSingle();

            if (error || !space) {
                return res.status(404).json({ success: false, error: 'Space not found.' });
            }
            if (space.instructions) {
                finalPrompt = `Instructions for this conversation:\n${space.instructions}\n\nMy message:\n${prompt}`;
            }
        }

        const result = await callAI(finalPrompt, modelId, autoFallback === true);
        res.json({ success: true, provider: result.provider, modelId: result.modelId, response: result.text });
    } catch (error) {
        console.error('AI Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});