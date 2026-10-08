const express = require('express');
require('dotenv').config();
const { callAI } = require('./services/aiService');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

// Test route
app.get('/', (req, res) => {
    res.json({ message: "Pocket Me backend is running successfully!" });
});

// AI Chat Route with Model Fallback
app.post('/api/chat', async (req, res) => {
    try {
        const { prompt } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ error: "Prompt is required in the request body." });
        }

        // Call our AI model switcher
        const result = await callAI(prompt);
        res.json({ success: true, provider: result.provider, response: result.text });

    } catch (error) {
        console.error("AI Error:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});